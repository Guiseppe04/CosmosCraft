import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

test('electric and bass builders fit phones, tablets and desktops with usable preview controls', async (t) => {
  // Include the app's global responsive rules; they hide generic asides on phones.
  const styles = await Promise.all(['globals.css', 'responsive.css', 'BuilderResponsive.css'].map(name => readFile(`src/styles/${name}`, 'utf8')))
  const stylesheet = await postcss([tailwindcss(tailwindConfig)]).process(
    styles.join('\n').replace(/^@import.*$/gm, ''),
    { from: 'src/styles/globals.css' },
  )
  const fixture = await build({
    stdin: {
      contents: `
        import React from 'react'; import {createRoot} from 'react-dom/client';
        import {createMemoryRouter,RouterProvider} from 'react-router';
        import {CustomizePage} from './src/app/pages/CustomizePage.jsx';
        import {BassCustomizePage} from './src/app/pages/BassCustomizePage.jsx';
        const root=createRoot(document.getElementById('root')); let version=0;
        window.mount=(bass,authenticated)=>{
          window.authenticated=authenticated;
          const router=createMemoryRouter([{path:'*',element:bass?<BassCustomizePage/>:<CustomizePage/>}]);
          root.render(<RouterProvider key={++version} router={router}/>);
        };
      `,
      resolveDir: process.cwd(),
      loader: 'jsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    logLevel: 'silent',
    loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}' },
    plugins: [{
      name: 'isolated-builder',
      setup(builder) {
        builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({
          loader: 'js',
          contents: `const user={id:'customer',role:'customer'}; export const useAuth=()=>({isAuthenticated:window.authenticated,user,openLogin:()=>{}});`,
        }))
        builder.onLoad({ filter: /CartContext\.jsx$/ }, () => ({
          loader: 'js',
          contents: `const context={cart:[],addToCart:()=>{},setIsOpen:()=>{}}; export const useCart=()=>context;`,
        }))
      },
    }],
  })
  const server = createServer(async (req, res) => {
    // Use the actual layered instrument assets in visual layout checks.
    if (req.url.startsWith('/builder/')) {
      const assetUrl = new URL(`../public${req.url}`, import.meta.url)
      const publicRoot = new URL('../public/', import.meta.url)
      if (assetUrl.href.startsWith(publicRoot.href)) {
        try {
          const asset = await readFile(assetUrl)
          res.setHeader('Content-Type', 'image/png')
          return res.end(asset)
        } catch {
          res.statusCode = 404
          return res.end()
        }
      }
      res.statusCode = 404
      return res.end()
    }
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css')
      return res.end(stylesheet.css)
    }
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(fixture.outputFiles[0].text)
    }
    if (req.url.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json')
      return res.end(JSON.stringify({ data: [] }))
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ hasTouch: true })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('https://**/*', route => route.fulfill({
      contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'),
    }))
    for (const bass of [false, true]) {
      for (const [width, height] of [[320, 568], [390, 844], [416, 826], [600, 960], [768, 1024], [1024, 768], [1280, 800], [1536, 864], [1920, 1080], [1920, 600], [812, 375]]) {
        t.diagnostic(`${bass ? 'bass' : 'electric'} ${width}x${height}`)
        await page.setViewportSize({ width, height })
        await page.goto(`http://127.0.0.1:${server.address().port}`)
        // The longer guest badge must also clear the zoom controls on narrow phones.
        await page.evaluate(({bass, width}) => { document.documentElement.setAttribute('data-theme', width === 416 ? 'light' : 'dark'); window.mount(bass, false) }, {bass, width})
        const preview = page.getByRole('main', { name: 'Instrument preview' })
        const options = page.getByRole('complementary', { name: 'Customization options' })
        const summary = page.getByRole('complementary', { name: 'Build summary' })
        await preview.waitFor().catch(async error => {
          const layout = await page.evaluate(() => [...document.querySelectorAll('#root, #root > div, main, aside')].map(el => ({ name: el.getAttribute('aria-label'), height: el.clientHeight, className: el.className })))
          t.diagnostic(JSON.stringify(layout))
          t.diagnostic(JSON.stringify(errors))
          throw error
        })
        const previewBox = await preview.boundingBox()
        const label = `${bass ? 'bass' : 'electric'} ${width}x${height}`
        const cardBox = await preview.locator('[data-builder-preview-card]').boundingBox()
        const stageBox = await preview.locator('[data-export-stage="true"]').boundingBox()
        assert.ok(stageBox.height > 20 && stageBox.height <= cardBox.height - 100, `${label}: instrument fits the preview height`)
        if (width < 768) {
          assert.ok(stageBox.width >= cardBox.width * 0.75, `${label}: instrument uses the available mobile width`)
        }
        if (process.env.CUSTOMIZE_SCREENSHOTS && [390, 416, 768, 1920].includes(width)) {
          await page.screenshot({ path: `${process.env.CUSTOMIZE_SCREENSHOTS}/${bass ? 'bass' : 'electric'}-${width}x${height}.png` })
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: horizontal overflow`)
        if (width >= 1536) {
          const optionsBox = await options.boundingBox()
          const summaryBox = await summary.boundingBox()
          assert.ok(optionsBox.x < previewBox.x && previewBox.x < summaryBox.x, `${label}: desktop columns`)
        } else {
          const trigger = page.getByRole('button', { name: /Parts & Price/ })
          const triggerBox = await trigger.boundingBox()
          assert.ok(triggerBox.y + triggerBox.height <= height && triggerBox.height >= 44, `${label}: drawer button visible in viewport`)
          assert.match(await trigger.textContent(), /\u20b1/, `${label}: total visible before opening drawer`)
          await trigger.tap()
          const drawer = page.getByRole('dialog', { name: 'Configure your build' })
          await drawer.waitFor()
          const drawerBox = await drawer.boundingBox()
          assert.ok(drawerBox.x >= 0 && drawerBox.y >= 0 && drawerBox.x + drawerBox.width <= width && drawerBox.y + drawerBox.height <= height, `${label}: drawer fits viewport`)
          const parts = drawer.getByRole('region', { name: 'Customization options' })
          await parts.waitFor()
          await parts.locator('button').first().tap()
          await parts.getByRole('button', { name: 'Hardware', exact: true }).tap()
          await parts.locator('.builder-options-scroll button').nth(1).tap()
          const selectedPart = await parts.locator('.builder-options-scroll button').nth(1).locator('div').first().innerText()
          await drawer.getByRole('tab', { name: 'Price breakdown', exact: true }).tap()
          await drawer.getByRole('region', { name: 'Build summary' }).waitFor()
          assert.ok(await drawer.getByText('Your Configuration', { exact: true }).isVisible(), `${label}: price breakdown visible`)
          assert.ok((await drawer.innerText()).includes(selectedPart.split('\n')[0]), `${label}: selected part appears in price breakdown`)
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: drawer overflow`)
          if (process.env.CUSTOMIZE_SCREENSHOTS && [416, 768].includes(width)) {
            await page.screenshot({ path: `${process.env.CUSTOMIZE_SCREENSHOTS}/${bass ? 'bass' : 'electric'}-drawer-price-${width}.png` })
          }
          await drawer.getByRole('tab', { name: 'Parts', exact: true }).tap()
          await parts.waitFor()
          if (process.env.CUSTOMIZE_SCREENSHOTS && [416, 768].includes(width)) {
            await page.screenshot({ path: `${process.env.CUSTOMIZE_SCREENSHOTS}/${bass ? 'bass' : 'electric'}-drawer-parts-${width}.png` })
          }
          await drawer.getByRole('button', { name: 'Done', exact: true }).tap()
          await drawer.waitFor({ state: 'hidden' })
          await expect(trigger, `${label}: focus returns to drawer trigger`).toBeFocused()
          await trigger.tap()
          await expect(drawer.getByRole('button', { name: 'Close configurator', exact: true })).toBeFocused()
          await page.keyboard.press('Escape')
          await drawer.waitFor({ state: 'hidden' })
          // Closing the drawer must keep the configuration and page scrolling usable.
          await trigger.tap()
          await parts.getByRole('button', { name: 'Hardware', exact: true }).waitFor()
          await drawer.getByRole('button', { name: 'Close configurator', exact: true }).tap()
          await drawer.waitFor({ state: 'hidden' })
          if (width === 416) {
            await trigger.tap()
            await drawer.waitFor()
            await page.setViewportSize({ width: 1920, height: 1080 })
            await drawer.waitFor({ state: 'hidden' })
            await options.waitFor()
            await options.locator('button').first().tap()
            await options.getByRole('button', { name: 'Body', exact: true }).tap()
            await page.setViewportSize({ width, height })
            await trigger.waitFor()
            await trigger.tap()
            await parts.getByRole('button', { name: 'Body', exact: true }).waitFor()
            await drawer.getByRole('button', { name: 'Close configurator', exact: true }).tap()
            await drawer.waitFor({ state: 'hidden' })
          }
        }
        const controls = ['Front View', 'Rear View', 'Zoom in', 'Zoom out', 'Reset zoom', 'Sign in to save']
        const boxes = []
        for (const name of controls) {
          const box = await preview.getByRole('button', { name, exact: true }).boundingBox()
          const compactZoom = width >= 1280 && ['Zoom in', 'Zoom out', 'Reset zoom'].includes(name)
          const minSize = compactZoom ? 32 : 44
          assert.ok(box.width >= minSize && box.height >= minSize, `${label}: ${name} target size`)
          if (compactZoom) assert.ok(box.height < 44, `${label}: compact desktop zoom`)
          assert.ok(box.x >= 0 && box.x + box.width <= width, `${label}: ${name} stays on screen`)
          boxes.push({ name, ...box })
        }
        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i], b = boxes[j]
            const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
            assert.equal(overlaps, false, `${label}: ${a.name} overlaps ${b.name}`)
          }
        }
        await preview.getByRole('button', { name: 'Rear View', exact: true }).tap()
        await preview.getByRole('button', { name: 'Zoom in', exact: true }).tap()
        assert.equal(await preview.getByRole('button', { name: 'Reset zoom' }).textContent(), '110%')
        await preview.getByRole('button', { name: 'Reset zoom' }).tap()
        assert.equal(await preview.getByRole('button', { name: 'Reset zoom' }).textContent(), '100%')
        await preview.getByRole('button', { name: 'Expand sticker panel' }).tap()
        await preview.getByRole('button', { name: 'Collapse sticker panel' }).waitFor()
        const addBox = await preview.getByRole('button', { name: 'Add Sticker', exact: true }).boundingBox()
        const currentCardBox = await preview.locator('[data-builder-preview-card]').boundingBox()
        const stickerPanelBox = await preview.locator('.builder-sticker-panel').boundingBox()
        if (width < 768) {
          assert.ok(stickerPanelBox.y >= currentCardBox.y + currentCardBox.height, `${label}: mobile stickers below preview`)
        } else {
          assert.ok(stickerPanelBox.y >= currentCardBox.y && stickerPanelBox.y <= currentCardBox.y + 32, `${label}: stickers in preview upper-right`)
          assert.ok(stickerPanelBox.x + stickerPanelBox.width <= currentCardBox.x + currentCardBox.width, `${label}: sticker panel stays inside preview width`)
          const frontBox = await preview.getByRole('button', { name: 'Front View', exact: true }).boundingBox()
          const rearBox = await preview.getByRole('button', { name: 'Rear View', exact: true }).boundingBox()
          assert.ok(addBox.x >= Math.max(frontBox.x + frontBox.width, rearBox.x + rearBox.width), `${label}: stickers clear view controls`)
        }
        await preview.getByRole('button', { name: 'Load Build', exact: true }).tap()
        await page.getByRole('heading', { name: 'Load Saved Build' }).waitFor()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: load modal overflow`)
        await page.getByRole('button', { name: 'Cancel', exact: true }).tap()
        if (width >= 1536) {
          await options.locator('button').first().tap()
          await options.getByRole('button', { name: 'Hardware', exact: true }).tap()
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${label}: hardware options overflow`)
        }
      }
    }
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
