import assert from 'node:assert/strict'
import { test, before, after } from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

const serverRequire = createRequire(new URL('../../server/', import.meta.url))
const socketService = serverRequire('./services/socketService.js')
const rbacService = serverRequire('./services/rbacService.js')
const jwt = serverRequire('jsonwebtoken')

const POS_INVENTORY = [
  { product_id: 'prod-1', name: 'Guitar Strings', price: 500, stock: 6 },
  { product_id: 'prod-2', name: 'Guitar Cable', price: 250, stock: 4 },
]

/**
 * Mutable state shared with the stubbed REST endpoints so a request can emulate
 * exactly what the real controllers publish once their transaction committed.
 */
const state = {
  bundle: '',
  sales: new Map(),
  appointments: [],
  recentListRequests: 0,
  appointmentListRequests: 0,
}

function resetState() {
  state.sales = new Map([['sale-1', { sale_id: 'sale-1', sale_number: 'POS-1', status: 'completed', total_amount: 500 }]])
  state.appointments = [{
    appointment_id: 'apt-1',
    reference_code: 'APT-0001',
    user_name: 'Existing Customer',
    user_email: 'existing@example.test',
    service_name: 'Full Setup',
    scheduled_at: '2026-10-06T09:00:00Z',
    created_at: '2026-10-05T09:00:00Z',
    status: 'pending',
    payment_status: 'pending',
  }]
  state.recentListRequests = 0
  state.appointmentListRequests = 0
}

async function readBody(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost')

  if (url.pathname === '/') {
    res.setHeader('Content-Type', 'text/html')
    return res.end('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script src="/bundle.js"></script>')
  }
  if (url.pathname === '/bundle.js') {
    res.setHeader('Content-Type', 'application/javascript')
    return res.end(state.bundle)
  }

  res.setHeader('Content-Type', 'application/json')

  // ── POS ────────────────────────────────────────────────────────────────────
  if (url.pathname === '/api/pos/reports/daily-summary') {
    return res.end(JSON.stringify({ data: { total_sales: 500, total_transactions: 1 } }))
  }
  const adjustment = url.pathname.match(/^\/api\/pos\/sales\/([^/]+)\/(void|return)$/)
  if (adjustment && req.method === 'POST') {
    const [, saleId, action] = adjustment
    await readBody(req)
    const sale = { ...state.sales.get(saleId), status: action === 'void' ? 'voided' : 'returned' }
    state.sales.set(saleId, sale)
    // Mirrors posController: the notifications follow a committed change.
    socketService.emitToStaff('pos:sale_updated', {
      action: `${action}ed`,
      sale,
      saleNumber: sale.sale_number,
      returns: [],
      refundAmount: sale.total_amount,
      stockUpdates: [{ product_id: 'prod-1', stock: 8 }],
    })
    socketService.emitBroadcast('stock:updated', { productId: 'prod-1', product_id: 'prod-1', stock: 8 })
    socketService.emitToStaff('inventory:updated', { productId: 'prod-1', stock: 8 })
    return res.end(JSON.stringify({
      status: 'success',
      data: { sale, returns: [], stockUpdates: [{ product_id: 'prod-1', stock: 8 }] },
    }))
  }
  const saleDetail = url.pathname.match(/^\/api\/pos\/sales\/(sale-\d+)$/)
  if (saleDetail) {
    const sale = state.sales.get(saleDetail[1])
    return res.end(JSON.stringify({
      data: {
        ...sale,
        created_at: '2026-10-05T08:00:00Z',
        subtotal: 500,
        payment_method: 'cash',
        items: [{ item_id: 'item-1', product_id: 'prod-1', item_name: 'Guitar Strings', quantity: 1, subtotal: 500 }],
      },
    }))
  }
  if (url.pathname === '/api/pos/sales') {
    if (req.method === 'POST') {
      await readBody(req)
      return res.end(JSON.stringify({ data: { sale_id: 'sale-2', sale_number: 'POS-2', status: 'completed' } }))
    }
    if (url.searchParams.get('limit') === '8') state.recentListRequests += 1
    return res.end(JSON.stringify({
      data: Array.from(state.sales.values()).map(sale => ({ ...sale, created_at: '2026-10-05T08:00:00Z', item_count: 1 })),
      pagination: { total: state.sales.size },
    }))
  }

  // ── Appointments ───────────────────────────────────────────────────────────
  if (url.pathname === '/api/appointments' && req.method === 'POST') {
    const payload = await readBody(req)
    const appointment = {
      appointment_id: `apt-${state.appointments.length + 1}`,
      reference_code: `APT-000${state.appointments.length + 1}`,
      user_name: 'Walk In Booking',
      user_email: 'walkin@example.test',
      service_name: 'Neck Reset',
      scheduled_at: payload.scheduled_at || '2026-10-07T09:00:00Z',
      created_at: '2026-10-05T10:00:00Z',
      status: 'pending',
      payment_status: 'pending',
    }
    state.appointments.unshift(appointment)
    // Mirrors appointmentController.createAppointment.
    socketService.emitToUserAndStaff('customer-1', 'appointment:created', { appointment, action: 'created' })
    return res.end(JSON.stringify({ status: 'success', data: { appointment } }))
  }
  if (url.pathname === '/api/appointments') {
    state.appointmentListRequests += 1
    return res.end(JSON.stringify({
      status: 'success',
      data: {
        appointments: state.appointments,
        pagination: { total: state.appointments.length, limit: 20, offset: 0, pages: 1 },
      },
    }))
  }

  res.statusCode = 404
  res.end(JSON.stringify({ message: 'not found' }))
})

