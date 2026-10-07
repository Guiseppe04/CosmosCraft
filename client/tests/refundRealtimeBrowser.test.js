import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

const require = createRequire(new URL('../../server/', import.meta.url))
const { createFixture, png } = require('./tests/helpers/orderRefundFixture')
const sockets = require('./services/socketService')
const jwt = require('jsonwebtoken')
const rbac = require('./services/rbacService')

test('refund requests, open admin review, payment proof and receipt confirmation update over real WebSockets', async () => {
  const fixture = await createFixture()
  const originalRoleSummary = rbac.getUserRoleSummary
  const originalSecret = process.env.JWT_SECRET
  process.env.JWT_SECRET = 'isolated-refund-websocket-test-secret'
  rbac.getUserRoleSummary = async id => ({ role: id === fixture.ids.admin ? 'admin' : 'customer' })
  const tokens = Object.fromEntries(['admin','customer','other'].map(actor => [actor,jwt.sign({id:fixture.ids[actor]},process.env.JWT_SECRET)]))
  const bundle = await build({
    stdin:{ resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'jsx',contents:`
      import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
      import {SocketProvider,useSocket,useSocketEvent} from './src/app/context/SocketContext.jsx';
      import {useRefundRealtime} from './src/app/hooks/useRefundRealtime.js';
      import {RefundRequestsTab} from './src/app/pages/admin/tabs/RefundRequestsTab.jsx';
      import CustomerRefundTracking from './src/app/components/refunds/CustomerRefundTracking.jsx';
      import {adminApi} from './src/app/utils/adminApi.js';
      const actor=new URLSearchParams(location.search).get('actor');window.actor=actor;
      window.userId=${JSON.stringify(fixture.ids)}[actor];
      localStorage.setItem('cosmoscraft_token',${JSON.stringify(tokens)}[actor]);
      const originalFetch=window.fetch;
      window.fetch=(url,options={})=>originalFetch(url,{...options,headers:{...options.headers,'x-test-actor':actor}});
      window.refundEvents=[];window.refreshCount=0;
      function Observe(){const {socket,isConnected}=useSocket();window.testSocket=socket;window.socketConnected=isConnected;
        useSocketEvent('refund:created',event=>window.refundEvents.push(event));
        useSocketEvent('refund:updated',event=>window.refundEvents.push(event));return null;}
      function Customer(){const [order,setOrder]=useState(null);const refresh=async()=>{window.refreshCount++;const result=await adminApi.getMyOrders();setOrder(result.data.orders[0]||null)};
        useEffect(()=>{refresh()},[]);useRefundRealtime(refresh);
        return order?.has_refund_request ? <CustomerRefundTracking key={order.refund_request_id} order={order} onRefresh={refresh}/> : <p>No refund request</p>;}
      createRoot(document.getElementById('root')).render(<SocketProvider><Observe/>{actor==='admin'
        ? <RefundRequestsTab user={{role:'admin'}} showToast={message=>{window.toast=message}}/>
        : <Customer/>}</SocketProvider>);
    ` },bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},logLevel:'silent',
    plugins:[{name:'refund-test-auth',setup(builder){builder.onLoad({filter:/AuthContext\.jsx$/},()=>({loader:'js',contents:'export const useAuth=()=>({isAuthenticated:true,user:{id:window.userId}});'}))}}],
  })
  fixture.app.get('/bundle.js',(req,res)=>res.type('js').send(bundle.outputFiles[0].text))
  fixture.app.get('/',(req,res)=>res.type('html').send('<div id="root"></div><script src="/bundle.js"></script>'))
  const server = createServer(fixture.app)
  const io = sockets.init(server)
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const origin = `http://127.0.0.1:${server.address().port}`
  async function request(actor,path,body) {
    const result=await fetch(origin+'/api/orders'+path,{method:'POST',headers:{'Content-Type':'application/json','x-test-actor':actor},body:JSON.stringify(body)})
    const data=await result.json();assert.equal(result.ok,true,JSON.stringify(data));return data.data
  }
  async function status(id,value,options={}) {
    const result=await fetch(origin+`/api/orders/refund-requests/${id}/status`,{method:'PUT',headers:{'Content-Type':'application/json','x-test-actor':'admin'},body:JSON.stringify({status:value,...options})})
    const data=await result.json();assert.equal(result.ok,true,JSON.stringify(data));return data.data
  }
  let browser
  try {
    browser=await chromium.launch({headless:true})
    const errors=[]
    const admin=await browser.newPage(),customer=await browser.newPage(),other=await browser.newPage()
    for(const [page,actor] of [[admin,'admin'],[customer,'customer'],[other,'other']]) {
      page.on('pageerror',error=>errors.push(error.message))
      await page.goto(`${origin}/?actor=${actor}`)
      await page.waitForFunction(()=>window.socketConnected&&window.testSocket.io.engine.transport.name==='websocket')
    }
    await customer.getByText('No refund request',{exact:true}).waitFor()
    const refund=await request('customer',`/${fixture.ids.order}/refund-request`,{reason:'damaged',items:[{order_item_id:1,quantity:2}],destination:{method:'e_wallet',qrImage:png}})
    await admin.getByRole('cell',{name:'#TEST-ORDER',exact:true}).waitFor()
    await customer.getByRole('list',{name:'Refund progress'}).locator('[aria-current="step"]').getByText('1. Refund Requested',{exact:true}).waitFor()
    await admin.getByTitle('View Details',{exact:true}).click()
    await admin.getByRole('img',{name:'Customer E-Wallet QR code',exact:true}).waitFor()
    await status(refund.refund_request_id,'under_review')
    await admin.getByRole('button',{name:'Approve refund',exact:true}).waitFor()
    const notes=admin.getByLabel('Notes to customer / rejection reason')
    await notes.fill('Draft notes should survive an unchanged-status refresh.')
    sockets.emitRefundChanged({...refund,status:'under_review'})
    await admin.waitForResponse(response=>response.url().includes(`/refund-requests/${refund.refund_request_id}`)&&response.request().method()==='GET')
    assert.equal(await notes.inputValue(),'Draft notes should survive an unchanged-status refresh.')
    await status(refund.refund_request_id,'approved')
    await admin.getByRole('button',{name:'Start payment processing',exact:true}).waitFor()
    await status(refund.refund_request_id,'processing')
    await admin.getByRole('button',{name:'Mark refund sent',exact:true}).waitFor()
    await customer.getByRole('list',{name:'Refund progress'}).locator('[aria-current="step"]').getByText('4. Payment Processing',{exact:true}).waitFor()

    await customer.evaluate(()=>window.testSocket.disconnect())
    await customer.waitForFunction(()=>!window.socketConnected)
    await status(refund.refund_request_id,'refund_sent',{proofImage:png,refundReference:'REALTIME-REFUND-1'})
    await admin.getByRole('img',{name:'Proof of refund payment',exact:true}).waitFor()
    await customer.evaluate(()=>window.testSocket.connect())
    await customer.getByText('REALTIME-REFUND-1',{exact:true}).waitFor()
    await customer.getByRole('img',{name:'Proof of refund payment',exact:true}).waitFor()
    await customer.getByRole('button',{name:'Confirm refund received',exact:true}).click()
    await admin.getByRole('region',{name:'Admin refund review'}).getByRole('list',{name:'Refund progress'}).locator('[aria-current="step"]').getByText('6. Completed',{exact:true}).waitFor()
    assert.equal((await fixture.db.query('SELECT status FROM refund_requests')).rows[0].status,'completed')
    assert.equal((await other.evaluate(()=>window.refundEvents)).length,0,'another customer receives no private refund events')
    const events=await customer.evaluate(()=>JSON.stringify(window.refundEvents))
    assert.ok(!/base64|accountNumber|payment_destination|proofImage|qrImage/.test(events),'sockets contain no private destinations or files')
    assert.deepEqual(errors,[])
  } finally {
    await browser?.close()
    await new Promise(resolve=>io.close(resolve))
    rbac.getUserRoleSummary=originalRoleSummary
    if(originalSecret===undefined) delete process.env.JWT_SECRET;else process.env.JWT_SECRET=originalSecret
    await fixture.close()
  }
})
