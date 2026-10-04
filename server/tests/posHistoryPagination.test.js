const assert = require('node:assert/strict');
const { test } = require('node:test');
const { pool } = require('../config/database');
const service = require('../services/posService');

test('POS list and pagination count use matching status, payment and date filters', async () => {
  const original = pool.query;
  const queries = [];
  try {
    pool.query = async (sql, params) => {
      queries.push({ sql, params });
      return { rows: sql.includes('COUNT(*) as count') ? [{ count: '12' }] : [] };
    };
    const filters = { staffId: 'staff', status: 'completed', paymentStatus: 'verified', startDate: '2026-10-03T16:00:00Z', endDate: '2026-10-04T16:00:00Z' };
    await service.listSales({ ...filters, limit: 10, offset: 10 });
    assert.equal(await service.getSalesCount(filters), 12);
    assert.deepEqual(queries[0].params.slice(0, -2), queries[1].params);
    assert.deepEqual(queries[0].params.slice(-2), [10, 10]);
    assert.match(queries[1].sql, /created_at >= \$4/);
    assert.match(queries[1].sql, /created_at < \$5/);
    assert.equal(await service.getSalesCount(), 12);
    assert.deepEqual(queries[2].params, []);
    assert.doesNotMatch(queries[2].sql, /WHERE/);
    await service.listSales({ search: 'POS-12' });
    await service.getSalesCount({ search: 'POS-12' });
    assert.deepEqual(queries[3].params.slice(0, -2), queries[4].params);
    assert.deepEqual(queries[4].params, ['%POS-12%']);
    assert.match(queries[3].sql, /ps.sale_number ILIKE \$1/);
    assert.match(queries[4].sql, /pos_sales.customer_name ILIKE \$1/);
    assert.match(queries[4].sql, /search_staff.user_id = pos_sales.staff_id/);
  } finally { pool.query = original; }
});