async function buildFixture() {
  return build({
    stdin: {
      contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { SocketProvider, useSocketEvent } from './src/app/context/SocketContext.jsx';
      import { PosWorkspace } from './src/app/components/pos/PosWorkspace.jsx';
      import { useAppointmentsAdmin } from './src/app/hooks/useAppointmentsAdmin.js';
      import { useDebouncedCallback } from './src/app/hooks/useDebouncedCallback.js';
      import AppointmentList from './src/app/components/appointments/AppointmentList.jsx';
      const inventory = ${JSON.stringify(POS_INVENTORY)};
      const toast = message => { (window.toasts = window.toasts || []).push(message) };
      const root = createRoot(document.getElementById('root'));

      // The POS parent keeps the inventory props it was mounted with, so the only
      // way the catalog can learn about a restock is the socket notification.
      window.mountPos = () => root.render(
        React.createElement(SocketProvider, null,
          React.createElement(PosWorkspace, { inventoryItems: inventory, showToast: toast })));

      function AdminAppointments() {
        const { appointments, appointmentLoading, appointmentPagination, fetchAppointments, fetchCalendarAppointments } = useAppointmentsAdmin({ showToast: toast });
        // AdminPage loads the list when the appointments tab opens.
        React.useEffect(() => { fetchAppointments(); fetchCalendarAppointments(); }, []);
        // Same coalescing the admin and staff dashboards use.
        const refresh = useDebouncedCallback(() => { fetchAppointments({ silent: true }); fetchCalendarAppointments(); });
        useSocketEvent('appointment:created', () => refresh());
        useSocketEvent('appointment:updated', () => refresh());
        return React.createElement(AppointmentList, {
          appointments, loading: appointmentLoading, pagination: appointmentPagination,
          onRefresh: () => fetchAppointments({ silent: true }),
        });
      }
      window.mountAppointments = () => root.render(
        React.createElement(SocketProvider, null, React.createElement(AdminAppointments, null)));
      window.fixtureReady = true;
      `,
      resolveDir: process.cwd(),
      loader: 'jsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    logLevel: 'silent',
    define: { 'import.meta.env': '{}' },
    plugins: [{
      name: 'realtime-fixture',
      setup(builder) {
        builder.onLoad({ filter: /AuthContext\.jsx$/ }, () => ({
          loader: 'js',
          contents: `export const useAuth = () => ({ isAuthenticated: true, user: { id: 'staff-1', user_id: 'staff-1', role: 'staff' } });`,
        }))
        builder.onLoad({ filter: /apiConfig\.js$/ }, () => ({
          loader: 'js',
          contents: `export const API = window.location.origin;
            export const getAuthToken = () => 'staff-token';
            export const getAuthHeaders = headers => headers;
            export function resolveImageUrl(url) { return url || ''; }`,
        }))
      },
    }],
  })
}

let browser
let origin

before(async () => {
  // Let the real socket server accept an authenticated staff handshake without a
  // database or a real JWT secret.
  jwt.verify = () => ({ id: 'staff-1', user_id: 'staff-1' })
  rbacService.getUserRoleSummary = async () => ({ role: 'staff', roles: ['staff'] })
  const fixture = await buildFixture()
  state.bundle = fixture.outputFiles[0].text
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  socketService.init(server, [origin])
  browser = await chromium.launch({ headless: true })
})

after(async () => {
  await browser?.close()
  await new Promise(resolve => server.close(resolve))
})

async function openFixture() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(origin)
  await page.waitForFunction(() => window.fixtureReady === true)
  return { page, errors }
}

function reportPageErrors(page, errors, failure) {
  if (!errors.length) return
  console.error('page errors before', failure, '\n -', errors.join('\n - '))
  console.error('page url', page.url())
}

test('a void updates the POS stock and the transaction without a page reload', async () => {
  resetState()
  const { page, errors } = await openFixture()
  try {
    await page.evaluate(() => window.mountPos())
    await page.getByText('POS Orders Today', { exact: true }).waitFor()
    assert.equal(await page.getByText('6 in stock', { exact: true }).count(), 1)

    // ── The cashier voids POS-1; the endpoint publishes after the change ──────
    await page.getByRole('button', { name: 'View All Orders', exact: true }).first().click()
    const dialog = page.getByRole('region', { name: 'All POS Orders' })
    const row = dialog.locator('tbody tr').first()
    await row.getByRole('button', { name: 'View receipt', exact: true }).click()
    await page.getByRole('button', { name: 'Void', exact: true }).click()
    const confirm = page.getByRole('button', { name: 'Confirm Void', exact: true })
    await confirm.click()
    await page.getByPlaceholder('Why is this transaction being voided?').fill('Duplicate sale')
    await confirm.click()
    await page.waitForResponse(response => response.url().endsWith('/void') && response.request().method() === 'POST')

    // Transaction status and restored stock both arrive over the socket.
    await dialog.getByRole('cell', { name: 'Voided', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Back to POS', exact: true }).click()
    await page.getByText('8 in stock', { exact: true }).waitFor()
    assert.equal(await page.getByText('6 in stock', { exact: true }).count(), 0)

    // Another terminal selling the last unit must empty the catalog at once.
    socketService.emitBroadcast('stock:updated', { productId: 'prod-1', product_id: 'prod-1', stock: 0 })
    await page.getByRole('button', { name: 'Add Guitar Strings', exact: true }).waitFor({ state: 'detached' })

    // One notification must not fan out into a request storm.
    const before = state.recentListRequests
    socketService.emitToStaff('pos:sale_updated', {
      action: 'voided',
      sale: { sale_id: 'sale-1', sale_number: 'POS-1', status: 'voided' },
      saleNumber: 'POS-1',
      stockUpdates: [{ product_id: 'prod-1', stock: 8 }],
    })
    await page.waitForFunction(count => window.toasts !== undefined, before)
    await new Promise(resolve => setTimeout(resolve, 500))
    assert.equal(state.recentListRequests - before, 1, 'exactly one refetch per notification')
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
})

test('an appointment booked by a customer appears in the admin list without a refresh', async () => {
  resetState()
  const { page, errors } = await openFixture()
  try {
    await page.evaluate(() => window.mountAppointments())
    try {
      await page.getByText('Existing Customer', { exact: true }).waitFor({ timeout: 8000 })
    } catch (failure) {
      reportPageErrors(page, errors, failure)
      throw failure
    }

    // The customer submits the booking form through the same endpoint the
    // booking page posts to; the answer is followed by `appointment:created`.
    await page.evaluate(() => fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: '2026-10-07T09:00:00Z' }),
    }))

    await page.getByText('Walk In Booking', { exact: true }).waitFor()
    assert.equal(await page.getByText('APT-0002', { exact: true }).count(), 1)

    // A status change must be reflected the same way.
    state.appointments[0] = { ...state.appointments[0], status: 'confirmed' }
    socketService.emitToUserAndStaff('customer-1', 'appointment:updated', {
      appointment: state.appointments[0],
      action: 'status_updated',
      status: 'confirmed',
    })
    await page.getByText('Confirmed', { exact: true }).first().waitFor()

    const before = state.appointmentListRequests
    await page.evaluate(() => fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduled_at: '2026-10-08T09:00:00Z' }),
    }))
    await page.getByText('APT-0003', { exact: true }).waitFor()
    // One refetch of the paginated list plus one of the calendar feed, and no
    // extra round trips while the notification is handled.
    assert.equal(state.appointmentListRequests - before, 2, 'one list refetch plus one calendar refetch per event')

    // A burst of events (the no-show sweep publishes one per appointment) must
    // collapse into a single refetch instead of one per event.
    const beforeBurst = state.appointmentListRequests
    for (let index = 0; index < 4; index += 1) {
      state.appointments[index % state.appointments.length] = { ...state.appointments[index % state.appointments.length], status: 'confirmed' }
      socketService.emitToUserAndStaff('customer-1', 'appointment:updated', {
        appointment: state.appointments[index % state.appointments.length],
        action: 'status_updated',
        status: 'confirmed',
      })
    }
    await page.getByText('Confirmed', { exact: true }).first().waitFor()
    await new Promise(resolve => setTimeout(resolve, 500))
    assert.equal(state.appointmentListRequests - beforeBurst, 2, 'a burst of four events triggers one refetch')
    assert.deepEqual(errors, [])
  } finally {
    await page.close()
  }
})