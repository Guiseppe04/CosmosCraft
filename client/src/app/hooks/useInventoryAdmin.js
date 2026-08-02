import { useState, useCallback, useEffect, useRef } from 'react'
import { adminApi } from '../utils/adminApi'

export function useInventoryAdmin({ products, showToast }) {
  const [inventory, setInventory] = useState([])
  const [inventoryStats, setInventoryStats] = useState(null)
  const [salesReport, setSalesReport] = useState(null)
  const inventoryRef = useRef(inventory)
  const inventoryStatsRef = useRef(inventoryStats)
  const salesReportRef = useRef(salesReport)

  useEffect(() => {
    inventoryRef.current = inventory
  }, [inventory])

  useEffect(() => {
    inventoryStatsRef.current = inventoryStats
  }, [inventoryStats])

  useEffect(() => {
    salesReportRef.current = salesReport
  }, [salesReport])

  const fetchInventory = useCallback(async (options = {}) => {
    const { silent = false } = options
    try {
      const statsRes = await adminApi.getInventorySummary()
      const nextStats = statsRes.data || {}
      if (JSON.stringify(inventoryStatsRef.current) !== JSON.stringify(nextStats)) {
        inventoryStatsRef.current = nextStats
        setInventoryStats(nextStats)
      }

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
      if (JSON.stringify(inventoryRef.current) !== JSON.stringify(newData)) {
        inventoryRef.current = newData
        setInventory(newData)
      }
    } catch (e) {
      if (!silent) showToast(e.message, 'error')
      throw e
    }
  }, [showToast, products])

  const fetchSalesReport = useCallback(async () => {
    try {
      const res = await adminApi.getSalesReport()
      const nextSalesReport = res.data || {}
      if (JSON.stringify(salesReportRef.current) !== JSON.stringify(nextSalesReport)) {
        salesReportRef.current = nextSalesReport
        setSalesReport(nextSalesReport)
      }
    } catch (e) {
      showToast(e.message, 'error')
      const fallbackSalesReport = {
        totalGrossSales: 0, totalTransactions: 0, averagePerTransaction: 0, customizationOrders: 0,
        walkInSales: 0, walkInTransactions: 0, walkInAvg: 0, walkInPercentage: 0,
        onlineSales: 0, onlineTransactions: 0, onlineAvg: 0, onlinePercentage: 0,
        customizationSales: 0, customizationTransactions: 0, customizationAvg: 0, customizationPercentage: 0,
        dailySales: 0, dailyTransactions: 0, weeklySales: 0, weeklyTransactions: 0,
        monthlySales: 0, monthlyTransactions: 0, bestSellingProducts: [], customizationTypes: [],
        customizationRevenue: 0, avgCustomization: 0, walkInConversion: 0, onlineConversion: 0,
      }
      if (JSON.stringify(salesReportRef.current) !== JSON.stringify(fallbackSalesReport)) {
        salesReportRef.current = fallbackSalesReport
        setSalesReport(fallbackSalesReport)
      }
    }
  }, [showToast])

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
