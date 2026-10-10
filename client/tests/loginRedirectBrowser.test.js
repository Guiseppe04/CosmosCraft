import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('email and OAuth login leave the login page for each role, despite a stale login return path', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { createBrowserRouter, RouterProvider } from 'react-router';
      import { AuthProvider } from './src/app/context/AuthContext.jsx';
      import { LoginPage } from './src/app/pages/LoginPage.jsx';
      import { OAuthSuccessPage } from './src/app/pages/OAuthSuccessPage.jsx';
      const router = createBrowserRouter([
        {path:'/login',element:<LoginPage/>},
        {path:'/auth/success',element:<OAuthSuccessPage/>},
        ...['dashboard','admin','staff'].map(path=>({path:'/'+path,element:<h1>{path}</h1>}))
      ]);
      createRoot(document.getElementById('root')).render(<React.StrictMode><AuthProvider><RouterProvider router={router}/></AuthProvider></React.StrictMode>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      res.end(bundle.outputFiles[0].text)
    } else {
      res.setHeader('Content-Type', 'text/html')
      res.end('<div id="root"></div><script src="/bundle.js"></script>')
    }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
    const origin = `http://127.0.0.1:${server.address().port}`
    for (const [role, destination] of [['customer', 'dashboard'], ['staff', 'staff'], ['admin', 'admin'], ['super_admin', 'admin']]) {
      for (const social of [false, true]) {
        const context = await browser.newContext()
        let signedIn = social
        const user = { id: 'user-1', role, email: 'test@example.com' }
        await context.addInitScript(() => sessionStorage.setItem('cosmoscraft.auth.returnTo', '/login'))
        await context.route('**/auth/check', route => route.fulfill({ json: { data: { isAuthenticated: signedIn, user: signedIn ? user : null } } }))
        await context.route('**/api/users/profile', route => route.fulfill({ json: { data: { user } } }))
        await context.route('**/auth/email-login', route => {
          signedIn = true
          return route.fulfill({ json: { data: { user, accessToken: 'test-token' } } })
        })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(origin + (social ? '/auth/success?token=test-token' : '/login'))
        if (!social) {
          await page.getByPlaceholder('name@example.com').fill('test@example.com')
          await page.locator('input[type="password"]').fill('test-password')
          await page.locator('button[type="submit"]').click()
        }
        await page.getByRole('heading', { name: destination, exact: true }).waitFor()
        assert.equal(new URL(page.url()).pathname, '/' + destination)
        assert.deepEqual(errors, [])
        await context.close()
      }
    }
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
