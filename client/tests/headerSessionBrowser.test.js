import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('homepage header waits for session restoration before showing profile or Login', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { BrowserRouter } from 'react-router';
      import { AuthProvider } from './src/app/context/AuthContext.jsx';
      import { ThemeProvider } from './src/app/context/ThemeContext.jsx';
      import { Header } from './src/app/components/Header.jsx';
      createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider><AuthProvider><BrowserRouter><Header/></BrowserRouter></AuthProvider></ThemeProvider></React.StrictMode>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{}' },
    // Isolate the header's authentication display from unrelated cart operations.
    plugins: [{ name: 'cart-fixture', setup(build) {
      build.onLoad({ filter: /[\\/]context[\\/]CartContext\.jsx$/ }, () => ({ contents: 'export const useCart = () => ({getCartCount: () => 0, setIsOpen: () => {}})', loader: 'js' }))
    } }],
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundle.outputFiles[0].text) }
    res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const origin = `http://127.0.0.1:${server.address().port}`
    for (const authenticated of [true, false]) {
      const context = await browser.newContext()
      const pendingChecks = []
      const user = { id: 'user-1', role: 'customer', email: 'test@example.com' }
      await context.route('**/auth/check', route => { pendingChecks.push(route) })
      await context.route('**/auth/terms/status', route => route.fulfill({ json: { data: { required: false } } }))
      await context.route('**/api/users/profile', route => route.fulfill({ json: { data: { user } } }))
      const page = await context.newPage()
      const errors = []; page.on('pageerror', error => errors.push(error.message))
      // Check both initial arrival and a real document reload.
      for (let visit = 0; visit < 2; visit++) {
        pendingChecks.length = 0
        if (visit) await page.reload(); else await page.goto(origin)
        await page.getByRole('status', { name: 'Checking session' }).first().waitFor({ state: 'attached' })
        await page.waitForTimeout(300)
        assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).count(), 0)
        assert.equal(await page.getByRole('button', { name: 'Open profile menu', exact: true }).count(), 0)
        assert.equal(pendingChecks.length, 2)
        for (const route of pendingChecks) await route.fulfill({ json: { data: { isAuthenticated: authenticated, user: authenticated ? user : null } } })
        const expected = authenticated ? 'Open profile menu' : 'Login'
        await page.getByRole('button', { name: expected, exact: true }).first().waitFor()
        assert.equal(await page.getByRole('status', { name: 'Checking session' }).count(), 0)
        if (authenticated) assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).count(), 0)
      }
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
