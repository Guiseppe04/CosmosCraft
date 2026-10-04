import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import { getStockTier, getStockStatus, getLowStockLimit, isStockAttentionRequired } from '../src/app/utils/stockUtils.js'

describe('Inventory Stock Calculation and Edge Cases', () => {
  test('Out of stock calculation for 0 and negative stock', () => {
    assert.equal(getStockStatus(0, 10, 100), 'out_of_stock')
    assert.equal(getStockStatus(-1, 10, 100), 'out_of_stock')
    assert.equal(getStockStatus(-10, 10, 100), 'out_of_stock')

    assert.equal(getStockTier(0, 10, 100), 'out_of_stock')
    assert.equal(getStockTier(-1, 10, 100), 'out_of_stock')
    assert.equal(getStockTier(-5, 10, 100), 'out_of_stock')

    assert.equal(isStockAttentionRequired(0, 10, 100), true)
    assert.equal(isStockAttentionRequired(-2, 10, 100), true)
  })

  test('Low stock calculation with maxStock percentage threshold', () => {
    // maxStock = 100, threshold = 10% -> lowStockLimit = 10
    assert.equal(getLowStockLimit(100, 10), 10)

    // At limit (10): low stock
    assert.equal(getStockStatus(10, 10, 100), 'low_stock')
    assert.equal(getStockTier(10, 10, 100), 'critical')
    assert.equal(isStockAttentionRequired(10, 10, 100), true)

    // Below limit (5): low stock
    assert.equal(getStockStatus(5, 10, 100), 'low_stock')
    assert.equal(getStockTier(5, 10, 100), 'critical')
    assert.equal(isStockAttentionRequired(5, 10, 100), true)

    // Just above limit (11): in stock (not low stock)
    assert.equal(getStockStatus(11, 10, 100), 'in_stock')
    assert.equal(getStockTier(11, 10, 100), 'warning') // warning band between limit and maxStock
    assert.equal(isStockAttentionRequired(11, 10, 100), false)

    // At maxStock (100): in stock / healthy
    assert.equal(getStockStatus(100, 10, 100), 'in_stock')
    assert.equal(getStockTier(100, 10, 100), 'healthy')
    assert.equal(isStockAttentionRequired(100, 10, 100), false)
  })

  test('Low stock calculation with absolute units (when maxStock is not set or 0)', () => {
    // maxStock = 0, threshold = 10 -> limit = 10
    assert.equal(getLowStockLimit(0, 10), 10)

    assert.equal(getStockStatus(10, 10, 0), 'low_stock')
    assert.equal(getStockTier(10, 10, 0), 'critical')
    assert.equal(isStockAttentionRequired(10, 10, 0), true)

    assert.equal(getStockStatus(1, 10, 0), 'low_stock')
    assert.equal(getStockTier(1, 10, 0), 'critical')

    assert.equal(getStockStatus(11, 10, 0), 'in_stock')
    assert.equal(isStockAttentionRequired(11, 10, 0), false)
  })
})

describe('Inventory Filter Matching Logic', () => {
  const products = [
    { product_id: 'p1', name: 'Guitar A', stock: 0, low_stock_threshold: 10, max_stock: 100 }, // out_of_stock
    { product_id: 'p2', name: 'Guitar B', stock: -1, low_stock_threshold: 10, max_stock: 100 }, // out_of_stock
    { product_id: 'p3', name: 'Guitar C', stock: 5, low_stock_threshold: 10, max_stock: 100 }, // low_stock (critical)
    { product_id: 'p4', name: 'Guitar D', stock: 10, low_stock_threshold: 10, max_stock: 100 }, // low_stock (critical)
    { product_id: 'p5', name: 'Guitar E', stock: 15, low_stock_threshold: 10, max_stock: 100 }, // warning
    { product_id: 'p6', name: 'Guitar F', stock: 100, low_stock_threshold: 10, max_stock: 100 }, // healthy
  ]

  function filterByStatus(items, statusFilter) {
    if (statusFilter === 'all') return items
    return items.filter(item => {
      const stock = Number(item.stock ?? 0)
      const threshold = Number(item.low_stock_threshold ?? 10)
      const tier = getStockTier(stock, threshold, item.max_stock)
      if (statusFilter === 'out_of_stock') return tier === 'out_of_stock'
      if (statusFilter === 'low_stock' || statusFilter === 'critical') return tier === 'critical'
      if (statusFilter === 'attention' || statusFilter === 'issues') return tier === 'out_of_stock' || tier === 'critical'
      if (statusFilter === 'warning') return tier === 'warning'
      if (statusFilter === 'healthy') return tier === 'healthy'
      return true
    })
  }

  test('Filter out_of_stock returns only out of stock products', () => {
    const res = filterByStatus(products, 'out_of_stock')
    assert.deepEqual(res.map(p => p.product_id), ['p1', 'p2'])
    assert.equal(res.length, 2)
  })

  test('Filter low_stock returns only low stock products', () => {
    const res = filterByStatus(products, 'low_stock')
    assert.deepEqual(res.map(p => p.product_id), ['p3', 'p4'])
    assert.equal(res.length, 2)
  })

  test('Filter attention returns both out_of_stock and low_stock products', () => {
    const res = filterByStatus(products, 'attention')
    assert.deepEqual(res.map(p => p.product_id), ['p1', 'p2', 'p3', 'p4'])
    assert.equal(res.length, 4)
  })

  test('Filter critical is backward-compatible with low_stock', () => {
    const res = filterByStatus(products, 'critical')
    assert.deepEqual(res.map(p => p.product_id), ['p3', 'p4'])
  })

  test('Filter healthy returns healthy products', () => {
    const res = filterByStatus(products, 'healthy')
    assert.deepEqual(res.map(p => p.product_id), ['p6'])
  })
})
