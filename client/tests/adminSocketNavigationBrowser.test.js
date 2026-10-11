import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

const require = createRequire(new URL('../../server/', import.meta.url))
const { Server } = require('socket.io')

test('tab navigation retains its socket; transport recovery uses refreshed auth; cancellations retain AbortError', async () => {
  const fixture = await build({
    stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
      import React,{useEffect,useState} from 'react'; import {createRoot} from 'react-dom/client';
      import {SocketProvider,useSocket} from './src/app/context/SocketContext.jsx';
      import {adminApi} from './src/app/utils/adminApi.js';
      window.currentUser={user_id:'staff-1'};
      localStorage.setItem('cosmoscraft_token','first-token');
      window.api=adminApi;
      function Tabs(){const [tab,setTab]=useState('orders'); const [data,setData]=useState('');
        const {socket,isConnected}=useSocket(); window.testSocket=socket;
        useEffect(()=>{let active=true; adminApi.getProducts({tab}).then(()=>{if(active)setData(tab+' loaded')})
          .catch(error=>{if(active)window.errors.push(error.message)});return()=>{active=false}},[tab]);
        return <><span data-testid="connection">{isConnected?'connected':'disconnected'}</span>
          <span data-testid="loaded">{data}</span>{['orders','products','inventory'].map(name=><button key={name} onClick={()=>setTab(name)}>{name}</button>)}</>}
      function App(){const [,rerender]=useState(0);window.changeUser=user=>{window.currentUser=user;rerender(n=>n+1)};
        return <SocketProvider><Tabs/></SocketProvider>}
      window.errors=[];createRoot(document.getElementById('root')).render(<App/>);
    ` },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'socket-navigation-auth', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ loader: 'js', contents: 'export const useAuth=()=>({user:window.currentUser,isAuthenticated:!!window.currentUser});' }))
    } }],
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json')
      if (req.url.includes('tab=inventory')) res.setHeader('X-New-Access-Token', 'refreshed-token')
      return res.end(JSON.stringify({ data: [] }))
    }
    res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script src="/bundle.js"></script>')
  })
  const io = new Server(server)
  const handshakes = []
  io.on('connection', socket => { handshakes.push(socket.handshake.auth.token) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await expect(page.getByTestId('connection')).toHaveText('connected')
    const originalId = await page.evaluate(() => window.testSocket.id)
    for (const tab of ['products', 'inventory', 'orders']) {
      await page.getByRole('button', { name: tab, exact: true }).click()
      await expect(page.getByTestId('loaded')).toHaveText(tab + ' loaded')
      assert.equal(await page.evaluate(() => window.testSocket.id), originalId)
    }
    assert.deepEqual(handshakes, ['first-token'])
    assert.equal(await page.evaluate(() => localStorage.getItem('cosmoscraft_token')), 'refreshed-token')
    io.sockets.sockets.get(originalId).conn.close()
    await expect(page.getByTestId('connection')).toHaveText('disconnected')
    await page.getByRole('button', { name: 'products', exact: true }).click()
    await expect(page.getByTestId('loaded')).toHaveText('products loaded')
    await expect(page.getByTestId('connection')).toHaveText('connected')
    assert.deepEqual(handshakes, ['first-token', 'refreshed-token'])
    const newId = await page.evaluate(() => window.testSocket.id)
    await page.evaluate(() => window.changeUser({ user_id: 'staff-1', first_name: 'Updated profile' }))
    assert.equal(await page.evaluate(() => window.testSocket.id), newId)
    // Account changes must still reconnect, including user_id-only profiles.
    await page.evaluate(() => window.changeUser({ user_id: 'staff-2' }))
    await page.waitForFunction(id => window.testSocket?.connected && window.testSocket.id !== id, newId)
    assert.equal(handshakes.length, 3)
    const aborted = await page.evaluate(async () => {
      const controller = new AbortController(); controller.abort()
      try { await window.api.getAuditLogs({}, { signal: controller.signal }) }
      catch (error) { return { name: error.name, message: error.message } }
    })
    assert.equal(aborted.name, 'AbortError')
    assert.ok(!aborted.message.includes('Cannot reach the server'))
    await page.route('**/api/products**', route => route.abort('failed'))
    const failure = await page.evaluate(async () => {
      try { await window.api.getProducts() } catch (error) { return error.message }
    })
    assert.match(failure, /Cannot reach the server/)
    assert.deepEqual(await page.evaluate(() => window.errors), [])
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => io.close(resolve))
    if (server.listening) await new Promise(resolve => server.close(resolve))
  }
})
