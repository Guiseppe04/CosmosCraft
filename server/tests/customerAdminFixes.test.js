const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const appointments = require('../services/appointmentService');
const orders = require('../services/orderService');
const cart = require('../services/cartService');
const audit = require('../services/auditService');
const validation = require('../utils/validation');

test('profile and appointment phone validation keeps legacy callers and stores +63 consistently', () => {
  const { appointmentValidation } = require('../utils/appointmentValidation');
  for (const phone of ['9661341242', '09661341242', '+639661341242']) {
    assert.equal(validation.updatePhoneSchema.validate({ phone }).value.phone, '+639661341242');
    const profile = validation.updateProfileSchema.validate({ phone });
    assert.equal(profile.error, undefined);
    assert.equal(profile.value.phone, '+639661341242');
    const appointment = appointmentValidation.updateAppointmentSchema.validate({ contact_number: phone });
    assert.equal(appointment.error, undefined);
    assert.equal(appointment.value.contact_number, '+639661341242');
  }
});

test('delivery schemas normalize local PH numbers and reject malformed contacts', () => {
  for (const input of ['9123456789', '09123456789', '+639123456789', ' +63 912 345 6789 ']) {
    const result = validation.updateOutForDeliverySchema.validate({ rider_name: 'Rider', rider_contact: input });
    assert.equal(result.error, undefined);
    assert.equal(result.value.rider_contact, '+639123456789');
  }
  for (const input of ['abc', '+639123', '+6391234567890', '0912-345-6789', '+63(912)3456789', '']) {
    for (const schema of [validation.updateOrderSchema, validation.updateOutForDeliverySchema, validation.updateShipmentSchema]) {
      const payload = schema === validation.updateShipmentSchema
        ? { tracking_number: 'TRACK123', courier_name: 'Courier', rider_contact: input }
        : { rider_name: 'Rider', rider_contact: input };
      const result = schema.validate(payload);
      // Optional empty contact still supports edits unrelated to delivery.
      if (!input && schema !== validation.updateOutForDeliverySchema) continue;
      assert.match(result.error.message, /valid mobile number/);
    }
  }
});

test('customers cannot directly cancel pickup-ready or paid appointments; staff cancellation is preserved', async () => {
  const original = { get: appointments.getAppointmentById, connect: pool.connect, log: audit.logAppointmentEvent };
  let row = { appointment_id: 'appointment', scheduled_at: new Date(Date.now() + 86400000).toISOString(), status: 'confirmed', payment_status: 'pending' };
  const queries = [];
  appointments.getAppointmentById = async () => ({ ...row });
  audit.logAppointmentEvent = async () => {};
  pool.connect = async () => ({ async query(sql) { queries.push(sql); return { rows: [row] }; }, release() {} });
  try {
    for (const patch of [{ status: 'ready_for_pickup' }, { related_pickup_ready: true }, { payment_status: 'approved' }, { payment_status: 'verified' }]) {
      row = { ...row, status: 'confirmed', payment_status: 'pending', related_pickup_ready: false, ...patch };
      await assert.rejects(appointments.cancelAppointment('appointment', 'Reason', { forCustomer: true }), /cancel|refund/);
      assert.equal(queries.length, 0);
    }
    await appointments.cancelAppointment('appointment', 'Staff resolution');
    assert.ok(queries.some(sql => sql.includes("SET status = 'cancelled'")));
    queries.length = 0;
    row = { ...row, payment_status: 'pending', related_pickup_ready: false };
    await appointments.cancelAppointment('appointment', 'Customer reason', { forCustomer: true });
    assert.ok(queries.some(sql => sql.includes('FOR UPDATE OF a')));
    assert.equal(queries.at(-1), 'COMMIT');
  } finally { appointments.getAppointmentById = original.get; pool.connect = original.connect; audit.logAppointmentEvent = original.log; }
});

test('payment approval between cancellation reads is rejected inside the transaction', async () => {
  const original = { get: appointments.getAppointmentById, connect: pool.connect };
  const row = { status: 'confirmed', payment_status: 'pending', scheduled_at: new Date(Date.now() + 86400000).toISOString() };
  const queries = [];
  appointments.getAppointmentById = async () => row;
  pool.connect = async () => ({ async query(sql) { queries.push(sql); return { rows: [{ ...row, payment_status: 'approved' }] }; }, release() {} });
  try {
    await assert.rejects(appointments.cancelAppointment('appointment', 'Reason', { forCustomer: true }), /refund process/);
    assert.equal(queries.at(-1), 'ROLLBACK');
    assert.ok(!queries.some(sql => sql.includes('UPDATE appointments')));
  } finally { appointments.getAppointmentById = original.get; pool.connect = original.connect; }
});

test('order updates reject same/invalid statuses and preserve valid next statuses and metadata edits', async () => {
  const original = pool.query;
  const writes = [];
  pool.query = async (sql, params) => {
    if (sql.includes('SELECT status')) return { rows: [{ status: 'shipped' }] };
    writes.push(params);
    return { rows: [{ order_id: 'order', status: params[0] || 'shipped' }] };
  };
  try {
    await assert.rejects(orders.updateOrder('order', { status: 'shipped' }), /already shipped/);
    await assert.rejects(orders.updateOrder('order', { status: 'pending' }), /Invalid status transition/);
    await assert.rejects(orders.updateOrder('order', { rider_contact: 'abc' }), /valid mobile number/);
    assert.equal(writes.length, 0);
    await orders.updateOrder('order', { status: 'out_for_delivery', rider_name: 'Rider', rider_contact: '09123456789' });
    assert.equal(writes[0][10], '+639123456789');
    await orders.updateOrder('order', { notes: 'Tracking note' });
    assert.equal(writes.length, 2);
  } finally { pool.query = original; }
});

test('checkout preparation rechecks stock and preserves customization preview data', async () => {
  const original = pool.query;
  let item = { cart_item_id: 1, product_id: 'product', product_name: 'Guitar', product_base_price: 100, product_is_active: true, quantity: 1, stock: 0 };
  pool.query = async sql => ({ rows: sql.includes('FROM cart_items') ? [item] : [{ cart_id: 1 }] });
  try {
    await assert.rejects(cart.prepareCheckout('customer', { cart_item_ids: [1] }), /Not enough stock/);
    item = { ...item, stock: 2 };
    assert.equal((await cart.prepareCheckout('customer', { cart_item_ids: [1] })).cart.items[0].product.stock, 2);
    item = { cart_item_id: 1, customization_id: 'saved-build', customization_name: 'Custom guitar', customization_price: 100, quantity: 1, config_json: { body: 'test' }, stickers: [{ id: 'sticker', x: 10, y: 20, rotation: 45, size: 15 }], preview_image: 'https://example.test/build.png' };
    const prepared = await cart.prepareCheckout('customer', { cart_item_ids: [1] });
    assert.equal(prepared.cart.items[0].customization.preview_image, item.preview_image);
    assert.deepEqual(prepared.cart.items[0].customization.stickers, item.stickers);
  } finally { pool.query = original; }
});
