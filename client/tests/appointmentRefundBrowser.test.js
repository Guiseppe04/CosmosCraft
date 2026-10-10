import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { mkdir, readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { chromium, expect } from '@playwright/test'
import postcss from 'postcss'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../tailwind.config.js'
const { Server } = createRequire(new URL('../../server/package.json', import.meta.url))('socket.io')

test('appointment refunds disable cash payments and allow approved e-wallet and bank payments', async () => {
  const stylesheet = await postcss([tailwindcss(tailwindConfig), autoprefixer]).process(
    (await readFile('src/styles/globals.css', 'utf8')).replace(/^@import.*$/gm, ''), { from: 'src/styles/globals.css' },
  )
  await mkdir('../.temp/refund-preview', { recursive: true })
  const bundle = await build({
    stdin: { contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import AppointmentRefund, { refundRequest } from './src/app/components/appointments/AppointmentRefund.jsx';
      import { uploadToCloudinary } from './src/app/utils/cloudinary.js';
      import { ViewAppointmentModal } from './src/app/pages/admin/components/modals/ViewAppointmentModal.jsx';
      import AppointmentDetailsModal from './src/app/components/appointments/AppointmentDetailsModal.jsx';
      import { SocketProvider, useSocket } from './src/app/context/SocketContext.jsx';
      function ObserveSocket() { const { socket, isConnected } = useSocket(); window.refundSocket = socket; window.refundSocketConnected = isConnected; return null; }
      const root = createRoot(document.getElementById('root'));
      window.testRefundRequest = refundRequest;
      window.testImageUpload = uploadToCloudinary;
      const render = content => root.render(<SocketProvider><ObserveSocket />{content}</SocketProvider>);
      window.mountRefund = (apt) => render(<AppointmentRefund key={apt.appointment_id} apt={apt} />);
      window.mountRefundAdmin = (apt) => render(<ViewAppointmentModal modal={{ data: apt }} closeModal={() => {}} onPaymentStatusUpdate={() => {}} />);
      window.mountStaffDetails = (apt) => render(<div style={{ transform: 'translateY(250px)' }}><AppointmentDetailsModal show appointment={apt} onClose={() => {}} onPaymentStatusUpdate={() => {}} /></div>);
    `, resolveDir: process.cwd(), loader: 'jsx' },
    bundle: true, write: false, format: 'iife', define: { 'import.meta.env': JSON.stringify({ VITE_CLOUDINARY_CLOUD_NAME: 'test-cloud', VITE_CLOUDINARY_UPLOAD_PRESET: 'test-preset' }) },
    plugins: [{ name: 'isolated-auth', setup(build) { build.onLoad({ filter: /[\\/]context[\\/]AuthContext\.jsx$/ }, () => ({ contents: 'export const useAuth = () => ({ user: null, isAuthenticated: false })', loader: 'js' })) } }],
  })
  const requests = []
  const refundReads = []
  let rejectCompletion = false
  const server = createServer(async (req, res) => {
    if (req.url === '/bundle.js') {
      res.setHeader('Content-Type', 'application/javascript')
      return res.end(bundle.outputFiles[0].text)
    }
    if (req.url === '/styles.css') {
      res.setHeader('Content-Type', 'text/css')
      return res.end(stylesheet.css)
    }
    if (req.url.startsWith('/api/appointments/')) {
      res.setHeader('Content-Type', 'application/json')
      if (req.method === 'PATCH') {
        let body = ''
        for await (const chunk of req) body += chunk
        const update = JSON.parse(body)
        if (rejectCompletion && update.status === 'refunded') {
          res.statusCode = 400
          return res.end(JSON.stringify({ message: 'Validation failed', errors: [{ message: 'Transfer reference could not be saved. Please retry.' }] }))
        }
        const request = requests.find(row => `refund-${row.appointment_id}` === req.url.split('/').at(-1))
        Object.assign(request, update)
        return res.end(JSON.stringify({ data: { refund_request: request } }))
      }
      if (req.method === 'POST') {
        let body = ''
        for await (const chunk of req) body += chunk
        requests.push(JSON.parse(body))
        return res.end(JSON.stringify({ data: { refund_request: { ...requests.at(-1), status: 'pending', amount_requested: 500 } } }))
      }
      refundReads.push(req.url)
      const appointmentId = req.url.split('/')[3]
      const refund_requests = req.url.includes('/existing/') ? [{ status: 'processing', amount_requested: 500 }] : requests.filter(row => row.appointment_id === appointmentId).map(row => ({ ...row, refund_request_id: `refund-${row.appointment_id}`, status: row.status || 'pending', amount_requested: 500, original_payment: { payment_method: 'e_wallet', amount: 500 } }))
      return res.end(JSON.stringify({ data: { refund_requests } }))
    }
    res.setHeader('Content-Type', 'text/html')
    res.end('<!doctype html><html data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main class="mx-auto max-w-xl px-4 py-6"><div id="root"></div></main><script src="/bundle.js"></script></body></html>')
  })
  const socketServer = new Server(server)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: 900, height: 760 } })
    const renderErrors = []
    page.on('pageerror', error => renderErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}`)
    const appointment = { status: 'cancelled', payment_status: 'approved', approved_payment_amount: 500, reference_code: 'APT-TEST' }
    const mount = overrides => page.evaluate(apt => window.mountRefund(apt), { ...appointment, ...overrides })

    for (const status of ['cancelled', 'no_show']) {
      await mount({ appointment_id: `cash-${status}`, status, payment_method: 'cash' })
      await expect(page.getByRole('button', { name: 'Request Refund', exact: true })).toBeDisabled()
      await expect(page.getByText('Refund requests are available only for e-wallet or bank payments.')).toBeVisible()
      assert.equal(await page.locator('form').count(), 0)
    }
    assert.equal(requests.length, 0)

    for (const payment_method of ['e_wallet', 'e_bank', 'gcash', 'bank_transfer']) {
      await mount({ appointment_id: payment_method, payment_method })
      const button = page.getByRole('button', { name: 'Request Refund', exact: true })
      await expect(button).toBeEnabled()
      await button.click()
      await page.getByLabel('Account holder name').fill('Customer')
      await page.getByLabel('Account number / registered mobile number').fill('09123456789')
      await page.getByRole('button', { name: 'Submit refund request', exact: true }).click()
      await expect(page.getByText('Refund Requested', { exact: true })).toBeVisible()
      assert.equal(requests.at(-1).appointment_id, payment_method)
    }
    assert.equal(requests.length, 4)

    // QR mode hides previously typed account details and submits only the uploaded image.
    let uploads = 0
    let failUpload = true
    const qrImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO1cAAAAASUVORK5CYII=', 'base64')
    await page.route('https://example.test/refund-qr.png', route => route.fulfill({ contentType: 'image/png', body: qrImage }))
    await page.route('https://api.cloudinary.com/v1_1/test-cloud/image/upload', route => {
      uploads++
      return route.fulfill({ status: failUpload ? 500 : 200, contentType: 'application/json', body: JSON.stringify(failUpload ? { error: { message: 'QR upload failed' } } : { secure_url: 'https://example.test/refund-qr.png' }) })
    })
    await mount({ appointment_id: 'qr-appointment', payment_method: 'e_wallet', approved_payment_amount: 2750 })
    await page.getByRole('button', { name: 'Request Refund', exact: true }).click()
    const summary = page.getByLabel('Original approved payment')
    await expect(summary).toContainText('E-Wallet payment')
    await expect(summary).toContainText('₱2,750.00')
    await expect(summary).toContainText('APT-TEST')
    await expect(page.getByLabel('E-wallet / bank', { exact: true })).toHaveValue('E-Wallet')
    await page.screenshot({ path: '../.temp/refund-preview/account-light.png', animations: 'disabled' })
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
    await page.setViewportSize({ width: 390, height: 760 })
    await expect(page.getByLabel('E-wallet / bank', { exact: true })).toHaveCSS('background-color', 'rgb(29, 25, 18)')
    await page.screenshot({ path: '../.temp/refund-preview/account-dark-mobile.png', animations: 'disabled' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
    await page.setViewportSize({ width: 900, height: 760 })
    await page.getByLabel('Account holder name').fill('Stale name')
    await page.getByLabel('Account number / registered mobile number').fill('Stale number')
    await page.getByText('QR code', { exact: true }).click()
    await expect(page.getByRole('radio', { name: 'QR code', exact: true })).toBeChecked()
    assert.equal(await page.getByLabel('Account holder name').count(), 0)
    assert.equal(await page.getByLabel('Account number / registered mobile number').count(), 0)
    await page.screenshot({ path: '../.temp/refund-preview/qr-light.png', animations: 'disabled' })
    await page.setViewportSize({ width: 390, height: 760 })
    await page.screenshot({ path: '../.temp/refund-preview/qr-light-mobile.png', animations: 'disabled' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false)
    await page.getByRole('button', { name: 'Submit refund request', exact: true }).click()
    assert.equal(requests.length, 4)
    assert.equal(uploads, 0)
    await page.getByLabel('Upload refund QR code').setInputFiles({ name: 'invalid.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') })
    await expect(page.getByRole('alert')).toHaveText('Choose a PNG, JPG, or WebP QR image up to 5 MB.')
    await page.getByLabel('Upload refund QR code').setInputFiles({ name: 'qr.png', mimeType: 'image/png', buffer: qrImage })
    await expect(page.getByAltText('Refund QR code preview')).toBeVisible()
    await page.getByRole('button', { name: 'Submit refund request', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText('QR upload failed')
    assert.equal(requests.length, 4)
    failUpload = false
    await page.getByRole('button', { name: 'Submit refund request', exact: true }).click()
    await expect(page.getByText('Refund Requested', { exact: true })).toBeVisible()
    await expect(page.getByAltText('Refund destination QR code', { exact: true })).toBeVisible()
    assert.equal(requests.at(-1).destination_type, 'qr')
    assert.equal(requests.at(-1).qr_code_url, 'https://example.test/refund-qr.png')
    assert.equal(requests.at(-1).account_holder, undefined)
    assert.equal(requests.at(-1).account_number, undefined)
    assert.equal(uploads, 2)

    for (const overrides of [{ payment_status: 'pending' }, { approved_payment_amount: 0 }]) {
      await mount({ appointment_id: `ineligible-${JSON.stringify(overrides)}`, payment_method: 'e_wallet', ...overrides })
      await expect(page.getByRole('button', { name: 'Request Refund', exact: true })).toBeDisabled()
      await expect(page.getByText('Refund requests require an approved payment with a confirmed amount.')).toBeVisible()
    }
    await mount({ appointment_id: 'existing', payment_method: 'cash' })
    await expect(page.getByText('Processing', { exact: true })).toBeVisible()
    assert.equal(await page.getByRole('button', { name: 'Request Refund', exact: true }).count(), 0)
    const adminAppointment = { ...appointment, appointment_id: 'qr-appointment', customer_name: 'Maria Santos', payment_method: 'e_wallet', payment_proof_url: 'https://example.test/refund-qr.png' }
    await page.evaluate(apt => window.mountRefundAdmin(apt), adminAppointment)
    await expect(page.getByText('Maria Santos requested a refund.', { exact: true })).toBeVisible()
    assert.deepEqual(await page.evaluate(() => [document.body.style.overflow, document.documentElement.style.overflow]), ['hidden', 'hidden'])
    await expect(page.getByAltText('Refund destination QR code', { exact: true })).toBeVisible()
    const originalPageUrl = page.url()
    await expect(page.getByAltText('Original payment proof', { exact: true })).toBeVisible()
    for (const title of ['View payment proof', 'View refund QR code']) {
      await page.getByRole('button', { name: title }).click()
      const viewer = page.getByRole('dialog', { name: title })
      await expect(viewer).toBeVisible()
      await expect(viewer.getByRole('img')).toBeVisible()
      assert.equal(page.url(), originalPageUrl)
      assert.equal(page.context().pages().length, 1)
      await viewer.getByRole('button', { name: 'Close image preview' }).click()
      await expect(viewer).not.toBeVisible()
    }
    await page.getByRole('button', { name: 'View refund QR code' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'View refund QR code' })).not.toBeVisible()
    await expect(page.getByLabel('Appointment refund request', { exact: true })).toBeVisible()
    const refundPanel = page.getByLabel('Appointment refund request', { exact: true })
    await expect(refundPanel.getByText('Customer reason', { exact: true })).toHaveCount(0)
    await expect(refundPanel.getByRole('group', { name: 'Review refund request' })).toHaveCount(0)
    await expect(refundPanel.getByLabel('Refund transaction reference', { exact: true })).toHaveCount(0)
    await expect(refundPanel.getByLabel('Upload refund payment proof', { exact: true })).toHaveCount(0)
    await expect(refundPanel.getByLabel('Admin notes / rejection reason')).toHaveCount(0)
    const uploadsBeforeProcessing = uploads
    await page.getByRole('button', { name: 'Mark Processing', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Mark Refund Completed', exact: true })).toBeVisible()
    await expect(refundPanel.getByText('Customer reason', { exact: true })).toBeVisible()
    await expect(refundPanel.getByRole('group', { name: 'Review refund request' })).toBeVisible()
    assert.equal(requests.at(-1).status, 'processing')
    assert.equal(requests.at(-1).proof_url, undefined)
    assert.equal(requests.at(-1).refund_reference, undefined)
    assert.equal(uploads, uploadsBeforeProcessing, 'Starting processing must not upload proof')
    for (const width of [390, 900]) {
      await page.setViewportSize({ width, height: 900 })
      const panel = page.getByLabel('Appointment refund request', { exact: true })
      assert.equal(await panel.evaluate(element => element.scrollWidth <= element.clientWidth), true, 'Refund panel should fit the viewport')
      await expect(panel.getByLabel('Admin notes / rejection reason')).toBeVisible()
      await panel.screenshot({ path: `../.temp/refund-preview/admin-refund-${width}.png` })
    }
    await page.evaluate(apt => window.mountRefundAdmin(apt), { ...adminAppointment, appointment_id: 'no-refund', customer_name: 'Another Customer' })
    await expect(page.getByLabel('Appointment refund request', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Maria Santos requested a refund.', { exact: true })).toHaveCount(0)
    await mount({ appointment_id: 'existing', payment_method: 'cash' })
    await expect(page.getByText('Processing', { exact: true })).toBeVisible()
    await page.evaluate(() => { document.body.style.minHeight = '3000px'; window.scrollTo(0, 500) })
    const initialScrollY = await page.evaluate(() => window.scrollY)
    await page.evaluate(apt => window.mountStaffDetails(apt), adminAppointment)
    await expect(page.getByText('Maria Santos requested a refund.', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark Refund Completed', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mark Refund Completed', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Upload a refund proof image or enter the refund transaction reference')
    assert.equal(requests.at(-1).status, 'processing')
    const proofInput = page.getByLabel('Upload refund payment proof', { exact: true })
    const closeButton = page.getByRole('button', { name: 'Close appointment details', exact: true })
    const initialHeaderBounds = await closeButton.boundingBox()
    assert.ok(initialHeaderBounds.y >= 0 && initialHeaderBounds.y + initialHeaderBounds.height <= 900, 'Modal header must stay within the viewport despite transformed parents')
    await proofInput.setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('invalid') })
    await expect(page.getByRole('alert')).toContainText('Choose a PNG, JPG, or WebP refund proof image up to 5 MB.')
    await proofInput.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(5 * 1024 * 1024 + 1) })
    await expect(page.getByRole('alert')).toContainText('up to 5 MB')
    const chooserEvent = page.waitForEvent('filechooser')
    await proofInput.click()
    const chooser = await chooserEvent
    await chooser.setFiles({ name: 'refund-proof.png', mimeType: 'image/png', buffer: qrImage })
    await expect(page.getByAltText('Selected refund proof', { exact: true })).toBeVisible()
    const headerAfterUpload = await closeButton.boundingBox()
    assert.equal(headerAfterUpload.y, initialHeaderBounds.y, 'Selecting refund proof must not move the modal header')
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'Selecting refund proof must not scroll the background page')
    await page.getByRole('button', { name: 'Preview refund proof' }).click()
    await expect(page.getByRole('dialog', { name: 'Preview refund proof' })).toBeVisible()
    await page.getByRole('button', { name: 'Close image preview' }).click()
    await expect(page.getByRole('dialog', { name: 'Preview refund proof' })).not.toBeVisible()
    await page.getByLabel('Refund transaction reference', { exact: true }).fill('')
    await page.getByLabel('Admin notes / rejection reason').fill('Transfer sent to the requested account.')
    failUpload = true
    await page.getByRole('button', { name: 'Mark Refund Completed', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('QR upload failed')
    assert.equal(requests.at(-1).status, 'processing', 'Failed upload must not complete the refund')
    failUpload = false
    rejectCompletion = true
    await page.getByRole('button', { name: 'Mark Refund Completed', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Transfer reference could not be saved. Please retry.')
    await expect(page.getByRole('button', { name: 'Mark Refund Completed', exact: true })).toBeEnabled()
    await expect(page.getByAltText('Uploaded refund proof', { exact: true })).toBeVisible()
    const uploadsAfterFailedSave = uploads
    socketServer.emit('appointment:updated', { appointment_id: 'qr-appointment', action: 'refund_updated' })
    await expect(page.getByRole('alert')).toContainText('Transfer reference could not be saved. Please retry.')
    rejectCompletion = false
    await page.getByRole('button', { name: 'Mark Refund Completed', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Completed refund proof' })).toBeVisible()
    assert.equal(uploads, uploadsAfterFailedSave, 'Retrying a failed save should reuse the uploaded proof')
    assert.equal(requests.at(-1).proof_url, 'https://example.test/refund-qr.png')
    assert.equal(requests.at(-1).status, 'refunded')
    assert.equal(requests.at(-1).refund_reference, '')
    assert.equal(requests.at(-1).admin_notes, 'Transfer sent to the requested account.')
    await expect(page.getByText('Refund Completed', { exact: true })).toBeVisible()
    await mount({ appointment_id: 'qr-appointment', payment_method: 'e_wallet', payment_status: 'refunded' })
    await expect(page.getByText('Refund Completed', { exact: true })).toBeVisible()
    assert.deepEqual(await page.evaluate(() => [document.body.style.overflow, document.documentElement.style.overflow]), ['', ''])
    assert.equal(await page.evaluate(() => window.scrollY), initialScrollY, 'Closing the appointment modal restores the original page position')
    await expect(page.getByAltText('Refund payment proof', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'View refund proof' }).click()
    await expect(page.getByRole('dialog', { name: 'View refund proof' })).toBeVisible()
    await page.getByRole('button', { name: 'Close image preview' }).click()
    await page.waitForFunction(() => window.refundSocketConnected)
    await expect.poll(() => socketServer.engine.clientsCount).toBe(1)
    const liveRefund = requests.find(row => row.appointment_id === 'qr-appointment')
    liveRefund.admin_notes = 'Updated through WebSocket'
    socketServer.emit('appointment:updated', { appointment_id: 'qr-appointment', action: 'refund_updated' })
    await expect(page.getByText('Updated through WebSocket', { exact: true })).toBeVisible()
    await page.evaluate(apt => window.mountRefundAdmin(apt), adminAppointment)
    await expect(page.getByText('Updated through WebSocket', { exact: true })).toBeVisible()
    liveRefund.admin_notes = 'Admin updated through WebSocket'
    socketServer.emit('appointment:updated', { appointment_id: 'qr-appointment', action: 'refund_updated' })
    await expect(page.getByText('Admin updated through WebSocket', { exact: true })).toBeVisible()
    await page.evaluate(() => window.refundSocket.disconnect())
    liveRefund.admin_notes = 'Updated while disconnected'
    await page.evaluate(() => window.refundSocket.connect())
    await expect(page.getByText('Updated while disconnected', { exact: true })).toBeVisible()
    requests.push({ appointment_id: 'reject-pending', status: 'pending', amount_requested: 500 })
    await page.evaluate(apt => window.mountRefundAdmin(apt), { ...adminAppointment, appointment_id: 'reject-pending' })
    await page.getByRole('button', { name: 'Mark rejected', exact: true }).click()
    await page.getByRole('button', { name: 'Confirm rejection', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('Enter a rejection reason')
    await page.getByLabel('Rejection reason', { exact: true }).fill('Payment details could not be verified.')
    await page.getByRole('button', { name: 'Confirm rejection', exact: true }).click()
    await expect(page.getByText('Refund Rejected', { exact: true })).toBeVisible()
    assert.equal(requests.at(-1).status, 'rejected')
    assert.equal(requests.at(-1).admin_notes, 'Payment details could not be verified.')
    requests.push({ appointment_id: 'reference-only', status: 'processing', amount_requested: 500 })
    await page.evaluate(apt => window.mountRefundAdmin(apt), { ...adminAppointment, appointment_id: 'reference-only' })
    await page.getByLabel('Refund transaction reference', { exact: true }).fill('TRANSFER-REFERENCE-ONLY')
    const uploadsBeforeReferenceOnly = uploads
    await page.getByRole('button', { name: 'Mark Refund Completed', exact: true }).click()
    await expect(page.getByText('Refund Completed', { exact: true })).toBeVisible()
    assert.equal(requests.at(-1).refund_reference, 'TRANSFER-REFERENCE-ONLY')
    assert.equal(requests.at(-1).proof_url, undefined)
    assert.equal(uploads, uploadsBeforeReferenceOnly)
    await page.route('**/api/appointments/timeout-test', async route => {
      await new Promise(resolve => setTimeout(resolve, 150))
      await route.abort().catch(() => {})
    })
    const requestTimeout = await page.evaluate(async () => {
      try { await window.testRefundRequest('/timeout-test', { timeoutMs: 20 }) } catch (error) { return error.message }
    })
    assert.match(requestTimeout, /refund request timed out/)
    await page.route('https://api.cloudinary.com/v1_1/test-cloud/image/upload', async route => {
      await new Promise(resolve => setTimeout(resolve, 150))
      await route.abort().catch(() => {})
    })
    const uploadTimeout = await page.evaluate(async () => {
      try { await window.testImageUpload(new File(['proof'], 'proof.png', { type: 'image/png' }), { timeoutMs: 20 }) } catch (error) { return error.message }
    })
    assert.match(uploadTimeout, /Image upload timed out/)
    assert.ok(refundReads.every(path => /^\/api\/appointments\/[^/]+\/refund-requests$/.test(path)))
    assert.deepEqual(renderErrors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => socketServer.close(resolve))
    await new Promise(resolve => server.close(resolve))
  }
})
