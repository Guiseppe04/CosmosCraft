import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'
import {chromium} from '@playwright/test'
const require=createRequire(new URL('../../server/',import.meta.url))
const {createFixture,png}=require('./tests/helpers/orderRefundFixture')
const photos=require('./services/dispatchPhotoService')
test('customer gallery loads original photos, enlarges them and offers no staff-only controls',async()=>{
  const f=await createFixture();let browser,server
  try{
    await photos.transaction(f.ids.order,f.ids.admin,db=>photos.save(db,f.ids.order,'order',[{order_item_id:1,images:[png]}],f.ids.admin))
    await f.db.exec("UPDATE orders SET status='shipped'")
    await photos.append(f.ids.order,{id:f.ids.admin,role:'admin'},{reason:'Internal supplemental photo recorded for review.',itemPhotos:[{order_item_id:1,images:[png]}]})
    const bundle=await build({stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'jsx',contents:`
      import React from 'react';import {createRoot} from 'react-dom/client';import DispatchPhotoGallery from './src/app/components/DispatchPhotoGallery.jsx';
      const original=window.fetch;window.fetch=(url,options={})=>original(url,{...options,headers:{...options.headers,'x-test-actor':'customer'}});
      createRoot(document.getElementById('root')).render(<DispatchPhotoGallery orderId='${f.ids.order}' customerView allowAdd/>);
    `},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},logLevel:'silent'})
    f.app.get('/bundle.js',(req,res)=>res.type('js').send(bundle.outputFiles[0].text))
    f.app.get('/',(req,res)=>res.type('html').send('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script src="/bundle.js"></script>'))
    server=f.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve))
    browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message))
    for(const width of [1280,390]){
      await page.setViewportSize({width,height:844});await page.goto(`http://127.0.0.1:${server.address().port}`)
      const thumb=page.getByRole('button',{name:'Enlarge dispatch photo of Test Guitar',exact:true});await thumb.waitFor()
      assert.equal(await thumb.count(),1)
      assert.equal(await page.getByRole('button',{name:'Add supplemental photos',exact:true}).count(),0)
      assert.equal(await page.getByText(/Internal supplemental photo/).count(),0)
      assert.equal(await page.getByText(/Authorized uploader/).count(),0)
      await thumb.click()
      await page.waitForFunction(()=>document.querySelectorAll('img[alt="Dispatch photo of Test Guitar"]').length>0)
      await page.keyboard.press('Escape')
    }
    assert.deepEqual(errors,[])
  }finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await f.close()}
})
