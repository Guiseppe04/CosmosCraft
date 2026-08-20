/**
 * Shared stock status utilities.
 *
 * For PRODUCTS:
 *   low_stock_threshold is a percentage (1-100) of max_stock.
 *   lowStockLimit = max_stock * (low_stock_threshold / 100)
 *
 * For GUITAR PARTS (no max_stock):
 *   low_stock_threshold is an absolute unit count (e.g. 10).
 *   The percentage path is bypassed and absolute logic is used.
 */

const DEFAULT_LOW_STOCK_THRESHOLD_PCT = 10;

/**
 * Compute the low-stock limit (absolute units) at which a product is
 * considered "Low Stock".
 *
 * @param {number|null} maxStock   – the product's maximum stock capacity
 * @param {number}      threshold  – percentage (when maxStock is set) or absolute units (when not)
 * @returns {number} lowStockLimit in absolute units
 */
export function getLowStockLimit(maxStock, threshold) {
  const ms = Number(maxStock) || 0;
  const t = Number(threshold) || 0;
  if (ms > 0) {
    return ms * (t / 100);
  }
  // Fallback: no max_stock → treat threshold as absolute units
  return t;
}

/**
 * Returns the stock status for display purposes.
 *  - 'out_of_stock'  → stock <= 0
 *  - 'low_stock'     → 0 < stock <= lowStockLimit
 *  - 'in_stock'      → stock > lowStockLimit
 *
 * @param {number} stock
 * @param {number} lowStockThreshold  – percentage (1-100) when max_stock is set, absolute units otherwise
 * @param {number|null} maxStock
 * @returns {'out_of_stock'|'low_stock'|'in_stock'}
 */
export function getStockStatus(stock, lowStockThreshold, maxStock) {
  const s = Number(stock) || 0;
  if (s <= 0) return 'out_of_stock';

  const lowStockLimit = getLowStockLimit(maxStock, lowStockThreshold);
  if (s <= lowStockLimit) return 'low_stock';
  return 'in_stock';
}

/**
 * Returns a 4-tier stock classification used by filters/sorting.
 *  - 'out_of_stock' → stock <= 0
 *  - 'critical'     → in Low Stock tier (0 < stock <= lowStockLimit)
 *  - 'warning'    → between lowStockLimit and maxStock (or threshold*2 for parts)
 *  - 'healthy'    → at or above maxStock (or above threshold*2 for parts)
 *
 * @param {number} stock
 * @param {number} lowStockThreshold
 * @param {number|null} maxStock
 * @returns {'out_of_stock'|'critical'|'warning'|'healthy'}
 */
export function getStockTier(stock, lowStockThreshold, maxStock) {
  const s = Number(stock) || 0;
  if (s <= 0) return 'out_of_stock';

  const ms = Number(maxStock) || 0;
  const t = Number(lowStockThreshold) || DEFAULT_LOW_STOCK_THRESHOLD_PCT;

  if (ms > 0) {
    // Percentage-based logic (products)
    const lowStockLimit = ms * (t / 100);
    if (s <= lowStockLimit) return 'critical';
    if (s < ms) return 'warning';
    return 'healthy';
  }

  // Absolute-unit fallback (guitar parts)
  if (s <= t) return 'critical';
  if (s < t * 2) return 'warning';
  return 'healthy';
}

/**
 * Returns a human-readable label and styling for the stock status.
 *
 * @param {number} stock
 * @param {number} lowStockThreshold
 * @param {number|null} maxStock
 * @returns {{ status: string, label: string, color: string, dotClass: string, lowStockLimit: number }}
 */
export function getStockStatusInfo(stock, lowStockThreshold, maxStock) {
  const s = Number(stock) || 0;
  const lowStockLimit = getLowStockLimit(maxStock, lowStockThreshold);
  const status = getStockStatus(s, lowStockThreshold, maxStock);

  let label, color, dotClass;
  switch (status) {
    case 'out_of_stock':
      label = 'Out of Stock';
      color = 'text-red-400';
      dotClass = 'bg-red-500';
      break;
    case 'low_stock':
      label = 'Low Stock';
      color = 'text-amber-400';
      dotClass = 'bg-amber-500';
      break;
    case 'in_stock':
    default:
      label = 'In Stock';
      color = 'text-emerald-400';
      dotClass = 'bg-emerald-500';
      break;
  }

  return { status, label, color, dotClass, lowStockLimit };
}

/**
 * Format the helper text for the percentage threshold.
 * e.g. "10% of 100 = 10 units or less"
 *
 * @param {number} thresholdPct
 * @param {number|null} maxStock
 * @returns {string}
 */
export function formatLowStockHelper(thresholdPct, maxStock) {
  const pct = Number(thresholdPct) || DEFAULT_LOW_STOCK_THRESHOLD_PCT;
  const ms = Number(maxStock) || 0;
  if (ms > 0) {
    const limit = ms * (pct / 100);
    const rounded = Number.isInteger(limit) ? limit : limit.toFixed(1);
    return `${pct}% of ${ms} = ${rounded} units or less`;
  }
  return `${pct}% threshold`;
}
