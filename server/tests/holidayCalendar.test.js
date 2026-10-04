const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getHolidaysForYear, isHoliday, appointmentDateKey } = require('../utils/philippineHolidays');
const { pool } = require('../config/database');
const appointments = require('../services/appointmentService');

test('occupied dates use staff capacity, Manila dates, and exclude released bookings', async () => {
  const originalQuery = pool.query;
  pool.query = async (sql, params) => {
    if (sql.includes('staff_count')) return { rows: [{ staff_count: 2 }] };
    assert.match(sql, /AT TIME ZONE 'Asia\/Manila'/);
    assert.match(sql, /'cancelled', 'rejected', 'rescheduled_by_customer'/);
    assert.match(sql, />= \$3/);
    assert.deepEqual(params, ['2027-03-01', '2027-03-31', 2]);
    return { rows: [{ date: '2027-03-24' }] };
  };
  try {
    assert.deepEqual(await appointments.getOccupiedDates('2027-03-01', '2027-03-31'), ['2027-03-24']);
  } finally { pool.query = originalQuery; }
});

test('holidays follow each displayed year, including movable holidays and leap years', () => {
  const dates = { 2026: ['04-02', '04-03', '08-31'], 2027: ['03-25', '03-26', '08-30'], 2028: ['04-13', '04-14', '08-28'], 2029: ['03-29', '03-30', '08-27'] };
  for (const [year, movable] of Object.entries(dates)) {
    const map = getHolidaysForYear(Number(year));
    for (const day of ['01-01', '04-09', '05-01', '06-12', '12-25', ...movable]) {
      assert.ok(map[`${year}-${day}`], `${year}-${day} is a holiday`);
      assert.equal(isHoliday(new Date(`${year}-${day}T09:00:00+08:00`)), true);
    }
    assert.equal(map[`${year}-01-23`], undefined); // An observance, not a closure.
  }
  assert.equal(isHoliday(new Date('2027-04-02T09:00:00+08:00')), false);
  assert.equal(appointmentDateKey(new Date('2026-12-31T16:30:00Z')), '2027-01-01');
});

test('booking availability uses the same holidays and honors explicit reopening', async () => {
  const original = pool.query;
  let rows = [];
  pool.query = async () => ({ rows });
  try {
    for (const date of ['2027-03-25', '2028-04-13', '2029-03-29']) {
      assert.equal(await appointments.isDateUnavailable(date), true);
      assert.deepEqual(await appointments.getAvailableSlots('service', date), []);
      assert.equal(await appointments.checkAvailability('service', `${date}T09:00:00+08:00`, 60), false);
    }
    rows = [{ id: 'override', is_open_override: true }];
    assert.equal(await appointments.isDateUnavailable('2027-03-25'), false);
    rows = [{ id: 'closure', is_open_override: false }];
    assert.equal(await appointments.isDateUnavailable('2027-03-25'), true);
  } finally { pool.query = original; }
});
