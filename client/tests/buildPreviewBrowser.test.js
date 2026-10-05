import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

test('export clips multiple rotated stickers, preserves their geometry and layers, and downloads both views', async () => {
  const fixture = await build({stdin:{contents:`
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {exportMaskedPreview,downloadPreviewImages} from './src/app/utils/exportMaskedPreview.js';
    import {captureBuildViews} from './src/app/utils/captureBuildViews.jsx';
    const png = draw => {const c=document.createElement('canvas');c.width=400;c.height=200;draw(c.getContext('2d'));return c.toDataURL()};
    const mask=png(ctx=>{ctx.fillStyle='white';ctx.fillRect(100,40,200,120)});
    const base=png(ctx=>{ctx.fillStyle='#007f00';ctx.fillRect(100,40,200,120)});
    const hardware=png(ctx=>{ctx.fillStyle='#0000ff';ctx.fillRect(190,85,20,30)});
    const sticker=png(ctx=>{ctx.fillStyle='#ff0000';ctx.fillRect(0,0,400,200)});
    const rearSticker=png(ctx=>{ctx.fillStyle='#ffff00';ctx.fillRect(0,0,400,200)});
    const stickers=[{id:'a',src:sticker,x:25,y:30,size:35,rotation:37,side:'front'},
      {id:'b',src:sticker,x:50,y:50,size:25,rotation:-23,side:'front'},
      {id:'c',src:rearSticker,x:30,y:50,size:35,rotation:19,side:'rear'}];
    function SamplePreview({view,stickerOverlay}) {
      const layer=(src,z)=> <div data-export-layer="true" style={{position:'absolute',inset:0,backgroundImage:'url('+src+')',backgroundSize:'contain',backgroundRepeat:'no-repeat',zIndex:z}} />;
      return <div data-export-stage="true" style={{position:'relative',width:400,height:200,transform:view==='rear'?'scaleX(-1)':'none'}}>
        {layer(base,0)}
        <div data-sticker-clip-mask-src={mask} style={{position:'absolute',inset:0,zIndex:25,maskImage:'url('+mask+')',maskSize:'contain',maskRepeat:'no-repeat'}}>{stickerOverlay}</div>
        {layer(hardware,40)}
      </div>
    }
    const overlay=stickers.filter(s=>s.side==='front').map(s=><img key={s.id} src={s.src} data-export-sticker="true" data-sticker-x={s.x} data-sticker-y={s.y} data-sticker-rotation={s.rotation}
      style={{position:'absolute',left:s.x+'%',top:s.y+'%',width:s.size+'%',transform:'translate(-50%, -50%) rotate('+s.rotation+'deg)'}} />);
    const root=createRoot(document.getElementById('root'));root.render(<SamplePreview view="front" stickerOverlay={overlay}/>);
    window.exportImage=()=>exportMaskedPreview(document.getElementById('root'),{download:false,background:'#141414',scale:1});
    window.exportBoth=async()=>{const images=await captureBuildViews(SamplePreview,{},stickers,{stickerMaskSrc:mask},{scale:1});downloadPreviewImages(images);return images};
    window.exportReadable=async()=>{
      const asymmetric=png(ctx=>{ctx.fillStyle='red';ctx.fillRect(0,0,200,200);ctx.fillStyle='white';ctx.fillRect(200,0,200,200);ctx.fillStyle='black';ctx.font='bold 100px sans-serif';ctx.fillText('R',220,140)});
      return captureBuildViews(SamplePreview,{},['front','rear'].map(side=>({id:side,src:asymmetric,x:50,y:50,size:25,rotation:23,side})),{stickerMaskSrc:mask},{scale:1});
    };
    window.compare=async(reference,actual)=>{
      const pixels=async(src)=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {data:ctx.getImageData(0,0,c.width,c.height).data,width:c.width,height:c.height}};
      const a=await pixels(reference),b=await pixels(actual);let differences=0,overflow=0;
      for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
        const i=(y*a.width+x)*4;
        if([0,1,2].some(k=>Math.abs(a.data[i+k]-b.data[i+k])>20))differences++;
        if((x<100||x>=300||y<40||y>=160)&&b.data[i]>100&&b.data[i+1]<50)overflow++;
      }
      const center=(100*a.width+200)*4;
      return {differences,overflow,width:b.width,height:b.height,hardware:[...b.data.slice(center,center+3)]};
    };
  `,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},logLevel:'silent'})
  const server=createServer((req,res)=>{
    res.setHeader('Content-Type',req.url==='/bundle.js'?'application/javascript':'text/html')
    res.end(req.url==='/bundle.js'?fixture.outputFiles[0].text:'<style>body{margin:0}#root{width:400px;height:200px;background:#141414}img{height:auto}</style><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage({acceptDownloads:true})
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.waitForFunction(()=>window.exportImage && [...document.images].every(img=>img.complete))
    const screenshot=await page.locator('#root').screenshot()
    const exported=await page.evaluate(()=>window.exportImage())
    const comparison=await page.evaluate(({reference,actual})=>window.compare(reference,actual),{reference:`data:image/png;base64,${screenshot.toString('base64')}`,actual:exported})
    assert.deepEqual([comparison.width,comparison.height],[400,200])
    assert.equal(comparison.overflow,0)
    assert.deepEqual(comparison.hardware,[0,0,255])
    assert.ok(comparison.differences<400*200*0.01,JSON.stringify(comparison))
    const downloads=[]
    let finishDownloads
    const allDownloads=new Promise(resolve=>{finishDownloads=resolve})
    page.on('download',download=>{downloads.push(download);if(downloads.length===2)finishDownloads()})
    const firstDownload=page.waitForEvent('download')
    const views=await page.evaluate(()=>window.exportBoth())
    await firstDownload
    await allDownloads
    assert.notEqual(views.front,views.rear)
    assert.deepEqual(downloads.map(download=>download.suggestedFilename()).sort(),['guitar-design-front.png','guitar-design-rear.png'])
    for(const download of downloads) assert.equal(await download.failure(),null)
    assert.equal(await page.locator('[data-capture-side]').count(),0)
    const readable=await page.evaluate(()=>window.exportReadable())
    const readability=await page.evaluate(({front,rear})=>window.compare(front,rear),readable)
    assert.ok(readability.differences < readability.width * readability.height * 0.001, 'rear stickers keep the original artwork and rotation')
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve))}
})

