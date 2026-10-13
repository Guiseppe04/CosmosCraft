import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

test('admin cookie-only startup waits for restoration, survives temporary failure and restores after reload', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { createBrowserRouter, RouterProvider } from 'react-router';
      import { AuthProvider } from './src/app/context/AuthContext.jsx';
      import { ProtectedRoute } from './src/app/components/auth/ProtectedRoute.jsx';
      const router = createBrowserRouter([
        {path:'/admin',element:<ProtectedRoute allowedRoles={['admin']}><h1>Restored session</h1></ProtectedRoute>},
        {path:'/login',element:<h1>Sign in</h1>}
      ]);
      createRoot(document.getElementById('root')).render(<React.StrictMode><AuthProvider><RouterProvider router={router}/></AuthProvider></React.StrictMode>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  let checks = 0, temporaryFailure = true
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(bundle.outputFiles[0].text) }
    if (req.url === '/auth/check') {
      checks++
      res.setHeader('Content-Type', 'application/json')
      if (temporaryFailure) { temporaryFailure = false; res.statusCode = 503; return res.end('{}') }
      const authenticated = req.headers.cookie?.includes('refreshToken=browser-session')
      res.setHeader('X-New-Access-Token', 'restored-access')
      return setTimeout(() => res.end(JSON.stringify({ data: { isAuthenticated: Boolean(authenticated), user: authenticated ? { id: 'user-1', role: 'admin' } : null } })), 150)
    }
    if (req.url === '/auth/terms/status' || req.url === '/api/users/profile') {
      res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ data: { required: false, user: { id: 'user-1', role: 'admin' } } }))
    }
    res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const context = await browser.newContext()
    const origin = `http://127.0.0.1:${server.address().port}`
    await context.addCookies([{ name: 'refreshToken', value: 'browser-session', url: origin, httpOnly: true, sameSite: 'Lax' }])
    const page = await context.newPage()
    const errors = []; page.on('pageerror', e => errors.push(e.message))
    await page.goto(origin + '/admin')
    await page.waitForTimeout(400)
    assert.equal(new URL(page.url()).pathname, '/admin')
    assert.equal(await page.getByRole('heading', { name: 'Sign in' }).count(), 0)
    await page.getByRole('heading', { name: 'Restored session' }).waitFor({ timeout: 10000 })
    assert.equal(await page.evaluate(() => localStorage.getItem('cosmoscraft_token')), 'restored-access')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('heading', { name: 'Restored session' }).waitFor()
    assert.ok(checks >= 3)
    await context.clearCookies()
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('heading', { name: 'Sign in' }).waitFor()
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})

test('late startup responses cannot undo restoration or a later login/logout in StrictMode', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { AuthProvider, useAuth } from './src/app/context/AuthContext.jsx';
      function Probe() {
        const auth = useAuth();
        return <><h1>{auth.isLoadingUser ? 'Restoring' : auth.isAuthenticated ? 'Signed in' : 'Signed out'}</h1>
          <button onClick={() => auth.login({id:'user-1',role:'admin'}, 'fresh-login')}>Login</button>
          <button onClick={() => auth.logout()}>Logout</button></>;
      }
      createRoot(document.getElementById('root')).render(<React.StrictMode><AuthProvider><Probe/></AuthProvider></React.StrictMode>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{}' },
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
    for (const action of ['restore', 'login', 'logout']) {
      const context = await browser.newContext()
      let checkCount = 0
      const pending = []
      const user = { id: 'user-1', role: 'admin' }
      await context.route('**/auth/check', route => {
        checkCount++
        if (action === 'restore' && checkCount === 2) return route.fulfill({ json: { data: { isAuthenticated: true, user } } })
        pending.push(route)
      })
      await context.route('**/auth/terms/status', route => route.fulfill({ json: { data: { required: false } } }))
      await context.route('**/api/users/profile', route => route.fulfill({ json: { data: { user } } }))
      await context.route('**/auth/logout', route => route.fulfill({ json: { status: 'success' } }))
      const page = await context.newPage()
      const errors = []; page.on('pageerror', e => errors.push(e.message))
      await page.goto(origin)
      await page.waitForFunction(() => document.querySelector('button'))
      // Wait until both development mount checks have been dispatched.
      for (let i = 0; checkCount < 2 && i < 50; i++) await page.waitForTimeout(20)
      assert.equal(checkCount, 2)
      if (action === 'login') await page.getByRole('button', { name: 'Login', exact: true }).click()
      if (action === 'logout') await page.getByRole('button', { name: 'Logout', exact: true }).click()
      const expected = action === 'logout' ? 'Signed out' : 'Signed in'
      await page.getByRole('heading', { name: expected, exact: true }).waitFor()
      for (const route of pending) await route.fulfill({ json: { data: { isAuthenticated: action === 'logout', user: action === 'logout' ? user : null } } })
      await page.waitForTimeout(400)
      assert.equal(await page.getByRole('heading', { name: expected, exact: true }).count(), 1)
      if (action === 'login') assert.equal(await page.evaluate(() => localStorage.getItem('cosmoscraft_token')), 'fresh-login')
      if (action === 'logout') assert.equal(await page.evaluate(() => localStorage.getItem('cosmoscraft_token')), null)
      assert.deepEqual(errors, [])
      await context.close()
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})

test('cached customers open their dashboard immediately but management routes require verification', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { createBrowserRouter, RouterProvider } from 'react-router';
      import { AuthProvider } from './src/app/context/AuthContext.jsx';
      import { ProtectedRoute } from './src/app/components/auth/ProtectedRoute.jsx';
      const router = createBrowserRouter([
        {path:'/dashboard',element:<ProtectedRoute><h1>Customer dashboard</h1></ProtectedRoute>},
        {path:'/admin',element:<ProtectedRoute allowedRoles={['admin']}><h1>Admin dashboard</h1></ProtectedRoute>},
        {path:'/login',element:<h1>Sign in</h1>}
      ]);
      createRoot(document.getElementById('root')).render(<AuthProvider><RouterProvider router={router}/></AuthProvider>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{}' },
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
    for (const [path, role] of [['dashboard', 'customer'], ['admin', 'customer'], ['admin', 'admin']]) {
      const context = await browser.newContext()
      const user = { id: 'user-1', role }
      await context.addInitScript(user => localStorage.setItem('cosmoscraft_auth', JSON.stringify(user)), user)
      let releaseCheck
      const started = new Promise(resolve => {
        context.route('**/auth/check', route => { releaseCheck = route; resolve() })
      })
      const page = await context.newPage()
      await page.goto(origin + '/' + path)
      await started
      if (path === 'dashboard') {
        await page.getByRole('heading', { name: 'Customer dashboard' }).waitFor()
        await releaseCheck.fulfill({ json: { data: { isAuthenticated: false } } })
        await page.getByRole('heading', { name: 'Sign in' }).waitFor()
        assert.equal(await page.evaluate(() => localStorage.getItem('cosmoscraft_auth')), null)
      } else {
        assert.equal(await page.getByRole('heading', { name: 'Admin dashboard' }).count(), 0)
        assert.equal(await page.getByRole('heading', { name: 'Sign in' }).count(), 0)
        await releaseCheck.fulfill({ json: { data: { isAuthenticated: false } } })
        await page.getByRole('heading', { name: 'Sign in' }).waitFor()
      }
      await context.close()
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
