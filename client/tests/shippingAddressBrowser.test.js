import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
const require = createRequire(import.meta.url)
const { validateZipCode } = require('../../server/utils/phZipValidator.js')

test('shared checkout/add/edit form supports NCR, dependent resets and saved-address hydration', async () => {
  const fixture = await build({
    stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {AddressForm} from './src/app/components/AddressForm.jsx';
      function Fixture() {
        const [address, setAddress] = useState({}); window.editAddress = setAddress;
        return <AddressForm initialAddress={address} onSubmit={value => window.savedAddress = value} />;
      }
      createRoot(document.getElementById('root')).render(<Fixture />);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/app.js' ? 'application/javascript' : 'text/html');
    res.end(req.url === '/app.js' ? fixture.outputFiles[0].text : '<div id="root"></div><script src="/app.js"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 375, height: 900 } });
    await page.route('**/api/address/validate-zip?*', route => {
      const url = new URL(route.request().url());
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ data: validateZipCode(url.searchParams.get('cityCode'), url.searchParams.get('zipCode')) }) });
    });
    await page.goto('http://127.0.0.1:' + server.address().port);
    assert.equal(await page.getByRole('textbox', { name: 'Country' }).inputValue(), 'Philippines');
    assert.equal(await page.getByRole('textbox', { name: 'Country' }).isEditable(), false);
    await page.getByPlaceholder('House number, street name').fill('123 Test Street');
    await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('1300000000');
    assert.equal(await page.getByRole('combobox', { name: 'Province', exact: true }).count(), 0);
    const city = page.getByRole('combobox', { name: 'City / Municipality', exact: true });
    assert.equal(await city.locator('option').count(), 18);
    await city.selectOption({ label: 'Quezon City' });
    await page.getByRole('combobox', { name: 'Barangay', exact: true }).selectOption({ label: 'Batasan Hills' });
    await page.getByPlaceholder('1234', { exact: true }).fill('1126');
    await page.getByRole('button', { name: 'Save Address', exact: true }).click();
    await page.waitForFunction(() => window.savedAddress?.city === 'Quezon City');
    assert.equal((await page.evaluate(() => window.savedAddress)).stateProvince, null);
    await city.selectOption({ label: 'Pateros' });
    assert.equal(await page.getByRole('combobox', { name: 'Barangay', exact: true }).inputValue(), '');
    assert.ok(await page.getByRole('combobox', { name: 'Barangay', exact: true }).locator('option').count() > 1);
    await city.selectOption({ label: 'Manila City' });
    assert.ok(await page.getByRole('combobox', { name: 'Barangay', exact: true }).locator('option').count() > 800);
    await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('0300000000');
    assert.equal(await city.inputValue(), '');
    const province = page.getByRole('combobox', { name: 'Province', exact: true });
    await province.selectOption({ label: 'Bulacan' });
    await city.selectOption({ label: 'Malolos City' });
    await page.getByRole('combobox', { name: 'Barangay', exact: true }).selectOption({ label: 'Longos' });
    await page.getByPlaceholder('1234', { exact: true }).fill('3000');
    await page.getByRole('button', { name: 'Save Address', exact: true }).click();
    await page.waitForFunction(() => window.savedAddress?.city === 'Malolos City');
    assert.equal((await page.evaluate(() => window.savedAddress)).stateProvince, 'Bulacan');
    await province.selectOption({ label: 'Pampanga' });
    assert.equal(await city.inputValue(), '');
    assert.equal(await page.getByRole('combobox', { name: 'Barangay', exact: true }).isEnabled(), false);
    for (const stateProvince of [null, 'Metro Manila']) {
      await page.evaluate(stateProvince => window.editAddress({ city: 'Quezon City', barangay: 'Batasan Hills', stateProvince, streetLine1: '123 Test Street', postalZipCode: '1126', country: 'PH' }), stateProvince);
      await page.waitForFunction(() => document.querySelector('[aria-label="City / Municipality"]').value === '1381300000');
      assert.equal(await page.getByRole('combobox', { name: 'Province', exact: true }).count(), 0);
      assert.ok(await page.getByRole('combobox', { name: 'Barangay', exact: true }).inputValue());
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
