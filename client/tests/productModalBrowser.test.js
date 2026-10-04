import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

test('product wizard validates each step and reserves saving for Media & Assets on desktop and mobile', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/admin/components/modals/ProductModal.jsx', './src/app/pages/admin/components/shared/ImageUploadWidget.jsx', './src/app/pages/AdminPage.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const fixture = await build({
    stdin: { contents: `import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
      import {ProductModal} from './src/app/pages/admin/components/modals/ProductModal.jsx';
      import {PRODUCT_RULES,validate} from './src/app/pages/admin/constants/adminOptions.js';
      window.saves=[];
      function Fixture(){
        const [form,setForm]=useState({}),[formErrors,setFormErrors]=useState({}),[wizardTab,setWizardTab]=useState('basic'),[isSaving,setIsSaving]=useState(false),[isUploading,setIsUploading]=useState(false),[open,setOpen]=useState(true);
        window.setErrors=setFormErrors; window.setUploading=setIsUploading;
        const saveProduct=async (options={})=>{window.saves.push({form,options});setIsSaving(true);await new Promise(resolve=>window.finishSave=resolve);setIsSaving(false);};
        const validateAndSave=(rules,save)=>async()=>{const errors=validate(rules,form);setFormErrors(errors);if(!Object.keys(errors).length)await save();};
        return open && <div className="fixed inset-0 flex items-center justify-center bg-black/70 p-4"><div role="dialog" className="flex max-h-[90dvh] max-w-3xl w-full flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface-dark)]"><ProductModal modal={{data:null}} form={form} setForm={setForm} formErrors={formErrors} setFormErrors={setFormErrors} wizardTab={wizardTab} setWizardTab={setWizardTab} closeModal={()=>setOpen(false)} isSaving={isSaving} isUploading={isUploading} saveProduct={saveProduct} handleImageUpload={()=>{}} categories={[{category_id:'guitars',name:'Electric Guitars'}]} formatCurrency={value=>'₱'+value.toLocaleString()} validateAndSave={validateAndSave} productRules={PRODUCT_RULES} labelCls="mb-1.5 block text-xs text-[var(--text-muted)]" /></div></div>
      }createRoot(document.getElementById('root')).render(<Fixture/>);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('heading', { name: 'New Product', exact: true }).waitFor({ timeout: 5000 }).catch(error => { throw new Error(`${error.message}\nBrowser errors: ${errors.join('; ')}`) })
    const save = page.getByRole('button', { name: 'Save Product', exact: true })
    const another = page.getByRole('button', { name: 'Save & Add Another', exact: true })
    const next = page.getByRole('button', { name: 'Next', exact: true })
    assert.equal(await save.count(), 0)
    assert.equal(await another.count(), 0)
    await next.click()
    await page.getByRole('alert').filter({ hasText: 'Name is required' }).waitFor()
    assert.equal(await page.getByRole('button', { name: 'Basic Info', exact: true }).getAttribute('aria-current'), 'step')
    await page.getByRole('button', { name: 'Media & Assets', exact: true }).click()
    assert.equal(await save.count(), 0)
    await page.getByPlaceholder('Classic Stratocaster').fill('Classic Stratocaster')
    await page.getByPlaceholder('e.g. CC-STRAT-001').fill('CC-STRAT-001')
    await page.getByRole('combobox').selectOption('guitars')
    await next.click()
    await page.getByPlaceholder('e.g. 50000').waitFor()
    assert.equal(await save.count(), 0)
    assert.equal(await another.count(), 0)
    await next.click()
    await page.getByRole('alert').filter({ hasText: 'Price is required' }).waitFor()
    await page.getByPlaceholder('e.g. 50000').fill('-10')
    await next.click()
    await page.getByRole('alert').filter({ hasText: 'Price must be greater than 0' }).waitFor()
    await page.getByPlaceholder('e.g. 50000').fill('50000')
    await page.getByPlaceholder('e.g. 100').fill('20')
    await next.click()
    await page.getByText('Review your product', { exact: true }).waitFor()
    await page.getByText('Classic Stratocaster', { exact: true }).waitFor()
    await save.waitFor()
    await another.waitFor()
    assert.equal(await next.count(), 0)
    await page.evaluate(() => window.setUploading(true))
    await page.waitForFunction(() => [...document.querySelectorAll('button')].find(button => button.textContent === 'Save Product')?.disabled)
    assert.equal(await another.isDisabled(), true)
    await page.evaluate(() => window.setUploading(false))
    await another.click()
    await page.getByRole('button', { name: 'Saving...', exact: true }).waitFor()
    assert.equal(await another.isDisabled(), true)
    assert.deepEqual(await page.evaluate(() => window.saves.map(({options}) => options)), [{ addAnother: true }])
    await page.evaluate(() => window.finishSave())
    await save.waitFor()
    // A server-side SKU conflict must send the user to the field without losing the draft.
    await page.evaluate(() => window.setErrors({ sku: 'SKU already exists' }))
    await page.getByRole('alert').filter({ hasText: 'SKU already exists' }).waitFor()
    assert.equal(await page.getByPlaceholder('Classic Stratocaster').inputValue(), 'Classic Stratocaster')
    assert.equal(await save.count(), 0)
    await page.getByPlaceholder('e.g. CC-STRAT-001').fill('CC-STRAT-002')
    await next.click()
    await page.getByPlaceholder('e.g. 50000').waitFor()
    assert.equal(await page.getByPlaceholder('e.g. 50000').inputValue(), '50000')
    await next.click()
    await save.waitFor()
    await page.getByText('Review your product', { exact: true }).waitFor()
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 700 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      const bounds = await save.boundingBox()
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= 700, 'save stays inside the mobile viewport')
    }
    await save.click()
    await page.getByRole('button', { name: 'Saving...', exact: true }).waitFor()
    assert.deepEqual(await page.evaluate(() => window.saves[1].options), {})
    await page.evaluate(() => window.finishSave())
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
