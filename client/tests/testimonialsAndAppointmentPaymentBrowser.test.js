import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'

async function withFixture(run, handleRequest = () => false) {
  const bundle = await build({
    stdin: { contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import AppointmentPaymentReview from './src/app/components/appointments/AppointmentPaymentReview.jsx';
      import { TestimonialCarousel } from './src/app/components/TestimonialCarousel.jsx';
      const root = createRoot(document.getElementById('root'));
      window.updates = [];
      window.failPayment = false;
      function PaymentFixture({ initial }) {
        const [appointment, setAppointment] = useState(initial);
        const update = async (id, status) => {
          if (window.failPayment) throw new Error('Payment update failed');
          window.updates.push({ id, status });
          setAppointment(current => ({ ...current, payment_status: status, approved_payment_amount: status === 'approved' ? 500 : current.approved_payment_amount }));
        };
        return <AppointmentPaymentReview appointment={appointment} onUpdate={update} />;
      }
      let version = 0;
      window.mountPayment = appointment => root.render(<PaymentFixture key={++version} initial={appointment} />);
      window.mountTestimonials = () => root.render(<TestimonialCarousel key={++version} />);
    `, resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', jsx: 'automatic', define: { 'import.meta.env': '{}' },
  })
  const server = createServer((req, res) => {
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(bundle.outputFiles[0].text)
    }
    if (handleRequest(req, res)) return
    res.setHeader('Content-Type', 'text/html')
    res.end('<div id="root"></div><script src="/bundle.js"></script>')
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    await run(page)
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
}

test('cash and electronic appointment payments use confirmed approve/reject actions', async () => {
  await withFixture(async page => {
    const base = { status: 'confirmed', payment_status: 'pending', reference_code: 'APT-TEST' }
    const mount = overrides => page.evaluate(apt => window.mountPayment(apt), { ...base, ...overrides })
    for (const payment_method of ['cash', 'e_bank', 'e_wallet', 'gcash', 'bank_transfer']) {
      await mount({ appointment_id: payment_method, payment_method })
      await expect(page.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled()
      assert.equal(await page.getByRole('combobox').count(), 0)
      await page.getByRole('button', { name: 'Approve', exact: true }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      assert.equal(await page.evaluate(() => window.updates.length), 0)
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await page.getByRole('button', { name: 'Approve', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm Update', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Approved', exact: true })).toBeDisabled()
      assert.deepEqual(await page.evaluate(() => window.updates.at(-1)), { id: payment_method, status: 'approved' })
      await page.getByRole('button', { name: 'Reject', exact: true }).click()
      await page.getByRole('button', { name: 'Confirm Update', exact: true }).click()
      await expect(page.getByRole('button', { name: 'Rejected', exact: true })).toBeDisabled()
      assert.deepEqual(await page.evaluate(() => window.updates.at(-1)), { id: payment_method, status: 'rejected' })
      await page.evaluate(() => { window.updates = [] })
    }

    // A failed update stays open for a retry and does not change the payment.
    await mount({ appointment_id: 'retry', payment_method: 'e_bank' })
    await page.evaluate(() => { window.failPayment = true })
    await page.getByRole('button', { name: 'Approve', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm Update', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Payment update failed')
    assert.equal(await page.evaluate(() => window.updates.length), 0)
    await page.evaluate(() => { window.failPayment = false })
    await page.getByRole('button', { name: 'Confirm Update', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Approved', exact: true })).toBeDisabled()

    // An existing approval without an amount can still be approved to record it.
    await mount({ id: 'legacy', payment_method: 'e_bank', payment_status: 'approved', approved_payment_amount: null })
    await expect(page.getByRole('button', { name: 'Approved', exact: true })).toBeEnabled()
    await page.getByRole('button', { name: 'Approved', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm Update', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Approved', exact: true })).toBeDisabled()
    assert.deepEqual(await page.evaluate(() => window.updates.at(-1)), { id: 'legacy', status: 'approved' })

    for (const overrides of [{ status: 'rescheduled_by_customer' }, { payment_status: 'refunded' }]) {
      await mount({ appointment_id: 'locked', payment_method: 'e_bank', ...overrides })
      await expect(page.getByText('Payment updates are locked for historical or refunded appointments.')).toBeVisible()
      assert.equal(await page.getByRole('button').count(), 0)
    }
  })
})

test('testimonials request ten items, show empty/error fallbacks, retry and preserve avatar initials', async () => {
  let data = []
  let fail = false
  const requests = []
  await withFixture(async page => {
    const mount = () => page.evaluate(() => window.mountTestimonials())
    await mount()
    await expect(page.getByRole('status')).toHaveText('Customer testimonials are coming soon.')
    assert.equal(requests[0], '/api/reviews/testimonials?limit=10')

    fail = true
    await mount()
    await expect(page.getByRole('status')).toHaveText('Customer testimonials are temporarily unavailable.')
    fail = false
    data = Array.from({ length: 12 }, (_, index) => ({
      id: index, feedback_type: 'customization', comment: `Review ${index}`, rating: 4,
      customer_name: `Customer ${index}`, user_avatar: '/broken-avatar.png',
    }))
    await page.getByRole('button', { name: 'Try Again', exact: true }).click()
    await expect(page.locator('.customization-carousel-track')).toBeVisible()
    const names = await page.locator('h4').allTextContents()
    assert.equal(new Set(names).size, 10)
    assert.equal(names.length, 20) // Two copies of the same sample for the scrolling loop.
    await expect(page.locator('img').first()).toBeHidden()
    await expect(page.locator('img').first().locator('..').getByText('C', { exact: true })).toBeVisible()

    data = [null, { feedback_type: 'product', comment: 'Product review' }, { feedback_type: 'customization', comment: '   ' }]
    await mount()
    await expect(page.getByRole('status')).toHaveText('Customer testimonials are coming soon.')
  }, (req, res) => {
    if (req.url === '/broken-avatar.png') { res.statusCode = 404; res.end(); return true }
    if (!req.url.startsWith('/api/reviews/testimonials')) return false
    requests.push(req.url)
    res.statusCode = fail ? 500 : 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(fail ? { message: 'Unavailable' } : { data }))
    return true
  })
})
