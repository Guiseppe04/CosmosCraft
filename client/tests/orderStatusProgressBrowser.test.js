import assert from 'node:assert/strict'
import {test} from 'node:test'
import {createServer} from 'node:http'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'

for(const mode of ['status-modal','order-management','order-management-row'])test(`${mode} enables shipped after processing without reopening, including delayed responses`,async()=>{
  const fixture=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'jsx',contents:`
    import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
    import {OrderManagement} from './src/app/components/admin/OrderManagement.jsx';
    import {OrderStatusModal} from './src/app/pages/admin/components/modals/OrderStatusModal.jsx';
    import {adminApi} from './src/app/utils/adminApi.js';
    const order={order_id:'order-1',order_number:'ORD-1',status:'pending',payment_status:'approved',total_amount:1000,items:[]};
    window.modalCloseCount=0;window.calls=[];
    function StatusFixture(){
      const [modal,setModal]=useState({type:'order-status',data:order}),[form,setForm]=useState({order_id:'order-1',order_status:'pending'}),[saving,setSaving]=useState(false);
      return <OrderStatusModal modal={modal} form={form} setForm={setForm} closeModal={()=>{window.modalCloseCount++}} isSaving={saving} setIsSaving={setSaving}
        formatCurrency={String} showToast={()=>{}} fetchOrders={()=>{}} adminApi={adminApi}
        onOrderUpdated={(id,updated)=>{setModal(old=>({...old,data:{...old.data,...updated}}));setForm(old=>({...old,order_status:updated.status}))}}
        ORDER_STATUS_LIFECYCLE={['pending','processing','shipped'].map(value=>({value,label:value[0].toUpperCase()+value.slice(1)}))}
        ORDER_STATUS_TRANSITIONS={{pending:['processing'],processing:['shipped'],shipped:[]}}/>;
    }
    function OrdersFixture(){
      const [rows,setRows]=useState([order]);
      window.applyOrderSnapshot=(status)=>setRows([{...order,status,updated_at:new Date().toISOString()}]);
      return <OrderManagement orders={rows} initialOrder={${mode==='order-management-row'?'null':'order'}} user={{role:'admin'}} pagination={{}} onRefresh={async()=>({data:{orders:rows}})}/>;
    }
    createRoot(document.getElementById('root')).render(${mode==='status-modal'?'<StatusFixture/>':'<OrdersFixture/>'});
  `},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},logLevel:'silent',plugins:[{name:'status-fixture',setup(builder){
    builder.onLoad({filter:/SocketContext\.jsx$/},()=>({loader:'js',contents:`import {useEffect,useRef} from 'react';
      export const useSocketEvent=(name,callback)=>{const ref=useRef(callback);ref.current=callback;useEffect(()=>{window.socketCallbacks ||= {};window.socketCallbacks[name]=(data)=>ref.current(data);return()=>{delete window.socketCallbacks[name]}},[name])};
      export const useSocket=()=>({socket:null});`}))
    builder.onLoad({filter:/adminApi\.js$/},()=>({loader:'js',contents:`export const adminApi=new Proxy({}, {get:(_,method)=>(...args)=>{
      window.calls.push({method,args});
      if(method==='getOrder')return new Promise(resolve=>{window.finishDetails=()=>resolve({data:{order_id:'order-1',status:'pending',payment_status:'approved',items:[]}})});
      if(method==='updateOrder')return new Promise((resolve,reject)=>{window.finishSave=(success=true)=>success?resolve({data:{order_id:'order-1',status:args[1].status}}):reject(new Error('Save failed'))});
      return Promise.resolve({data:{photos:[],items:[]}});
    }});`}))
  }}]})
  const server=createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('Content-Type','text/javascript');res.end(fixture.outputFiles[0].text)}else{res.setHeader('Content-Type','text/html');res.end('<div id="root"></div><script src="/bundle.js"></script>')}})
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser
  try{
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    if(mode==='order-management-row')await page.getByRole('button',{name:'View Order Details',exact:true}).click()
    if(mode==='status-modal'){
      await page.getByRole('button',{name:'Processing',exact:true}).click()
      await page.getByRole('button',{name:'Update Status',exact:true}).click()
    }else await page.getByRole('button',{name:'Update Order Status',exact:true}).click()
    await page.waitForFunction(()=>typeof window.finishSave==='function')
    assert.equal(await page.getByRole('button',{name:'Shipped',exact:true}).isDisabled(),true)
    if(mode.startsWith('order-management')){
      // The server/list can confirm the saved status before the mutation response arrives.
      await page.evaluate(()=>window.applyOrderSnapshot('processing'))
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Shipped' && !button.disabled))
      await page.evaluate(()=>window.applyOrderSnapshot('pending'))
      await page.waitForTimeout(100)
      assert.equal(await page.getByRole('button',{name:'Shipped',exact:true}).isEnabled(),true)
    }
    if(mode==='status-modal'){
      await page.evaluate(()=>window.finishSave(false))
      await page.getByRole('button',{name:'Update Status',exact:true}).waitFor()
      assert.equal(await page.getByRole('button',{name:'Shipped',exact:true}).isDisabled(),true)
      await page.getByRole('button',{name:'Update Status',exact:true}).click()
      await page.waitForFunction(()=>window.calls.filter(call=>call.method==='updateOrder').length===2)
    }
    await page.evaluate(()=>window.finishSave())
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Shipped' && !button.disabled))
    if(mode.startsWith('order-management')){
      await page.evaluate(()=>window.finishDetails?.())
      await page.waitForTimeout(100)
      assert.equal(await page.getByRole('button',{name:'Shipped',exact:true}).isEnabled(),true)
    }
    assert.equal(await page.evaluate(()=>window.modalCloseCount),0)
    await page.getByRole('button',{name:'Shipped',exact:true}).click()
    if(mode.startsWith('order-management')){
      await page.evaluate(()=>window.socketCallbacks['order:updated']({order:{order_id:'order-1',status:'shipped',updated_at:new Date().toISOString()}}))
      await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent.trim()==='Out for Delivery' && !button.disabled))
    }
    assert.deepEqual(errors,[])
  }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})
