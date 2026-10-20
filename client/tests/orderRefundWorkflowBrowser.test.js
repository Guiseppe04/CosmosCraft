import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import { readdirSync, readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const require = createRequire(new URL('../../server/', import.meta.url))
const { createFixture, png } = require('./tests/helpers/orderRefundFixture')
const image = { name: 'refund-qr.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') }
const componentDirectory = new URL('../src/app/components/refunds/', import.meta.url)
const css = await postcss([tailwindcss({ content: readdirSync(componentDirectory).map(file => ({ raw:readFileSync(new URL(file,componentDirectory),'utf8'),extension:'jsx' })) })])
  .process('@tailwind base; @tailwind components; @tailwind utilities;', { from:undefined })

for (const viewport of [{ width:1280,height:900 },{ width:390,height:844 }]) {
  test(`customer request → admin review → proof → customer confirmation at ${viewport.width}px using PostgreSQL`, async () => {
    const fixture = await createFixture()
    if (viewport.width === 390) {
      await fixture.db.query("UPDATE orders SET status='cancelled',notes='Customer cancellation reason (date): Changed mind',delivered_at=NULL WHERE order_id=$1", [fixture.ids.order])
      await fixture.db.query(`INSERT INTO refund_requests(order_id,user_id,reason,status,amount_requested)
        VALUES($1,$2,'Automatic refund request from order cancellation','pending',1000)`, [fixture.ids.order,fixture.ids.customer])
    }
    const bundle = await build({
      stdin: { resolveDir:fileURLToPath(new URL('../', import.meta.url)),loader:'jsx', contents:`
        import React,{useState} from 'react'; import {createRoot} from 'react-dom/client';
        import RefundDestinationForm from './src/app/components/refunds/RefundDestinationForm.jsx';
        import AdminRefundWorkflow from './src/app/components/refunds/AdminRefundWorkflow.jsx';
        import CustomerRefundTracking from './src/app/components/refunds/CustomerRefundTracking.jsx';
        import {emptyRefundDestination,refundDestinationError} from './src/app/utils/refundWorkflow.js';
        import {adminApi} from './src/app/utils/adminApi.js';
        const fetchOriginal=window.fetch;
        window.fetch=(url,options={})=>fetchOriginal(url,{...options,headers:{...options.headers,'x-test-actor':window.actor}});
        const root=createRoot(document.getElementById('root'));
        function CustomerForm(){const [value,setValue]=useState(emptyRefundDestination),[busy,setBusy]=useState(false),[reading,setReading]=useState(false),[error,setError]=useState('');
          return <form onSubmit={async e=>{e.preventDefault();setBusy(true);try{
            const result=await adminApi.createRefundRequest('${fixture.ids.order}',{reason:'damaged',items:[{order_item_id:1,quantity:2}],destination:value});
            window.refundId=result.data.refund_request_id;setError('Submitted successfully');
          }catch(error){setError(error.message)}finally{setBusy(false)}}}>
            <RefundDestinationForm value={value} onChange={setValue} disabled={busy||reading} onBusyChange={setReading}/>
            <button disabled={busy||reading||!!refundDestinationError(value)}>Submit refund request</button><p role="status">{error}</p>
          </form>}
        window.mountForm=()=>{window.actor='customer';root.render(<CustomerForm/>)};
        window.mountAdmin=async()=>{window.actor='admin';const result=await adminApi.getRefundRequest(window.refundId);root.render(<AdminRefundWorkflow key={result.data.status} refund={result.data} onUpdated={window.mountAdmin}/>)};
        window.mountTracking=async()=>{window.actor='customer';const result=await adminApi.getMyOrders();root.render(<CustomerRefundTracking order={result.data.orders[0]} onRefresh={window.mountTracking}/>)};
        window.mountForm();
      ` }, bundle:true,write:false,format:'iife',jsx:'automatic',define:{ 'import.meta.env':'{}' },logLevel:'silent',
    })
    fixture.app.get('/bundle.js',(req,res) => res.type('application/javascript').send(bundle.outputFiles[0].text))
    fixture.app.get('/styles.css',(req,res) => res.type('css').send(css.css))
    fixture.app.get('/',(req,res) => res.type('html').send('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><style>:root{--bg-primary:#111827;--surface-dark:#1f2937;--text-light:#f3f4f6;--text-muted:#9ca3af;--border:#374151;--gold-primary:#d4af37}body{background:var(--bg-primary);color:var(--text-light)}#root{max-width:800px;padding:16px;margin:auto}</style><div id="root"></div><script src="/bundle.js"></script>'))
    const server=fixture.app.listen(0,'127.0.0.1')
    await new Promise(resolve=>server.once('listening',resolve))
    let browser
    try {
      browser=await chromium.launch({headless:true})
      const page=await browser.newPage({viewport}),errors=[]
      page.on('pageerror',error=>errors.push(error.message))
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      const submit=page.getByRole('button',{name:'Submit refund request'})
      assert.equal(await submit.isDisabled(),true)
      await page.getByLabel('Preferred refund method').selectOption('e_bank')
      await page.getByLabel('Bank / E-Bank name').fill('Test Bank')
      assert.equal(await page.getByLabel('E-Wallet QR code (optional)').count(),0)
      await page.getByLabel('Preferred refund method').selectOption('e_wallet')
      const qrOnly = viewport.width < 640
      if (!qrOnly) {
        await page.getByLabel('E-Wallet provider').fill('GCash')
        await page.getByLabel('Account name',{exact:false}).fill('Customer Test')
        await page.getByLabel('Wallet account / mobile number').fill('09123456789')
      }
      await page.getByLabel('E-Wallet QR code (optional)').setInputFiles(image)
      await page.getByRole('img',{name:'E-Wallet QR code (optional)'}).waitFor()
      assert.equal(await page.getByLabel('E-Wallet provider').getAttribute('required'),null)
      assert.equal(await submit.isEnabled(),true)
      await page.getByRole('button',{name:'Remove image'}).click()
      assert.equal(await page.getByRole('img').count(),0)
      if (qrOnly) assert.equal(await submit.isDisabled(),true)
      assert.notEqual(await page.getByLabel('E-Wallet provider').getAttribute('required'),null)
      await page.getByLabel('E-Wallet QR code (optional)').setInputFiles(image)
      await page.getByRole('img',{name:'E-Wallet QR code (optional)'}).waitFor()
      await submit.click()
      await page.getByText('Submitted successfully').waitFor()
      await page.evaluate(()=>window.mountAdmin())
      if (qrOnly) assert.equal(await page.getByText('Provided via QR code',{exact:true}).count(),3)
      else await page.getByText('09123456789',{exact:true}).waitFor()
      await page.getByRole('img',{name:'Customer E-Wallet QR code'}).waitFor()
      await page.getByRole('button',{name:'Start review',exact:true}).click()
      await page.getByRole('button',{name:'Approve refund',exact:true}).click()
      await page.getByRole('button',{name:'Start payment processing',exact:true}).click()
      const send=page.getByRole('button',{name:'Mark refund sent',exact:true})
      assert.equal(await send.isDisabled(),true)
      await page.getByLabel('Transaction / reference number (optional)').fill('BROWSER-REFUND-123')
      await page.getByLabel('Proof of refund payment (required)').setInputFiles(image)
      await page.getByRole('img',{name:'Proof of refund payment (required)'}).waitFor()
      await send.click()
      await page.getByRole('button',{name:'Mark completed',exact:true}).waitFor()
      await page.evaluate(()=>window.mountTracking())
      await page.getByText('BROWSER-REFUND-123',{exact:true}).waitFor()
      await page.getByRole('img',{name:'Proof of refund payment',exact:true}).waitFor()
      const downloadPromise=page.waitForEvent('download')
      await page.getByRole('link',{name:'Download proof of refund payment',exact:true}).click()
      const download=await downloadPromise
      assert.match(download.suggestedFilename(),/-proof\.png$/)
      await page.getByRole('button',{name:'Confirm refund received',exact:true}).click()
      await page.getByText('Refund receipt confirmed.',{exact:true}).waitFor()
      const state=(await fixture.db.query('SELECT status,completed_by FROM refund_requests')).rows[0]
      assert.equal(state.status,'completed')
      assert.equal(state.completed_by,fixture.ids.customer)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true)
      assert.deepEqual(errors,[])
    } finally { await browser?.close();await new Promise(resolve=>server.close(resolve));await fixture.close() }
  })
}
