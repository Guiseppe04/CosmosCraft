import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

const { Server } = createRequire(new URL('../../server/package.json', import.meta.url))('socket.io')

test('guests receive live calendar changes and reach Confirmation; cart rows fit narrow screens', async () => {
  const css = await postcss([tailwindcss(tailwindConfig)]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })
  const fixture = await build({
    stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {createBrowserRouter, RouterProvider} from 'react-router';
      import {AuthProvider} from './src/app/context/AuthContext.jsx';
      import {SocketProvider} from './src/app/context/SocketContext.jsx';
      import ToastProvider from './src/app/components/ui/Toast.jsx';
      import {AppointmentPage} from './src/app/pages/AppointmentPage.jsx';
      import {LoginModal} from './src/app/components/auth/LoginModal.jsx';
      import {SelectableCartItemRow} from './src/app/components/cart/SelectableCartItemRow.jsx';
      import './src/styles/CartItems.css';
      function CartFixture(){
        const [quantity,setQuantity]=useState(1), [selected,setSelected]=useState(true);
        return <div style={{maxWidth:900,margin:'auto',padding:16}}>
          <SelectableCartItemRow item={{id:'product-1',name:'CosmosCraft premium electric guitar with a very long product name',category:'Electric Guitars',price:12000,stock:3,quantity}}
            isSelected={selected} onUpdateQuantity={(id,value)=>setQuantity(value)} onToggleSelect={()=>setSelected(value=>!value)} onRemove={()=>{}}/>
        </div>
      }
      const router=createBrowserRouter([{path:'/appointments',element:<><AppointmentPage/><LoginModal/></>},{path:'/cart-preview',element:<CartFixture/>}]);
      createRoot(document.getElementById('root')).render(<AuthProvider><ToastProvider><SocketProvider><RouterProvider router={router}/></SocketProvider></ToastProvider></AuthProvider>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, outfile: 'fixture.js', format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': '{}' },
  })
  let closed = false
  let bookings = 0
  const date = '2026-10-15'
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fixture.outputFiles.find(file => file.path.endsWith('.js')).text)
    }
    if (url.pathname === '/style.css') {
      res.setHeader('Content-Type', 'text/css')
      return res.end(css.css + '\n' + fixture.outputFiles.find(file => file.path.endsWith('.css')).text)
    }
    if (url.pathname.startsWith('/api/') || url.pathname === '/auth/check') {
      res.setHeader('Content-Type', 'application/json')
      let data = {}
      if (url.pathname === '/api/services') data = [{service_id:'service-1',name:'Guitar Setup',price:1000,duration_minutes:60,lead_time_days:1,is_active:true}]
      if (url.pathname.endsWith('/unavailable-dates')) data = {unavailable_dates:closed ? [{date}] : []}
      if (url.pathname.endsWith('/open-overrides')) data = {open_overrides:[]}
      if (url.pathname.endsWith('/available-dates')) data = {available_dates:[date],occupied_dates:[]}
      if (url.pathname.endsWith('/availability/slots')) data = {available_slots:[{formatted_start:'10:00 AM'}],availability_status:closed?'unavailable':'open',daily_appointments:0,max_daily_appointments:10}
      if (url.pathname === '/api/appointments' && req.method === 'POST') { bookings++; res.statusCode=401 }
      return res.end(JSON.stringify({status:'success',data}))
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>')
  })
  const io = new Server(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {})})
    const page = await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Manila'})
    const errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.clock.install({time:new Date('2026-10-07T04:00:00Z')})
    await page.addInitScript(() => sessionStorage.setItem('cosmoscraft.appointment.draft',JSON.stringify({
      currentStep:2,selectedServiceIds:['service-1'],guitarSelectionMode:'manual',homeServiceOption:'no',
      guitarDetails:{brand:'Fender',model:'Stratocaster',type:'electric',notes:''},
    })))
    const origin=`http://127.0.0.1:${server.address().port}`
    await page.goto(origin+'/appointments')
    const availableDay=page.getByRole('button',{name:new RegExp(date+'.*Available')})
    await expect(availableDay).toBeEnabled()
    await availableDay.click()
    await page.getByRole('button',{name:'10:00 AM',exact:true}).click()
    await expect(page.getByRole('button',{name:'Next',exact:true})).toBeEnabled()
    await expect.poll(()=>io.engine.clientsCount).toBe(1)
    closed=true
    io.emit('appointment:schedule_updated',{action:'unavailable_date_added',date})
    await expect(page.getByRole('button',{name:/15 - Unavailable.*shop has closed/})).toBeDisabled()
    await expect(page.getByRole('button',{name:'Next',exact:true})).toBeDisabled()
    closed=false
    io.emit('appointment:schedule_updated',{action:'unavailable_date_removed',date})
    await expect(availableDay).toBeEnabled()
    await availableDay.click()
    await page.getByRole('button',{name:'10:00 AM',exact:true}).click()
    await page.getByRole('button',{name:'Next',exact:true}).click()
    await page.getByRole('button',{name:'Next',exact:true}).click()
    await page.getByRole('button',{name:'Next',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Confirmation',exact:true})).toBeVisible()
    assert.equal(await page.getByText('Access token not found. Please sign in.').count(),0)
    await page.getByRole('button',{name:'Sign in to Complete',exact:true}).click()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    assert.equal(bookings,0)
    await page.goto(origin+'/cart-preview')
    for(const width of [320,390,768,1280]) {
      await page.setViewportSize({width,height:844})
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`cart should fit ${width}px`)
      await expect(page.getByRole('heading',{name:/CosmosCraft premium/})).toBeVisible()
    }
    await page.getByRole('button',{name:'Increase quantity'}).click()
    await page.getByRole('button',{name:'Increase quantity'}).click()
    await expect(page.getByRole('button',{name:'Increase quantity'})).toBeDisabled()
    await expect(page.getByText('₱36,000',{exact:true})).toBeVisible()
    assert.deepEqual(errors,[])
  } finally {
    await browser?.close()
    await new Promise(resolve=>io.close(resolve))
  }
})
