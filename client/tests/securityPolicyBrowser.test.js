import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import policy from '../../shared/securityPolicy.cjs'

const require = createRequire(import.meta.url)
const express = require('../../server/node_modules/express')
const cors = require('../../server/node_modules/cors')
const socketService = require('../../server/services/socketService')
const { securityHeaders } = require('../../server/middleware/securityHeaders')
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')

test('document CSP preserves media, uploads, previews, API, Socket.IO and printing while reporting inline scripts', async () => {
  const api = express(); api.use(securityHeaders)
  let frontendOrigin
  api.use(cors({ origin: (origin, callback) => callback(null, origin === frontendOrigin), credentials: true }))
  api.get('/auth/check', (req, res) => res.json({ data: { isAuthenticated: false, user: null } }))
  api.get('/probe', (req, res) => res.json({ ok: true }))
  api.get('/uploads/pixel.png', (req, res) => res.type('png').send(pixel))
  const apiServer = createServer(api)
  await new Promise(resolve => apiServer.listen(0, '127.0.0.1', resolve))
  const apiOrigin = `http://127.0.0.1:${apiServer.address().port}`
  const env = { VITE_API_URL: apiOrigin, VITE_CLOUDINARY_CLOUD_NAME: 'policy-test', VITE_CLOUDINARY_UPLOAD_PRESET: 'fixture', DEV: false }
  const bundle = await build({
    stdin: { contents: `
      import React, {useEffect} from 'react'; import {createRoot} from 'react-dom/client';
      import {AuthProvider} from './src/app/context/AuthContext.jsx';
      import {SocketProvider,useSocket} from './src/app/context/SocketContext.jsx';
      import {uploadToCloudinary} from './src/app/utils/cloudinary.js';
      import {exportMaskedPreview} from './src/app/utils/exportMaskedPreview.js';
      import {printAppointmentReceipt} from './src/app/utils/appointmentReceipt.js';
      window.violations=[];
      document.addEventListener('securitypolicyviolation',e=>window.violations.push({directive:e.effectiveDirective,disposition:e.disposition,blocked:e.blockedURI}));
      window.upload=()=>uploadToCloudinary(new File(['test'],'image.png',{type:'image/png'}));
      window.apiProbe=()=>fetch('${apiOrigin}/probe',{credentials:'include'}).then(r=>r.json());
      window.exportPreview=()=>exportMaskedPreview(document.getElementById('root'),{download:false,scale:1});
      window.printReceipt=()=>printAppointmentReceipt({appointment_id:'fixture',scheduled_at:'2026-10-11T09:00:00Z'});
      function Probe(){const {socket,isConnected}=useSocket();useEffect(()=>{if(socket&&isConnected){window.socket=socket;window.socketTransport=socket.io.engine.transport.name;socket.io.engine.on('upgrade',transport=>{window.socketTransport=transport.name})}},[socket,isConnected]);
        return <div data-export-stage="true" style={{position:'relative',width:100,height:100}}>
          <div data-export-layer="true" style={{position:'absolute',inset:0,backgroundImage:'url(https://res.cloudinary.com/policy-test/image/upload/pixel.png)',backgroundSize:'contain',backgroundRepeat:'no-repeat'}}/>
          <img id="legacy" src="${apiOrigin}/uploads/pixel.png"/><img id="cloud" src="https://res.cloudinary.com/policy-test/image/upload/pixel.png"/>
        </div>;
      }
      createRoot(document.getElementById('root')).render(<AuthProvider><SocketProvider><Probe/></SocketProvider></AuthProvider>);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', logLevel: 'silent', define: { 'import.meta.env': JSON.stringify(env) },
  })
  const frontend = createServer((req, res) => {
    for (const [name,value] of Object.entries(policy.createFrontendHeaders(env, { development: true, documentOrigin: frontendOrigin }))) res.setHeader(name,value)
    if (req.url === '/bundle.js') {res.setHeader('Content-Type','application/javascript');return res.end(bundle.outputFiles[0].text)}
    res.setHeader('Content-Type','text/html');res.end('<style>body{font-family:Poppins}#root{width:100px;height:100px}</style><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => frontend.listen(0,'127.0.0.1',resolve))
  frontendOrigin=`http://127.0.0.1:${frontend.address().port}`
  const io = socketService.init(apiServer, [frontendOrigin])
  let browser
  try {
    browser=await chromium.launch({headless:true})
    const context=await browser.newContext()
    await context.route('https://res.cloudinary.com/**', route=>route.fulfill({contentType:'image/png',body:pixel,headers:{'Access-Control-Allow-Origin':'*'}}))
    await context.route('https://api.cloudinary.com/**', route=>route.fulfill({json:{secure_url:'https://res.cloudinary.com/policy-test/image/upload/pixel.png'},headers:{'Access-Control-Allow-Origin':'*'}}))
    await context.route('https://fonts.googleapis.com/**', route=>route.fulfill({contentType:'text/css',body:'@font-face{font-family:Poppins;src:url(https://fonts.gstatic.com/poppins-fixture.woff2)}',headers:{'Access-Control-Allow-Origin':'*'}}))
    // Font transfer is a controlled fixture; rendering uses a local fallback font.
    await context.route('https://fonts.gstatic.com/**', route=>route.fulfill({status:404,headers:{'Access-Control-Allow-Origin':'*'}}))
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message))
    const response=await page.goto(frontendOrigin)
    assert.equal(response.headers()['content-security-policy'],policy.documentBaseline)
    await page.waitForFunction(()=>window.socketTransport==='websocket')
    const pollHeaders=await fetch(apiOrigin+'/socket.io/?EIO=4&transport=polling', {headers:{Origin:frontendOrigin}})
    assert.equal(pollHeaders.headers.get('x-content-type-options'),'nosniff')
    assert.equal(pollHeaders.headers.get('access-control-allow-origin'),frontendOrigin)
    assert.deepEqual(await page.evaluate(()=>window.apiProbe()),{ok:true})
    assert.equal(await page.evaluate(()=>window.upload()),'https://res.cloudinary.com/policy-test/image/upload/pixel.png')
    await page.waitForFunction(()=>['legacy','cloud'].every(id=>document.getElementById(id)?.naturalWidth===1))
    assert.match(await page.evaluate(()=>window.exportPreview()),/^data:image\/png;base64,/)
    const popupPromise=page.waitForEvent('popup');await page.evaluate(()=>window.printReceipt());const popup=await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    assert.ok(await popup.locator('body').innerText())
    assert.equal(await popup.evaluate(()=>typeof window.onload),'function')
    // Exercise report-only behavior without allowing inline scripts in the candidate.
    await page.evaluate(()=>{const script=document.createElement('script');script.textContent='window.inlineProbeWorked=true';document.body.append(script)})
    await page.waitForFunction(()=>window.violations.some(v=>v.directive==='script-src-elem'&&v.disposition==='report'))
    const violations=await page.evaluate(()=>window.violations)
    assert.equal(await page.evaluate(()=>window.inlineProbeWorked),true)
    assert.deepEqual(violations.filter(v=>v.disposition==='enforce'),[])
    assert.deepEqual(violations.filter(v=>v.disposition==='report'&&!['script-src-elem','script-src'].includes(v.directive)),[])
    assert.deepEqual(errors,[])
    assert.deepEqual(await page.evaluate(()=>['camera','microphone','geolocation'].map(feature=>document.featurePolicy.allowsFeature(feature))),[false,false,false])
    await page.evaluate(()=>{const base=document.createElement('base');base.href='https://unapproved.example/';document.head.append(base)})
    await page.waitForFunction(()=>window.violations.some(v=>v.directive==='base-uri'&&v.disposition==='enforce'))
    assert.equal(await page.evaluate(()=>document.baseURI),frontendOrigin+'/')
    const framingPage=await context.newPage()
    const rejectedFrame=new Promise(resolve=>framingPage.on('console',message=>{if(message.text().includes('frame-ancestors'))resolve(message.text())}))
    await framingPage.setContent('<iframe src="'+frontendOrigin+'"></iframe>')
    assert.match(await rejectedFrame,/frame-ancestors/)
    await framingPage.close()
    await popup.close()
  } finally {
    await browser?.close()
    await new Promise(resolve=>io.close(resolve))
    await new Promise(resolve=>frontend.close(resolve))
  }
})
