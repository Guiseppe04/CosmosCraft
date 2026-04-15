/**
 * Currency formatting utility for Philippine Peso (PHP)
 * Prices are stored directly in PHP - no conversion needed
 */

// No exchange rate - amounts are already in PHP
const USD_TO_PHP_RATE = 1

/**
 * Format a number as Philippine Peso
 * @param {number} amount - The amount to format (in PHP)
 * @param {boolean} isUSD - Unused, kept for backward compatibility
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount, isUSD = false) {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  
  // Amounts are already in PHP - no conversion needed
  const phpAmount = numericAmount
  
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
 * @param {boolean} isUSD - Unused, kept for backward compatibility
 * @returns {number} The numeric amount in PHP
 */
export function toPHP(amount, isUSD = false) {
  const numericAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  return numericAmount
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
  return 1
}
