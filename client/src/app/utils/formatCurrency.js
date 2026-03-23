/**
 * Currency formatting utility for Philippine Peso (PHP)
 * Converts USD amounts to PHP using a fixed exchange rate for demo
 * In production, this would fetch real-time exchange rates
 */

// Exchange rate: 1 USD = 56 PHP (approximate)
const USD_TO_PHP_RATE = 56

/**
 * Format a number as Philippine Peso
 * @param {number} amount - The amount to format (in USD or raw number)
 * @param {boolean} isUSD - Whether the amount is in USD (will convert to PHP)
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, isUSD = false) {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  
  // Convert to PHP if amount is in USD
  const phpAmount = isUSD ? numericAmount * USD_TO_PHP_RATE : numericAmount
  
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(phpAmount)
}

/**
 * Format a number as Philippine Peso without currency symbol
 * Useful for calculations
 * @param {number} amount - The amount to format
 * @param {boolean} isUSD - Whether the amount is in USD
 * @returns {number} The numeric amount in PHP
 */
export function toPHP(amount, isUSD = false) {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  return isUSD ? numericAmount * USD_TO_PHP_RATE : numericAmount
}

/**
 * Format a number with thousand separators
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
  return new Intl.NumberFormat('en-PH').format(num)
}

/**
 * Get the exchange rate used
 * @returns {number} The current USD to PHP exchange rate
 */
export function getExchangeRate() {
  return USD_TO_PHP_RATE
}
