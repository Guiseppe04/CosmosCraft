import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

test('staff uses the admin workspace with working navigation, pagination, reports and logout', async () => {
  const globals = (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, '')
  const styles = await Promise.all(['responsive.css', 'AdminWorkspace.css'].map(name => readFile(new URL(`../src/styles/${name}`, import.meta.url), 'utf8')))
  const logo = await readFile(new URL('../public/logo-cosmos.png', import.meta.url))
  const css = await postcss([tailwindcss({ content: ['./src/**/*.{js,jsx}'] }), autoprefixer]).process([globals, ...styles].join('\n'), { from: undefined })
  const fixture = await build({
    stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router';
      import {ThemeProvider} from './src/app/context/ThemeContext.jsx';
      import {StaffDashboard} from './src/app/pages/StaffDashboard.jsx';
      window.apiCalls=[];window.loggedOut=false;
      const products=Array.from({length:30},(_,i)=>({product_id:'product-'+i,name:'Guitar '+String(i+1).padStart(2,'0'),sku:'SKU-'+i,stock:10,max_stock:20,price:100,category_name:'Guitars'}));
      const projects=Array.from({length:30},(_,i)=>({project_id:'project-'+i,name:'Build '+String(i+1).padStart(2,'0'),status:'not_started',guitar_type:'electric',progress:0,created_at:'2026-10-05T00:00:00Z'}));
      window.fixtureApi=new Proxy({}, {get:(_,method)=>async(params={})=>{
        window.apiCalls.push({method,params});
        if(method==='getSalesReport')return {data:{netSales:12345,totalTransactions:3,averagePerTransaction:4115,transactions:[],dailyTrend:[]}};
        if(method==='getProducts'||method==='getInventoryProducts')return {data:products};
        if(method==='getAllProjects'||method==='getArchivedProjects'){
          const rows=params.sort_dir==='asc'?[...projects].reverse():projects,page=Number(params.page)||1,size=Number(params.page_size)||10;
          return {data:rows.slice((page-1)*size,page*size),pagination:{page,page_size:size,total:30,total_pages:Math.ceil(30/size)}};
        }
        if(method==='getUnavailableDates')return {data:{unavailable_dates:[]}};
        if(method==='getAvailableDates')return {data:{available_dates:[]}};
        if(method==='getInventorySummary'||method==='getDailySummary')return {data:{}};
        return {data:[],pagination:{page:1,pageSize:10,total:0,totalPages:1}};
      }});
      createRoot(document.getElementById('root')).render(<BrowserRouter><ThemeProvider><StaffDashboard/></ThemeProvider></BrowserRouter>);`,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'staff-workspace-fixtures', setup(builder) {
      builder.onLoad({ filter: /\.css$/ }, () => ({ loader: 'empty', contents: '' }))
      builder.onLoad({ filter: /(?:adminApi|staffApi|posApi)\.js$/ }, ({path}) => {
        const name=path.match(/(adminApi|staffApi|posApi)\.js$/)[1]
        return { loader: 'js', contents: `export const ${name}=new Proxy({}, {get:(_,method)=>(...args)=>window.fixtureApi[method](...args)});` }
      })
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ loader: 'js', contents: `export const useAuth=()=>({user:{user_id:'staff-1',first_name:'Sam',email:'sam@example.test',role:'staff'},isAuthenticated:true,logout:async()=>{window.loggedOut=true;},hasPermission:()=>false});` }))
      builder.onLoad({ filter: /SocketContext\.jsx$/ }, () => ({ loader: 'js', contents: 'export const useSocketEvent=()=>{}; export const useSocket=()=>({socket:null});' }))
    } }],
  })
  const server = createServer((req, res) => {
    if (req.url === '/logo-cosmos.png') { res.setHeader('Content-Type', 'image/png'); return res.end(logo) }
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html data-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const nav = page.getByRole('navigation', { name: 'Staff navigation' })
    await nav.waitFor({ timeout: 10000 }).catch(error => { throw new Error(`${error.message}\n${errors.join('; ')}`) })
    const labels = ['Dashboard', 'Projects', 'Orders', 'Inventory', 'Appointments', 'POS', 'Sales Report']
    assert.deepEqual(await nav.getByRole('button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))), labels)
    await page.getByText('Staff', { exact: true }).waitFor()
    await page.getByText('Sam', { exact: true }).waitFor()
    assert.equal(await page.locator('.admin-sidebar').evaluate(element => element.getBoundingClientRect().width), 242)
    await page.getByRole('button', { name: 'Collapse navigation', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.admin-sidebar').getBoundingClientRect().width === 80)
    await nav.getByRole('button', { name: 'Inventory', exact: true }).click()
    await page.getByRole('heading', { name: 'Inventory', exact: true }).last().waitFor()
    assert.equal(await page.getByRole('button', { name: 'Add New Product' }).count(), 0)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByText('Guitar 11', { exact: true }).waitFor()
    await page.getByRole('combobox', { name: 'Records per page' }).selectOption('25')
    await page.getByText('Guitar 01', { exact: true }).waitFor()
    await page.getByText('Guitar 25', { exact: true }).waitFor()
    await nav.getByRole('button', { name: 'Projects', exact: true }).click()
    await page.getByRole('button', { name: 'Build 01', exact: true }).waitFor()
    assert.equal(await page.getByRole('button', { name: /Create Project|Default Workflow|New Project/ }).count(), 0)
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Build 11', exact: true }).waitFor()
    await page.getByRole('combobox', { name: 'Records per page' }).selectOption('25')
    await page.getByRole('button', { name: 'Build 25', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Sort & Filter', exact: true }).click()
    await page.getByRole('combobox', { name: 'Sort direction' }).selectOption('asc')
    await page.getByRole('button', { name: 'Build 30', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Reset filters and sort', exact: true }).click()
    await page.getByRole('button', { name: 'Build 01', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Archived Projects', exact: true }).click()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await page.getByRole('button', { name: 'Build 11', exact: true }).waitFor()
    await page.getByRole('combobox', { name: 'Records per page' }).selectOption('25')
    await page.getByRole('button', { name: 'Build 25', exact: true }).waitFor()
    await nav.getByRole('button', { name: 'Dashboard', exact: true }).click()
    await page.getByRole('button', { name: 'View detailed report', exact: true }).click()
    await page.getByRole('heading', { name: 'Sales Report', exact: true }).first().waitFor()
    await page.getByRole('button', { name: 'All Sales', exact: true }).waitFor()
    assert.equal(await nav.getByRole('button', { name: 'Sales Report', exact: true }).getAttribute('aria-current'), 'page')
    await page.getByRole('button', { name: 'Expand navigation', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.admin-sidebar').getBoundingClientRect().width === 242)
    await nav.getByRole('button', { name: 'Dashboard', exact: true }).click()
    const initialTheme = await page.locator('html').getAttribute('data-theme')
    await page.getByRole('button', { name: /Switch to .* mode/ }).click()
    assert.notEqual(await page.locator('html').getAttribute('data-theme'), initialTheme)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForFunction(() => document.querySelector('.admin-sidebar').getBoundingClientRect().width === 72)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    for (const label of ['Orders', 'Appointments', 'POS']) {
      await nav.getByRole('button', { name: label, exact: true }).click()
      await page.locator('.admin-topbar').getByRole('heading', { name: label, exact: true }).waitFor()
      assert.equal(await nav.getByRole('button', { name: label, exact: true }).getAttribute('aria-current'), 'page')
    }
    await page.locator('.admin-sidebar').getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByText('Are you sure you want to log out of the staff workspace?', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal(await page.evaluate(() => window.loggedOut), false)
    await page.locator('.admin-sidebar').getByRole('button', { name: 'Log out', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Log out', exact: true }).click()
    await page.waitForFunction(() => window.loggedOut === true && window.location.pathname === '/')
    assert.deepEqual(errors, [])
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
})
