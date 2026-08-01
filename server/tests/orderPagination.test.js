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
