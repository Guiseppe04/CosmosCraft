const crypto = require('crypto')
const { pool } = require('../config/database')

const ORDER_PREFIX = 'ORD'
const ORDER_RANDOM_SUFFIX_LENGTH = 10
const MAX_ORDER_NUMBER_ATTEMPTS = 6

function formatTimestamp(date = new Date()) {
  return date.toISOString().slice(0, 19).replace(/[-:T]/g, '')
}

function generateOrderSuffix(length = ORDER_RANDOM_SUFFIX_LENGTH) {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase()
}

function generateOrderNumber() {
  return `${ORDER_PREFIX}-${formatTimestamp()}-${generateOrderSuffix()}`
}

async function generateUniqueOrderNumber() {
  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt += 1) {
    const orderNumber = generateOrderNumber()
    const result = await pool.query('SELECT 1 FROM orders WHERE order_number = $1', [orderNumber])
    if (result.rowCount === 0) {
      return orderNumber
    }
  }

  throw new Error('Unable to generate a unique order number after multiple attempts')
}

module.exports = {
  generateOrderNumber,
  generateUniqueOrderNumber,
}
