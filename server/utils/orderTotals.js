const configuredTaxRate = Number(process.env.ORDER_TAX_RATE ?? 0)
const ORDER_TAX_RATE = Number.isFinite(configuredTaxRate) && configuredTaxRate > 0
  ? configuredTaxRate
  : 0

const roundCurrency = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

const calculateOrderTotals = (items = [], shippingMethod = 'standard') => {
  const subtotal = roundCurrency(items.reduce(
    (sum, item) => sum + (Number(item.price ?? item.unit_price) || 0) * (Number(item.quantity) || 0),
    0
  ))
  const shippingCost = shippingMethod === 'express' ? 500 : 0
  const taxAmount = roundCurrency(subtotal * ORDER_TAX_RATE)

  return {
    subtotal,
    shippingCost,
    taxRate: ORDER_TAX_RATE,
    taxAmount,
    total: roundCurrency(subtotal + shippingCost + taxAmount),
  }
}

module.exports = { calculateOrderTotals, roundCurrency, ORDER_TAX_RATE }