test('electric and bass saved-build baselines ignore loading/view changes but protect real edits and reset on save', async () => {
  const stylesheet=await postcss([tailwindcss(tailwindConfig)]).process((await readFile('src/styles/globals.css','utf8')).replace(/^@import.*$/gm,''),{from:'src/styles/globals.css'})
  const fixture=await build({stdin:{contents:`
    import React from 'react';import {createRoot} from 'react-dom/client';import {createMemoryRouter,RouterProvider} from 'react-router';
    import {CustomizePage} from './src/app/pages/CustomizePage.jsx';import {BassCustomizePage} from './src/app/pages/BassCustomizePage.jsx';
    const root=createRoot(document.getElementById('root'));let router;
    let mountVersion=0;
    window.mount=bass=>{router=createMemoryRouter([{path:'*',element:bass?<BassCustomizePage/>:<CustomizePage/>},{path:'/away',element:<h1>Left builder</h1>}],{initialEntries:[(bass?'/customize-bass':'/customize')+'?edit=saved']});root.render(<RouterProvider key={++mountVersion} router={router}/>)};
    window.leave=()=>router.navigate('/away');
  `,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',logLevel:'silent',loader:{'.css':'empty'},define:{'import.meta.env':'{}'},plugins:[{name:'isolated-builder',setup(builder){
    builder.onLoad({filter:/AuthContext\.jsx$/},()=>({loader:'js',contents:`const user={id:'customer',role:'customer'};export const useAuth=()=>({isAuthenticated:true,user});`}))
    builder.onLoad({filter:/CartContext\.jsx$/},()=>({loader:'js',contents:`const context={cart:[],addToCart:()=>{},setIsOpen:()=>{}};export const useCart=()=>context;`}))
    builder.onLoad({filter:/captureBuildViews\.jsx$/},()=>({loader:'js',contents:`export const captureBuildViews=async()=>({front:'data:image/png;base64,front-test',rear:'data:image/png;base64,rear-test'});`}))
  }}]})
  const saved=[]
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json')
    if(req.url==='/styles.css'){res.setHeader('Content-Type','text/css');return res.end(stylesheet.css)}
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');return res.end(fixture.outputFiles[0].text)}
    if(req.url.startsWith('/api/guitars/my-customizations')&&['POST','PUT'].includes(req.method)){
      let body='';for await(const chunk of req)body+=chunk;saved.push(JSON.parse(body));return res.end(JSON.stringify({data:{customization_id:'11111111-1111-4111-8111-111111111111'}}))
    }
    if(req.url.startsWith('/api/'))return res.end(JSON.stringify({data:[]}))
    res.setHeader('Content-Type','text/html');res.end('<link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const browser=await chromium.launch({headless:true})
  try {
    const page=await browser.newPage({viewport:{width:1920,height:1080}})
    const renderErrors=[];page.on('pageerror',error=>renderErrors.push(error.message))
    await page.route('https://**/*',route=>route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64')}))
    const url=`http://127.0.0.1:${server.address().port}`
    for(const bass of [false,true]){
      await page.goto(url)
      await page.evaluate(bass=>{
        const sticker={id:'front',src:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',x:35,y:50,size:18,rotation:20};
        const build={id:'saved',name:'Existing design',config:bass?{bassType:'vader',strings:'5'}:{body:'dc',strings:'7'},stickers:[sticker,{...sticker,id:'rear',side:'rear',rotation:-15}],...(bass?{dbCustomizationId:'22222222-2222-4222-8222-222222222222'}:{})};
        localStorage.setItem(bass?'cosmoscraft_saved_bass_builds':'cosmoscraft_saved_builds',JSON.stringify([build]));window.mount(bass)
      },bass)
      await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
      await page.getByRole('button',{name:'Rear View',exact:true}).click()
      await page.getByRole('button',{name:'Front View',exact:true}).click()
      await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
      await page.evaluate(()=>window.leave())
      await page.getByRole('heading',{name:'Left builder',exact:true}).waitFor()
      await page.evaluate(bass=>window.mount(bass),bass)
      await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
      await page.getByRole('button',{name:'Reset',exact:true}).click()
      await page.getByRole('button',{name:'Unsaved',exact:true}).waitFor()
      await page.evaluate(()=>window.leave())
      await page.getByRole('heading',{name:'Unsaved Changes',exact:true}).waitFor()
      await page.getByRole('button',{name:'Stay',exact:true}).click()
      await page.getByRole('button',{name:'Save Build',exact:true}).click()
      await page.getByRole('button',{name:'Saved',exact:true}).waitFor()
      const stored=await page.evaluate(bass=>JSON.parse(localStorage.getItem(bass?'cosmoscraft_saved_bass_builds':'cosmoscraft_saved_builds'))[0],bass)
      assert.deepEqual(stored.preview_images,{front:'data:image/png;base64,front-test',rear:'data:image/png;base64,rear-test'})
      assert.equal(stored.stickers.length,2)
      await page.evaluate(()=>window.leave())
      await page.getByRole('heading',{name:'Left builder',exact:true}).waitFor()
    }
    assert.equal(saved.length,2)
    for(const payload of saved) assert.deepEqual(payload.config_json._previewImages,{front:'data:image/png;base64,front-test',rear:'data:image/png;base64,rear-test'})
    assert.deepEqual(renderErrors,[])
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})
