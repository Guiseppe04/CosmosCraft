import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('customer header is immediately usable while management accounts still wait for verification', async () => {
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
    for (const scenario of ['customer', 'guest', 'admin', 'super_admin', 'staff', 'outage', 'expired']) {
      const authenticated = scenario !== 'guest' && scenario !== 'expired'
      const management = ['admin', 'super_admin', 'staff'].includes(scenario)
      const context = await browser.newContext()
      const pendingChecks = []
      const user = { id: 'user-1', role: management ? scenario : 'customer', email: 'test@example.com' }
      if (scenario !== 'guest') {
        await context.addInitScript(user => {
          if (!localStorage.getItem('seeded')) {
            localStorage.setItem('cosmoscraft_auth', JSON.stringify(user))
            localStorage.setItem('seeded', 'true')
          }
        }, user)
      }
      await context.route('**/auth/check', route => { pendingChecks.push(route) })
      await context.route('**/auth/terms/status', route => route.fulfill({ json: { data: { required: false } } }))
      await context.route('**/api/users/profile', route => route.fulfill({ json: { data: { user } } }))
      const page = await context.newPage()
      const errors = []; page.on('pageerror', error => errors.push(error.message))
      // Check both initial arrival and a real document reload.
      for (let visit = 0; visit < 2; visit++) {
        pendingChecks.length = 0
        if (visit) await page.reload(); else await page.goto(origin)
        if (management) await page.getByRole('status', { name: 'Checking session' }).first().waitFor({ state: 'attached' })
        else {
          const cached = scenario !== 'guest' && !(scenario === 'expired' && visit)
          await page.getByRole('button', { name: cached ? 'Open profile menu' : 'Login', exact: true }).first().waitFor()
          assert.equal(await page.getByRole('status', { name: 'Checking session' }).count(), 0)
        }
        await page.waitForTimeout(300)
        if (management) {
          assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).count(), 0)
          assert.equal(await page.getByRole('button', { name: 'Open profile menu', exact: true }).count(), 0)
        }
        assert.equal(pendingChecks.length, 2)
        for (const route of pendingChecks) await route.fulfill({ status: scenario === 'outage' ? 503 : 200, json: { data: { isAuthenticated: authenticated, user: authenticated ? user : null } } })
        const expected = authenticated ? 'Open profile menu' : 'Login'
        await page.getByRole('button', { name: expected, exact: true }).first().waitFor()
        assert.equal(await page.getByRole('status', { name: 'Checking session' }).count(), 0)
        if (authenticated) assert.equal(await page.getByRole('button', { name: 'Login', exact: true }).count(), 0)
        if (scenario === 'outage') {
          await page.waitForTimeout(5200)
          assert.equal(pendingChecks.length, 2, 'customer restoration must not poll after a temporary failure')
        }
      }
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
