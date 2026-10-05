export const SHIPPING_FEE_NOTE = 'Please note that any additional shipping fee will be shouldered by the customer and paid separately. The exact shipping fee will be shown once your order has been updated to "Shipped" by the shop. Thank you for your understanding!'

export function isValidShippingFee(value) {
  if (value === null || value === undefined || !/^(?:\d+)(?:\.\d{1,2})?$/.test(String(value).trim())) return false
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 && amount <= 9999999999.99
}
