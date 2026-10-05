import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import tailwindConfig from '../tailwind.config.js'

test('stickers support mouse and touch editing, deselection, layers and persistence in both builders', async t => {
  const styles = await Promise.all(['globals.css', 'responsive.css', 'BuilderResponsive.css'].map(name => readFile(`src/styles/${name}`, 'utf8')))
  const stylesheet = await postcss([tailwindcss(tailwindConfig)]).process(styles.join('\n').replace(/^@import.*$/gm, ''), { from: 'src/styles/globals.css' })
  const fixture = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {createMemoryRouter,RouterProvider} from 'react-router';
    import {CustomizePage} from './src/app/pages/CustomizePage.jsx';
    import {BassCustomizePage} from './src/app/pages/BassCustomizePage.jsx';
    const root=createRoot(document.getElementById('root'));let version=0;
    window.mount=bass=>root.render(<RouterProvider key={++version} router={createMemoryRouter([{path:'*',element:bass?<BassCustomizePage/>:<CustomizePage/>}])}/>);
  `, resolveDir: process.cwd(), loader: 'jsx' }, bundle: true, write: false, format: 'iife', logLevel: 'silent',
    loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' }, plugins: [{ name: 'fixture', setup(builder) {
      builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({ loader: 'js', contents: `const user={id:'customer',role:'customer'};export const useAuth=()=>({isAuthenticated:true,user,openLogin:()=>{}})` }))
      builder.onLoad({ filter: /CartContext\.jsx$/ }, () => ({ loader: 'js', contents: `const context={cart:[],addToCart:()=>{},setIsOpen:()=>{}};export const useCart=()=>context` }))
      builder.onLoad({ filter: /captureBuildViews\.jsx$/ }, () => ({ loader: 'js', contents: `export const captureBuildViews=async()=>({front:'preview-front',rear:'preview-rear'})` }))
    } }] })
  const server = createServer(async (req, res) => {
    if (req.url.startsWith('/builder/')) {
      const url = new URL(`../public${req.url}`, import.meta.url)
      if (url.href.startsWith(new URL('../public/', import.meta.url).href)) {
        try { res.setHeader('Content-Type', 'image/png'); return res.end(await readFile(url)) } catch { res.statusCode = 404; return res.end() }
      }
    }
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(stylesheet.css) }
    if (req.url.startsWith('/api/')) { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ data: [] })) }
    res.setHeader('Content-Type', 'text/html'); res.end('<link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const browser = await chromium.launch({ headless: true })
  try {
    for (const bass of [false, true]) for (const width of [1920, 768, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, hasTouch: true })
      page.setDefaultTimeout(10000)
      t.diagnostic(`${bass ? 'bass' : 'electric'} ${width}px`)
      const errors = []; page.on('pageerror', error => errors.push(error.message))
      await page.goto(`http://127.0.0.1:${server.address().port}`)
      await page.waitForFunction(() => window.mount)
      await page.evaluate(bass => window.mount(bass), bass)
      const draftKey = `cosmoscraft.${bass ? 'bassBuild' : 'electricBuild'}.stickerDraft`
      const state = () => page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).stickers, draftKey)
      const cdp = await page.context().newCDPSession(page)
      const gesture = async (from, to) => {
        if (width >= 1024) {
          await page.mouse.move(from.x, from.y); await page.mouse.down()
          await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up()
        } else {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] })
          for (let n = 1; n <= 8; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + (to.x - from.x) * n / 8, y: from.y + (to.y - from.y) * n / 8 }] })
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        }
      }
      const center = async locator => { const b = await locator.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
      for (const side of ['front', 'rear']) {
        await page.getByRole('button', { name: side === 'front' ? 'Front View' : 'Rear View', exact: true }).click()
        // A tall image exercises proportional resizing and body auto-placement.
        const png = await page.evaluate(() => {
          const c = document.createElement('canvas'); c.width = 60; c.height = 100
          const ctx = c.getContext('2d'); ctx.fillStyle = '#ff00cc'; ctx.fillRect(0, 0, 60, 100)
          ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 15, 100); ctx.fillStyle = 'black'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('R', 18, 65)
          return c.toDataURL().split(',')[1]
        })
        await page.locator('input[type=file]').setInputFiles({ name: 'sticker.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
        await page.locator('[data-sticker-selection]').waitFor()
        await page.getByRole('button', { name: 'Rotate sticker', exact: true }).waitFor()
        await page.locator('.builder-preview-viewport').scrollIntoViewIfNeeded()
        await page.waitForTimeout(650) // Finish instrument view/zoom transitions before measuring gestures.
        const before = (await state()).find(s => s.side === side)
        const outline = page.locator('.sticker-selection-box')
        const origin = await center(outline)
        // No snap to the grab point, even when grabbing away from the center.
        await gesture({ x: origin.x + 3, y: origin.y }, { x: origin.x + 15, y: origin.y + 8 })
        const dragged = (await state()).find(s => s.id === before.id)
        assert.notEqual(dragged.x, before.x)
        assert.notEqual(dragged.y, before.y)
        assert.equal(dragged.size, before.size)
        const handle = page.getByRole('button', { name: 'Resize sticker bottom-right', exact: true })
        const resizeStart = await center(handle), anchor = await center(outline)
        await gesture(resizeStart, { x: resizeStart.x + (resizeStart.x - anchor.x) * 0.2, y: resizeStart.y + (resizeStart.y - anchor.y) * 0.2 })
        const resized = (await state()).find(s => s.id === before.id)
        assert.ok(resized.size > dragged.size)
        assert.equal(resized.x, dragged.x); assert.equal(resized.y, dragged.y)
        const rotateStart = await center(page.getByRole('button', { name: 'Rotate sticker', exact: true }))
        const rotateCenter = await center(outline)
        await gesture(rotateStart, { x: rotateCenter.x + 40, y: rotateCenter.y - 20 })
        const rotated = (await state()).find(s => s.id === before.id)
        assert.notEqual(rotated.rotation, resized.rotation)
        assert.equal(rotated.x, resized.x); assert.equal(rotated.y, resized.y); assert.equal(rotated.size, resized.size)
        assert.equal(rotated.aspectRatio, 0.6)
        const display = await page.locator(`img[data-export-sticker][aria-pressed="true"]`).evaluate(img => {
          const stage = img.closest('[data-export-stage]')
          const matrix = new DOMMatrix(getComputedStyle(stage).transform).multiply(new DOMMatrix(getComputedStyle(img).transform))
          return { determinant: matrix.a * matrix.d - matrix.b * matrix.c, angle: (Math.atan2(matrix.b, matrix.a) * 180 / Math.PI + 360) % 360 }
        })
        assert.ok(display.determinant > 0, 'sticker artwork is never mirrored, including rear views')
        assert.ok(Math.abs(display.angle - rotated.rotation) < 0.01, 'sticker rotation has the same direction on both views')
        if (bass && side === 'rear' && [390, 1920].includes(width)) {
          await mkdir('node_modules/.cache/sticker-editor', { recursive: true })
          await page.screenshot({ path: `node_modules/.cache/sticker-editor/bass-${width}.png`, fullPage: true })
        }
        for (const box of await page.locator('.sticker-handle').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))) {
          assert.ok(box.width >= 44 && box.height >= 44)
          assert.ok(box.x >= -0.1 && box.x + box.width <= width + 0.1)
          assert.ok(box.y >= -0.1 && box.y + box.height <= 1000.1)
        }
        const pan = await page.locator('.builder-preview-stage').getAttribute('style')
        assert.ok(pan.includes('translate(0px, 0px)'), 'sticker gestures do not pan the instrument')
        await page.getByRole('button', { name: 'Duplicate sticker', exact: true }).click()
        const duplicated = await state(), copy = duplicated.at(-1)
        assert.equal(copy.rotation, rotated.rotation); assert.equal(copy.size, rotated.size)
        await page.getByRole('button', { name: 'Expand sticker panel', exact: true }).click()
        await page.getByRole('button', { name: 'Lower sticker layer', exact: true }).click()
        assert.equal((await state()).filter(s => s.side === side)[0].id, copy.id)
        await page.getByRole('button', { name: 'Delete sticker', exact: true }).click()
        await page.locator('[data-sticker-selection]').waitFor({ state: 'hidden' })
        await page.getByRole('button', { name: 'Select sticker 1 from library', exact: true }).click()
        await page.locator('[data-sticker-selection]').waitFor()
        await page.keyboard.press('Escape')
        await page.locator('[data-sticker-selection]').waitFor({ state: 'hidden' })
        await page.getByRole('button', { name: 'Select sticker 1 from library', exact: true }).click()
        await page.locator('[data-sticker-selection]').waitFor()
        await page.locator('.builder-preview-viewport').click({ position: { x: 5, y: 5 } })
        await page.locator('[data-sticker-selection]').waitFor({ state: 'hidden' })
        await page.getByRole('button', { name: 'Collapse sticker panel', exact: true }).click()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow')
      }
      const saved = await state()
      await page.getByRole('button', { name: 'Save Build', exact: true }).click()
      await page.waitForFunction(() => JSON.parse(localStorage.getItem('cosmoscraft_saved_builds') || '[]').length || JSON.parse(localStorage.getItem('cosmoscraft_saved_bass_builds') || '[]').length)
      const savedDesign = await page.evaluate(bass => JSON.parse(localStorage.getItem(bass ? 'cosmoscraft_saved_bass_builds' : 'cosmoscraft_saved_builds'))[0], bass)
      assert.deepEqual(savedDesign.stickers, saved)
      await page.reload(); await page.waitForFunction(() => window.mount)
      await page.evaluate(bass => window.mount(bass), bass)
      await page.getByRole('button', { name: /Load Build/ }).click()
      await page.getByRole('heading', { name: 'Load Saved Build' }).waitFor()
      await page.locator('h4').filter({ hasText: savedDesign.name }).click()
      assert.deepEqual(await state(), saved)
      if (bass && width === 320) {
        await page.getByRole('button', { name: 'Rear View', exact: true }).click()
        await page.getByRole('button', { name: 'Expand sticker panel', exact: true }).click()
        await page.getByRole('button', { name: 'Select sticker 1 from library', exact: true }).click()
        await page.getByRole('button', { name: 'Collapse sticker panel', exact: true }).click()
        for (let count = saved.length; count < 10; count++) {
          await page.getByRole('button', { name: 'Duplicate sticker', exact: true }).click()
        }
        assert.equal((await state()).length, 10)
        assert.equal(await page.getByRole('button', { name: 'Add Sticker', exact: true }).isDisabled(), true)
        assert.equal(await page.getByRole('button', { name: 'Duplicate sticker', exact: true }).isDisabled(), true)
        await page.getByRole('button', { name: 'Delete sticker', exact: true }).click()
        assert.equal((await state()).length, 9)
        assert.equal(await page.getByRole('button', { name: 'Add Sticker', exact: true }).isDisabled(), false)
      }
      assert.deepEqual(errors, [])
      await page.close()
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }
})
