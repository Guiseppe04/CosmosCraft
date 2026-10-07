import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'

test('policy modals preserve form data and synchronize agreement checkboxes on desktop and mobile', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/LegalPolicyPage.jsx','./src/app/components/LegalLinks.jsx','./src/app/components/SitePolicyModal.jsx','./src/app/components/SitePolicyAgreement.jsx','./src/app/pages/LoginPage.jsx','./src/app/components/auth/LoginModal.jsx'] })])
    .process((await readFile(new URL('../src/styles/globals.css',import.meta.url),'utf8')).replace(/^@import.*$/gm,''),{from:undefined})
  const fixture = await build({
    stdin:{resolveDir:fileURLToPath(new URL('../',import.meta.url)),loader:'jsx',contents:`
      import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
      import {createMemoryRouter,RouterProvider,Outlet} from 'react-router';
      import {TermsOfServicePage,PrivacyPolicyPage} from './src/app/pages/LegalPolicyPage.jsx';
      import {LegalLinks} from './src/app/components/LegalLinks.jsx';
      import {LoginPage} from './src/app/pages/LoginPage.jsx';
      import {LoginModal} from './src/app/components/auth/LoginModal.jsx';
      import SitePolicyAgreement from './src/app/components/SitePolicyAgreement.jsx';
      function Agreement(){const [checked,setChecked]=useState(false),[email,setEmail]=useState('');
        return <form onSubmit={e=>{e.preventDefault();window.submitted=true}}>
          <label>Email draft<input aria-label="Email draft" value={email} onChange={e=>setEmail(e.target.value)}/></label>
          <SitePolicyAgreement checked={checked} onChange={setChecked}/>
          <button type="submit" disabled={!checked}>Submit fixture</button>
        </form>}
      function Layout(){return <><Outlet/><footer className="p-6"><LegalLinks/></footer></>}
      const router=createMemoryRouter([{element:<Layout/>,children:[
        {path:'/login',element:<LoginPage/>},{path:'/modal',element:<LoginModal/>},
        {path:'/terms-of-service',element:<TermsOfServicePage/>},{path:'/privacy-policy',element:<PrivacyPolicyPage/>}
        ,{path:'/agreement',element:<Agreement/>}
      ]}],{initialEntries:[location.pathname]});
      createRoot(document.getElementById('root')).render(<RouterProvider router={router}/>);
    `},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'import.meta.env':'{}'},logLevel:'silent',
    plugins:[{name:'policy-auth-fixture',setup(builder){builder.onLoad({filter:/AuthContext\.jsx$/},()=>({loader:'js',contents:'export const useAuth=()=>({loginOpen:true,closeLogin:()=>{},login:()=>{},fetchUser:async()=>{}});'}))}}],
  })
  const server = createServer((req,res) => {
    if(req.url==='/bundle.js'){res.setHeader('Content-Type','application/javascript');return res.end(fixture.outputFiles[0].text)}
    if(req.url==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css.css)}
    if(req.url==='/api/contact/settings'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({data:{email:'contact@example.test',phone:'+639123456789'}}))}
    res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  let browser
  try {
    browser=await chromium.launch({headless:true})
    const page=await browser.newPage(), errors=[]
    page.on('pageerror',error=>errors.push(error.message))
    const origin=`http://127.0.0.1:${server.address().port}`
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:844})
      await page.goto(origin+'/login')
      await page.getByRole('link',{name:'Forgot password?',exact:true}).waitFor()
      assert.equal(await page.getByText('Remember me',{exact:true}).count(),0)
      const location=page.url()
      const termsButton=page.getByRole('navigation',{name:'Legal policies'}).getByRole('button',{name:'Terms of Service',exact:true})
      await termsButton.click()
      let dialog=page.getByRole('dialog',{name:'Terms of Service',exact:true})
      await dialog.waitFor()
      await dialog.getByRole('link',{name:'contact@example.test',exact:true}).waitFor()
      await dialog.locator('summary').click()
      await dialog.getByRole('heading',{name:'Order Terms and Conditions',exact:true}).waitFor()
      assert.equal(page.url(),location)
      assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth&&element.getBoundingClientRect().height<=innerHeight),true)
      await dialog.getByRole('tab',{name:'Privacy Policy',exact:true}).click()
      dialog=page.getByRole('dialog',{name:'Privacy Policy',exact:true})
      await dialog.waitFor()
      assert.equal(await dialog.getByRole('link',{name:'National Privacy Commission: data subject rights',exact:true}).getAttribute('href'),'https://privacy.gov.ph/data-subject-rights/')
      await dialog.getByRole('button',{name:'Done',exact:true}).focus()
      await page.keyboard.press('Tab')
      assert.equal(await dialog.getByRole('button',{name:'Close policy',exact:true}).evaluate(element=>element===document.activeElement),true)
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('dialog').count(),0)
      assert.equal(await termsButton.evaluate(element=>element===document.activeElement),true)
      assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden')

      await page.goto(origin+'/agreement')
      const draft=page.getByRole('textbox',{name:'Email draft',exact:true})
      await draft.fill('customer@example.test')
      const agreement=page.getByRole('checkbox',{name:'I agree to the Terms of Service and acknowledge the Privacy Policy.',exact:true})
      assert.equal(await agreement.isChecked(),false)
      await page.getByRole('button',{name:'Read Terms of Service',exact:true}).click()
      dialog=page.getByRole('dialog',{name:'Terms of Service',exact:true})
      await dialog.waitFor()
      assert.equal(await dialog.getByRole('checkbox').isChecked(),false,'opening a policy never grants consent')
      await dialog.getByRole('tab',{name:'Privacy Policy',exact:true}).click()
      dialog=page.getByRole('dialog',{name:'Privacy Policy',exact:true})
      await dialog.getByRole('checkbox').check()
      await dialog.getByRole('button',{name:'Done',exact:true}).click()
      assert.equal(await agreement.isChecked(),true)
      assert.equal(await draft.inputValue(),'customer@example.test')
      assert.equal(await page.getByRole('button',{name:'Submit fixture',exact:true}).isEnabled(),true)
      await agreement.uncheck()
      await page.getByRole('button',{name:'Read Privacy Policy',exact:true}).click()
      dialog=page.getByRole('dialog',{name:'Privacy Policy',exact:true})
      assert.equal(await dialog.getByRole('checkbox').isChecked(),false)
      assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth&&element.getBoundingClientRect().height<=innerHeight),true)
      await dialog.getByRole('button',{name:'Done',exact:true}).click()
      assert.equal(await page.evaluate(()=>window.submitted===true),false)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
    }
    await page.goto(origin+'/modal')
    await page.getByRole('button',{name:'Forgot password?',exact:true}).waitFor()
    assert.equal(await page.getByText('Remember me',{exact:true}).count(),0)
    assert.deepEqual(errors,[])
  } finally {await browser?.close();await new Promise(resolve=>server.close(resolve))}
})
