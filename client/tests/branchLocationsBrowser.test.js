import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

test('add branch form saves a second location and retains both addresses after reload', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { BranchAddressSettings } from './src/app/pages/admin/components/settings/BranchAddressSettings.jsx';
      createRoot(document.getElementById('root')).render(<BranchAddressSettings />);
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', define: { 'import.meta.env': '{}' },
  })
  const primary = { id: 'balagtas-main', name: 'Main branch', address: 'Existing main address', hours: 'Mon-Sat 9 AM - 6 PM', address_details: null }
  const branches = [primary]
  const requests = []
  const server = createServer(async (req, res) => {
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(bundle.outputFiles[0].text)
    }
    if (req.url.startsWith('/api/branch/')) {
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'POST') {
        let text = ''
        for await (const chunk of req) text += chunk
        const body = JSON.parse(text)
        requests.push(body)
        const branch = { ...body, id: 'new-branch', address: '123 New Street, Malolos' }
        branches.push(branch)
        return res.end(JSON.stringify({ success: true, data: branch }))
      }
      return res.end(JSON.stringify({ success: true, data: primary, branches }))
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('button', { name: 'Add branch address', exact: true }).click()
    await page.getByLabel('Branch name').fill('Malolos branch')
    await page.getByLabel('Opening hours').fill('Mon-Fri 9 AM - 5 PM')
    await page.locator('select').first().selectOption('US')
    await page.getByPlaceholder('House number, street name').fill('123 New Street')
    await page.getByPlaceholder('State / Province').fill('California')
    await page.getByPlaceholder('City', { exact: true }).fill('San Francisco')
    await page.getByPlaceholder('1234').fill('94103')
    await page.getByRole('button', { name: 'Add Branch Address', exact: true }).click()
    await expect(page.getByText('Malolos branch', { exact: true })).toBeVisible()
    await expect(page.getByText(primary.address, { exact: true })).toBeVisible()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].address_details.streetLine1, '123 New Street')
    await page.reload()
    await expect(page.getByText('Malolos branch', { exact: true })).toBeVisible()
    await expect(page.getByText(primary.address, { exact: true })).toBeVisible()
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
