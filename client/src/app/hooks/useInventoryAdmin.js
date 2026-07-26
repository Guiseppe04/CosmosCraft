import { useState, useCallback } from 'react'
import { adminApi } from '../utils/adminApi'
import { updateIfChanged } from '../pages/admin/utils/slug'

export function useInventoryAdmin({ products, showToast }) {
  const [inventory, setInventory] = useState([])
  const [inventoryStats, setInventoryStats] = useState(null)
  const [salesReport, setSalesReport] = useState(null)

  const fetchInventory = useCallback(async () => {
    try {
      const statsRes = await adminApi.getInventorySummary()
      updateIfChanged(inventoryStats, statsRes.data || {}, setInventoryStats)
      const prodsRes = await adminApi.getInventoryProducts()
      const rawData = Array.isArray(prodsRes.data) ? prodsRes.data : prodsRes.data?.products || []
      const productImageMap = new Map(
        (products || []).map((product) => [
          product.product_id,
          product.primary_image || product.image_url || product.product_image || null,
        ])
      )
      const newData = rawData.map((item) => ({
        ...item,
        primary_image: item.primary_image || item.image_url || item.product_image || productImageMap.get(item.product_id) || null,
      }))
      updateIfChanged(inventory, newData, setInventory)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }, [showToast, inventoryStats, inventory, products])

  const fetchSalesReport = useCallback(async () => {
    try {
      const res = await adminApi.getSalesReport()
      updateIfChanged(salesReport, res.data || {}, setSalesReport)
    } catch (e) {
      showToast(e.message, 'error')
      setSalesReport({
        totalGrossSales: 0, totalTransactions: 0, averagePerTransaction: 0, customizationOrders: 0,
        walkInSales: 0, walkInTransactions: 0, walkInAvg: 0, walkInPercentage: 0,
        onlineSales: 0, onlineTransactions: 0, onlineAvg: 0, onlinePercentage: 0,
        customizationSales: 0, customizationTransactions: 0, customizationAvg: 0, customizationPercentage: 0,
        dailySales: 0, dailyTransactions: 0, weeklySales: 0, weeklyTransactions: 0,
        monthlySales: 0, monthlyTransactions: 0, bestSellingProducts: [], customizationTypes: [],
        customizationRevenue: 0, avgCustomization: 0, walkInConversion: 0, onlineConversion: 0,
      })
    }
  }, [showToast, salesReport])

  return {
    inventory,
    inventoryStats,
    salesReport,
    setInventory,
    setInventoryStats,
    setSalesReport,
    fetchInventory,
    fetchSalesReport,
  }
}
