// Run from the repository root: node qa/verify-terms-modal.cjs
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { chromium } = require('../client/node_modules/@playwright/test');

(async () => {
  const root = path.resolve(__dirname, '..');
  const client = path.join(root, 'client');
  const harness = path.join(client, '.temp', 'terms-ui');
  let server, browser;
  await fs.mkdir(harness, { recursive: true });
  await fs.writeFile(path.join(harness, 'index.html'), '<html><body><div id="root"></div><script type="module" src="./app.jsx"></script></body></html>');
  await fs.writeFile(path.join(harness, 'app.jsx'), `
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import TermsModal from '../../src/app/components/TermsAndConditionsModal'
    import { AuthProvider, useAuth } from '../../src/app/context/AuthContext'
    import { saveAgreement, createCheckoutId, TERMS_VERSIONS } from '../../src/app/utils/termsAgreement'
    import '../../src/styles/globals.css'
    import '../../src/styles/responsive.css'
    function Harness() {
      const [open, setOpen] = useState(false)
      const [payment, setPayment] = useState(false)
      const { login, isAuthenticated } = useAuth()
      return <main style={{ minHeight: '200vh' }}>
        <button onClick={() => setOpen(true)}>Continue to Payment</button>
        <button onClick={() => login({ id: 'test-user', role: 'customer' }, 'test-token')}>Sign in</button>
        <p>{isAuthenticated ? 'Account access granted' : 'Account access pending'}</p>
        {payment && <p>Payment opened</p>}
        <TermsModal isOpen={open} onClose={() => setOpen(false)} onAgree={async () => {
          await saveAgreement('checkout', { agreed: true, checkoutId: createCheckoutId(), types: ['orders', 'customization'], versions: TERMS_VERSIONS })
          setOpen(false); setPayment(true)
        }} />
      </main>
    }
    createRoot(document.getElementById('root')).render(<AuthProvider><Harness /></AuthProvider>)
  `);
  try {
    process.chdir(client);
    const { createServer } = await import(pathToFileURL(path.join(client, 'node_modules/vite/dist/node/index.js')).href);
    server = await createServer({ root: client, server: { host: '127.0.0.1', port: 3101, strictPort: true, open: false } });
    await server.listen();
    browser = await chromium.launch({ headless: true });
    for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 768, height: 1024 }], ['mobile', { width: 390, height: 844 }]]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      let checkoutWrites = 0, accountWrites = 0, failSave = true, accountRequired = true;
      await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3101/')
        ? route.continue() : route.fulfill({ json: { status: 'success', data: {} } }));
      await page.route('**/auth/terms/**', async route => {
        const url = route.request().url();
        if (url.endsWith('/status')) return route.fulfill({ json: { data: { required: accountRequired } } });
        const body = route.request().postDataJSON();
        assert.equal(body.agreed, true);
        if (url.endsWith('/checkout')) {
          assert.match(body.checkoutId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
          checkoutWrites++;
          if (failSave) return route.fulfill({ status: 503, json: { message: 'Unable to save agreement' } });
        } else { accountWrites++; accountRequired = false; }
        return route.fulfill({ json: { status: 'success', data: { checkoutId: body.checkoutId } } });
      });
      await page.goto('http://127.0.0.1:3101/.temp/terms-ui/index.html');
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), name === 'tablet' ? 'light' : 'dark');
      await page.evaluate(() => { Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true }); });
      await page.getByRole('button', { name: 'Continue to Payment' }).click();
      const agreement = page.getByRole('button', { name: 'I Have Read and Agree to the Terms and Conditions' });
      const dialog = page.getByRole('dialog');
      await agreement.waitFor();
      assert.equal(await agreement.isDisabled(), true);
      assert.equal(await dialog.locator('[aria-live="polite"]').evaluate(element => getComputedStyle(element).color), 'rgb(239, 68, 68)');
      assert.equal(checkoutWrites, 0);
      await page.evaluate(() => { window.scrollTo(0, 5000); window.dispatchEvent(new Event('scroll')); });
      assert.equal(await agreement.isDisabled(), true);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(await page.getByText('Payment opened', { exact: true }).count(), 0);
      assert.equal(checkoutWrites, 0);
      await page.getByRole('button', { name: 'Continue to Payment' }).click();
      assert.equal(await agreement.isDisabled(), true);
      assert.ok(await dialog.getByText('Order Terms and Conditions', { exact: true }).count());
      assert.ok(await dialog.getByText('Customization Terms and Conditions', { exact: true }).count());
      const scrollBottom = () => dialog.locator('[tabindex="0"]').evaluate(element => { element.scrollTop = element.scrollHeight; });
      await scrollBottom();
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent.includes('I Have Read and Agree'))?.disabled);
      assert.equal(await dialog.locator('[aria-live="polite"]').evaluate(element => getComputedStyle(element).color), 'rgb(34, 197, 94)');
      const rect = await agreement.boundingBox();
      assert.ok(rect.y >= 0 && rect.y + rect.height <= viewport.height);
      assert.ok(rect.x >= 0 && rect.x + rect.width <= viewport.width);
      await agreement.click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByText('Payment opened', { exact: true }).count(), 0);
      assert.equal(await dialog.count(), 1);
      failSave = false;
      await agreement.dblclick();
      await page.getByText('Payment opened', { exact: true }).waitFor();
      assert.equal(checkoutWrites, 2); // One failed save and one successful save.
      assert.equal(await dialog.count(), 0);
      // Existing customers can cancel acceptance without receiving account access.
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await agreement.waitFor();
      assert.equal(await page.getByText('Account access pending', { exact: true }).count(), 1);
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(accountWrites, 0);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await agreement.waitFor();
      assert.equal(await agreement.isDisabled(), true);
      await scrollBottom();
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(button => button.textContent.includes('I Have Read and Agree'))?.disabled);
      await agreement.click();
      await page.getByText('Account access granted', { exact: true }).waitFor();
      assert.equal(accountWrites, 1);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      assert.equal(await dialog.count(), 0);
      assert.deepEqual(errors, []);
      console.log(name + ': scroll gate, cancel, retry, duplicate click, payment sequencing and account version gate passed');
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) await server.close();
    await fs.rm(path.join(harness, 'index.html'), { force: true });
    await fs.rm(path.join(harness, 'app.jsx'), { force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
