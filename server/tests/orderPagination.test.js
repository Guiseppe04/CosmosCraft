const assert = require('assert')
const database = require('../config/database')
const orderService = require('../services/orderService')

async function run() {
  const originalQuery = database.pool.query
  const calls = []

  database.pool.query = async (sql, params = []) => {
    calls.push({ sql, params })

    if (sql.includes('SELECT COUNT(DISTINCT')) {
      return { rows: [{ total: 42 }] }
    }

    if (sql.includes('FROM payments') && sql.includes('WHERE order_id = ANY')) {
      return { rows: [] }
    }

    if (sql.includes('SELECT oi.*, pi.image_url') && sql.includes('WHERE oi.order_id = ANY')) {
      return { rows: [] }
    }

    return { rows: [] }
  }

  try {
    const result = await orderService.getAllOrders({})

    assert.strictEqual(result.pagination.page_size, 10, 'expected the default page size to be 10')
    assert.strictEqual(result.pagination.total_pages, 5, 'expected total pages to reflect the default page size')
    assert.deepStrictEqual(calls[1]?.params.slice(-2), [10, 0], 'expected the data query to use limit 10 and offset 0')

    // Test search filter standalone
    calls.length = 0
    await orderService.getAllOrders({ search: 'ORD-1234', page: 2, page_size: 10 })
    assert.ok(calls[0].sql.includes('WHERE'), 'expected WHERE clause in count query when search is provided')
    assert.ok(!calls[0].sql.includes('AND (o.order_number') || calls[0].sql.includes('WHERE (o.order_number'), 'expected valid WHERE clause')
    assert.strictEqual(calls[1].params[calls[1].params.length - 2], 10, 'expected limit 10')
    assert.strictEqual(calls[1].params[calls[1].params.length - 1], 10, 'expected offset 10 for page 2')

    // Test search filter combined with other filters
    calls.length = 0
    await orderService.getAllOrders({ search: 'John', status: 'processing', payment_status: 'approved', page: 1 })
    assert.ok(calls[0].sql.includes('o.status = $1 AND o.payment_status = $2 AND ('), 'expected combined WHERE conditions')
  } finally {
    database.pool.query = originalQuery
  }
}

run().then(() => {
  console.log('order pagination test passed')
}).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
