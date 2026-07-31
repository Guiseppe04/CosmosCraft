const { pool } = require('../config/database')

const ORDER_TYPE_PREFIXES = {
  PO: 'product',
  CO: 'customization',
  SO: 'service',
}

function getTodayDatePrefix() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function hasCustomizationItems(items = []) {
  return items.some((item) =>
    item?.customization ||
    item?.customization_id ||
    String(item?.type || '').toLowerCase() === 'customization' ||
    String(item?.type || '').toLowerCase() === 'custom_build'
  )
}

function determineOrderTypePrefix(items = []) {
  return hasCustomizationItems(items) ? 'CO' : 'PO'
}

async function getNextOrderSequence(client, prefix) {
  const result = await client.query(
    `INSERT INTO order_number_counters (prefix, date, last_number)
     VALUES ($1, CURRENT_DATE, 1)
     ON CONFLICT (prefix) DO UPDATE SET
       last_number = CASE WHEN order_number_counters.date = CURRENT_DATE THEN order_number_counters.last_number + 1 ELSE 1 END,
       date = CURRENT_DATE,
       updated_at = CURRENT_TIMESTAMP
     RETURNING last_number`,
    [prefix]
  )

  return { nextSeq: result.rows[0].last_number, datePrefix: getTodayDatePrefix() }
}

async function generateOrderNumber(client, prefix) {
  const datePrefix = getTodayDatePrefix()
  const maxAttempts = 100

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { nextSeq } = await getNextOrderSequence(client, prefix)
    const orderNumber = `${prefix}-${datePrefix}-${String(nextSeq).padStart(4, '0')}`

    const existingRes = await client.query(
      `SELECT 1 FROM orders WHERE order_number = $1 LIMIT 1`,
      [orderNumber]
    )

    if (existingRes.rows.length === 0) {
      return orderNumber
    }
  }

  throw new Error(`Could not generate a unique order number for prefix ${prefix} after ${maxAttempts} attempts`)
}

module.exports = {
  generateOrderNumber,
  determineOrderTypePrefix,
  hasCustomizationItems,
  ORDER_TYPE_PREFIXES,
}
