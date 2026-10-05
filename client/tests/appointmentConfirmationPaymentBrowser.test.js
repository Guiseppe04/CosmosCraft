import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../tailwind.config.js'

test('e-wallet / bank transfer appointments cannot be confirmed until the payment is approved', async () => {
  const stylesheet = await postcss([tailwindcss(tailwindConfig), autoprefixer]).process(
    (await readFile('src/styles/globals.css', 'utf8')).replace(/^@import.*$/gm, ''), { from: 'src/styles/globals.css' },
  )
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import AppointmentDetailsModal from './src/app/components/appointments/AppointmentDetailsModal.jsx';
      const root = createRoot(document.getElementById('root'));
      window.__statusUpdates = [];
      window.mountConfirmation = (apt) => root.render(<AppointmentDetailsModal show appointment={apt} onClose={() => {}} onStatusChange={(status) => window.__statusUpdates.push(status)} />);
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', define: { 'import.meta.env': JSON.stringify({ VITE_CLOUDINARY_CLOUD_NAME: 'test-cloud', VITE_CLOUDINARY_UPLOAD_PRESET: 'test-preset' }) },
  })

  const server = createServer(async (req, res) => {
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(bundle.outputFiles[0].text)
    }
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css')
      return res.end(stylesheet.css)
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main class="mx-auto max-w-xl px-4 py-6"><div id="root"></div></main><script src="/bundle.js"></script></body></html>')
  })

  let browser
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 900, height: 760 } })
    const renderErrors = []
    page.on('pageerror', error => renderErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)

    const base = {
      appointment_id: 'apt-1',
      status: 'pending',
      reference_code: 'APT-DIGITAL',
      payment_method: 'e_wallet',
      payment_status: 'pending',
      total_amount: 1200,
      customer_name: 'Test Customer',
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    }
    const mount = overrides => page.evaluate(apt => window.mountConfirmation(apt), { ...base, ...overrides })
    const confirmButton = page.getByRole('button', { name: 'Confirm Appointment', exact: true })

    // Every prepaid e-wallet / bank transfer method blocks the pending -> confirmed
    // transition while the payment has not been approved yet.
    for (const payment_method of ['e_wallet', 'e_bank', 'gcash', 'bank_transfer', 'bank', 'E-WALLET']) {
      await mount({ payment_method })
      await expect(confirmButton).toBeDisabled()
      await expect(page.getByText('Confirmation is locked while this', { exact: false })).toBeVisible()
      assert.equal(await page.evaluate(() => window.__statusUpdates.length), 0, `no update for ${payment_method}`)
    }

    // Programmatic confirmation is prevented too (the handler guards the status change).
    const blockedDisabled = await page.evaluate(() => {
      window.__statusUpdates = []
      const button = Array.from(document.querySelectorAll('button'))
        .find(b => b.textContent.trim() === 'Confirm Appointment')
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return button?.disabled ?? true
    })
    assert.equal(blockedDisabled, true)
    assert.deepEqual(await page.evaluate(() => window.__statusUpdates), [])

    // Cash appointments are unaffected.
    await mount({ payment_method: 'cash' })
    await expect(confirmButton).toBeEnabled()
    await expect(page.getByText('Confirmation is locked while this', { exact: false })).toHaveCount(0)

    // Once the prepayment is approved / confirmed, confirming is allowed again.
    for (const payment_status of ['approved', 'verified', 'paid']) {
      await mount({ payment_method: 'e_wallet', payment_status })
      await expect(confirmButton).toBeEnabled()
    }

    await page.evaluate(() => { window.__statusUpdates = [] })
    await mount({ payment_method: 'bank_transfer', payment_status: 'approved' })
    await confirmButton.click()
    assert.deepEqual(await page.evaluate(() => window.__statusUpdates), ['confirmed'])

    assert.deepEqual(renderErrors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})