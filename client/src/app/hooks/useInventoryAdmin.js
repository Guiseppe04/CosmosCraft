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

  const fetchSalesReport = useCallback(async (filters = {}) => {
    try {
      const res = await adminApi.getSalesReport(filters)
      const nextSalesReport = res.data || {}
      if (JSON.stringify(salesReportRef.current) !== JSON.stringify(nextSalesReport)) {
        salesReportRef.current = nextSalesReport
        setSalesReport(nextSalesReport)
      }
    } catch (e) {
      showToast(e.message, 'error')
      const fallbackSalesReport = {
        grossSales: 0, totalAdjustments: 0, netSales: 0, totalTransactions: 0,
        averagePerTransaction: 0, customizationOrders: 0,
        channels: {
          walkIn: { gross: 0, adjustments: 0, net: 0, transactions: 0 },
          online: { gross: 0, adjustments: 0, net: 0, transactions: 0 },
          customization: { gross: 0, adjustments: 0, net: 0, transactions: 0 },
          appointments: { gross: 0, adjustments: 0, net: 0, transactions: 0 },
        },
        adjustmentsByType: [],
        adjustmentsByChannel: [],
        adjustmentRate: 0,
        dailyTrend: [],
        bestSellingProducts: [],
        topAdjustedProducts: [],
        refundReasons: [],
        appointmentPaymentMethods: [],
        dailySales: 0, dailyTransactions: 0,
        weeklySales: 0, weeklyTransactions: 0,
        monthlySales: 0, monthlyTransactions: 0,
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
