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

test('DashboardTab inventory attention item displays correct counts and deep-links to inventory filters', async () => {
  const css = await postcss([tailwindcss({ content: ['./src/app/pages/admin/tabs/DashboardTab.jsx'] }), autoprefixer]).process(
    (await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8')).replace(/^@import.*$/gm, ''), { from: undefined })

  const fixture = await build({
    stdin: {
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {DashboardTab} from './src/app/pages/admin/tabs/DashboardTab.jsx';

      // 5 out of stock (stock 0), 8 low stock (stock 5 <= threshold 10), 2 healthy (stock 50)
      const productsCombined = [
        ...Array.from({ length: 5 }, (_, i) => ({ product_id: 'oos_' + i, name: 'OOS Product ' + i, stock: 0, low_stock_threshold: 10, max_stock: 100 })),
        ...Array.from({ length: 8 }, (_, i) => ({ product_id: 'low_' + i, name: 'Low Product ' + i, stock: 5, low_stock_threshold: 10, max_stock: 100 })),
        ...Array.from({ length: 2 }, (_, i) => ({ product_id: 'ok_' + i, name: 'Healthy Product ' + i, stock: 50, low_stock_threshold: 10, max_stock: 100 })),
      ];

      const productsOnlyOOS = [
        ...Array.from({ length: 5 }, (_, i) => ({ product_id: 'oos_' + i, name: 'OOS Product ' + i, stock: 0, low_stock_threshold: 10, max_stock: 100 })),
        ...Array.from({ length: 5 }, (_, i) => ({ product_id: 'ok_' + i, name: 'Healthy Product ' + i, stock: 50, low_stock_threshold: 10, max_stock: 100 })),
      ];

      const productsOnlyLow = [
        ...Array.from({ length: 8 }, (_, i) => ({ product_id: 'low_' + i, name: 'Low Product ' + i, stock: 5, low_stock_threshold: 10, max_stock: 100 })),
        ...Array.from({ length: 5 }, (_, i) => ({ product_id: 'ok_' + i, name: 'Healthy Product ' + i, stock: 50, low_stock_threshold: 10, max_stock: 100 })),
      ];

      const productsAllHealthy = [
        ...Array.from({ length: 10 }, (_, i) => ({ product_id: 'ok_' + i, name: 'Healthy Product ' + i, stock: 50, low_stock_threshold: 10, max_stock: 100 })),
      ];

      const report = { netSales: 10000, totalTransactions: 1, averagePerTransaction: 10000, dailyTrend: [] };

      window.tabs = [];
      window.inventoryFilters = [];
      window.inventorySubTabs = [];

      window.setProductsFilter = (updater) => {
        const prev = { search: '', status: 'all', category: '', sort: 'name_asc', page: 1 };
        const next = typeof updater === 'function' ? updater(prev) : updater;
        window.inventoryFilters.push(next);
      };

      const root = createRoot(document.getElementById('root'));

      window.renderScenario = (scenario) => {
        let prods = productsCombined;
        if (scenario === 'oos_only') prods = productsOnlyOOS;
        if (scenario === 'low_only') prods = productsOnlyLow;
        if (scenario === 'all_healthy') prods = productsAllHealthy;

        root.render(
          <DashboardTab
            user={{ first_name: 'Admin' }}
            salesReport={report}
            visibleOrders={[]}
            visibleProjects={[]}
            visibleAppointments={[]}
            visibleProducts={prods}
            isLoading={false}
            setActiveTab={(tab) => window.tabs.push(tab)}
            setInventorySubTab={(sub) => window.inventorySubTabs.push(sub)}
            setProductsInventoryFilter={window.setProductsFilter}
          />
        );
      };

      window.renderScenario('combined');
      `,
      resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx'
    },
    bundle: true, write: false, format: 'iife', logLevel: 'silent', jsx: 'automatic', define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'dashboard-report-fixture', setup(builder) {
      builder.onLoad({ filter: /adminApi\.js$/ }, () => ({ loader: 'js', contents: `export const adminApi={getSalesReport:async()=>({data:null})};` }))
    } }],
  })

  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); return res.end(fixture.outputFiles[0].text) }
    if (req.url === '/style.css') { res.setHeader('Content-Type', 'text/css'); return res.end(css.css) }
    res.setHeader('Content-Type', 'text/html')
    res.end('<html data-theme="dark"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root" style="padding:16px"></div><script src="/bundle.js"></script></html>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))

  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } }), errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await page.getByRole('heading', { name: /Admin/ }).waitFor()

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 1: Combined stock problems (5 out of stock, 8 low stock = 13 total)
    // ─────────────────────────────────────────────────────────────
    await page.waitForFunction(() => document.body.innerText.includes('13 products need stock attention'))
    assert(await page.getByText('13 products need stock attention').isVisible())
    assert(await page.getByRole('button', { name: /Out of stock: 5 products/ }).isVisible())
    assert(await page.getByRole('button', { name: /Low stock: 8 products/ }).isVisible())

    // 1a. Click "Out of stock: 5 products" button -> should navigate to inventory with out_of_stock filter
    await page.getByRole('button', { name: /Out of stock: 5 products/ }).click()
    await page.waitForFunction(() => window.tabs.includes('inventory'))
    assert.deepEqual(await page.evaluate(() => window.tabs.at(-1)), 'inventory')
    assert.deepEqual(await page.evaluate(() => window.inventorySubTabs.at(-1)), 'products')
    assert.deepEqual(await page.evaluate(() => window.inventoryFilters.at(-1)?.status), 'out_of_stock')

    // 1b. Click "Low stock: 8 products" button -> should navigate to inventory with low_stock filter
    await page.getByRole('button', { name: /Low stock: 8 products/ }).click()
    await page.waitForFunction(() => window.inventoryFilters.some(f => f?.status === 'low_stock'))
    assert.deepEqual(await page.evaluate(() => window.tabs.at(-1)), 'inventory')
    assert.deepEqual(await page.evaluate(() => window.inventoryFilters.at(-1)?.status), 'low_stock')

    // 1c. Click main combined item ("View All Issues") -> should navigate to inventory with attention filter
    await page.getByRole('button', { name: /View All Issues/ }).click()
    await page.waitForFunction(() => window.inventoryFilters.some(f => f?.status === 'attention'))
    assert.deepEqual(await page.evaluate(() => window.tabs.at(-1)), 'inventory')
    assert.deepEqual(await page.evaluate(() => window.inventoryFilters.at(-1)?.status), 'attention')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 2: Out of stock ONLY (5 out of stock, 0 low stock)
    // ─────────────────────────────────────────────────────────────
    await page.evaluate(() => window.renderScenario('oos_only'))
    await page.waitForFunction(() => document.body.innerText.includes('5 products are out of stock'))
    assert(await page.getByText('5 products are out of stock').isVisible())
    assert(await page.getByText('View Out of Stock').isVisible())

    // Click it -> should open out_of_stock filter
    await page.getByRole('button', { name: /5 products are out of stock/ }).click()
    assert.deepEqual(await page.evaluate(() => window.tabs.at(-1)), 'inventory')
    assert.deepEqual(await page.evaluate(() => window.inventoryFilters.at(-1)?.status), 'out_of_stock')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 3: Low stock ONLY (0 out of stock, 8 low stock)
    // ─────────────────────────────────────────────────────────────
    await page.evaluate(() => window.renderScenario('low_only'))
    await page.waitForFunction(() => document.body.innerText.includes('8 products are low in stock'))
    assert(await page.getByText('8 products are low in stock').isVisible())
    assert(await page.getByText('View Low Stock').isVisible())

    // Click it -> should open low_stock filter
    await page.getByRole('button', { name: /8 products are low in stock/ }).click()
    assert.deepEqual(await page.evaluate(() => window.tabs.at(-1)), 'inventory')
    assert.deepEqual(await page.evaluate(() => window.inventoryFilters.at(-1)?.status), 'low_stock')

    // ─────────────────────────────────────────────────────────────
    // SCENARIO 4: Zero stock issues (All healthy)
    // ─────────────────────────────────────────────────────────────
    await page.evaluate(() => window.renderScenario('all_healthy'))
    await page.waitForFunction(() => document.body.innerText.includes('No urgent actions needed.'))
    assert(await page.getByText('No urgent actions needed.').isVisible())
    assert(!(await page.getByText('products need stock attention').isVisible()))
    assert(!(await page.getByText('out of stock').isVisible()))
    assert(!(await page.getByText('low in stock').isVisible()))

    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
