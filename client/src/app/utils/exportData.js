/**
 * Export Utilities for CSV and PDF generation
 * Used for exporting dashboard data
 */

import { formatCurrency } from './formatCurrency'

// ============================================
// CSV EXPORT UTILITIES
// ============================================

/**
 * Convert data array to CSV string
 */
export function arrayToCSV(data, headers) {
  const headerRow = headers.map(h => `"${h.label}"`).join(',')
  const rows = data.map(item => 
    headers.map(h => {
      let value = item[h.key]
      
      // Format currency values
      if (h.format === 'currency') {
        value = formatCurrency(value, true)
      }
      
      // Format dates
      if (h.format === 'date') {
        value = new Date(value).toLocaleDateString('en-PH')
      }
      
      // Format status with colors (strip HTML)
      if (h.format === 'status') {
        value = value.replace(/<[^>]*>/g, '')
      }
      
      // Escape quotes and wrap in quotes
      value = String(value || '').replace(/"/g, '""')
      return `"${value}"`
    }).join(',')
  )
  
  return [headerRow, ...rows].join('\n')
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export users to CSV
 */
export function exportUsersToCSV(users) {
  const headers = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'orders', label: 'Total Orders' },
    { key: 'totalSpent', label: 'Total Spent', format: 'currency' },
    { key: 'joined', label: 'Joined Date', format: 'date' },
  ]
  
  const csv = arrayToCSV(users, headers)
  downloadCSV(csv, 'users')
}

/**
 * Export products to CSV
 */
export function exportProductsToCSV(products) {
  const headers = [
    { key: 'id', label: 'Product ID' },
    { key: 'name', label: 'Product Name' },
    { key: 'category', label: 'Category' },
    { key: 'price', label: 'Price (USD)', format: 'currency' },
    { key: 'stock', label: 'Stock' },
    { key: 'sold', label: 'Units Sold' },
    { key: 'status', label: 'Status' },
  ]
  
  const csv = arrayToCSV(products, headers)
  downloadCSV(csv, 'products')
}

/**
 * Export orders to CSV
 */
export function exportOrdersToCSV(orders) {
  const headers = [
    { key: 'id', label: 'Order ID' },
    { key: 'customer', label: 'Customer' },
    { key: 'customerEmail', label: 'Email' },
    { key: 'product', label: 'Product' },
    { key: 'amount', label: 'Amount (USD)', format: 'currency' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Order Date', format: 'date' },
  ]
  
  const csv = arrayToCSV(orders, headers)
  downloadCSV(csv, 'orders')
}

/**
 * Export projects to CSV
 */
export function exportProjectsToCSV(projects) {
  const headers = [
    { key: 'id', label: 'Project ID' },
    { key: 'name', label: 'Project Name' },
    { key: 'customer', label: 'Customer' },
    { key: 'assignedStaff', label: 'Assigned Staff' },
    { key: 'totalPrice', label: 'Value (USD)', format: 'currency' },
    { key: 'stage', label: 'Current Stage' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start Date', format: 'date' },
    { key: 'estimatedCompletion', label: 'Est. Completion', format: 'date' },
  ]
  
  const csv = arrayToCSV(projects, headers)
  downloadCSV(csv, 'projects')
}

/**
 * Export appointments to CSV
 */
export function exportAppointmentsToCSV(appointments) {
  const headers = [
    { key: 'id', label: 'Appointment ID' },
    { key: 'customer', label: 'Customer' },
    { key: 'service', label: 'Service' },
    { key: 'date', label: 'Date', format: 'date' },
    { key: 'time', label: 'Time' },
    { key: 'status', label: 'Status' },
  ]
  
  const csv = arrayToCSV(appointments, headers)
  downloadCSV(csv, 'appointments')
}

// ============================================
// PDF EXPORT UTILITIES
// ============================================

/**
 * Generate HTML template for PDF
 */
function generatePDFHTML(title, data, columns) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          padding: 20px;
          color: #333;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #D4AF37;
        }
        .header h1 {
          color: #D4AF37;
          font-size: 24px;
          margin-bottom: 5px;
        }
        .header p {
          color: #666;
          font-size: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 12px 8px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #D4AF37;
          color: #000;
          font-weight: 600;
          text-transform: uppercase;
          font-size: 11px;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        tr:hover {
          background-color: #f5f5f5;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          color: #666;
          font-size: 11px;
        }
        .summary {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .summary-item {
          display: inline-block;
          margin-right: 30px;
        }
        .summary-label {
          color: #666;
          font-size: 11px;
        }
        .summary-value {
          font-size: 16px;
          font-weight: bold;
          color: #D4AF37;
        }
        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CosmosCraft</h1>
        <p>${title}</p>
        <p>Generated on ${new Date().toLocaleDateString('en-PH', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            ${columns.map(col => `<th>${col.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(item => `
            <tr>
              ${columns.map(col => {
                let value = item[col.key]
                if (col.format === 'currency') value = formatCurrency(value, true)
                if (col.format === 'date') value = new Date(value).toLocaleDateString('en-PH')
                return `<td>${value || '-'}</td>`
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div class="footer">
        <p>CosmosCraft Guitar Customization & Services</p>
        <p>This is an automated report. For inquiries, contact support@cosmoscraft.com</p>
      </div>
    </body>
    </html>
  `
}

/**
 * Export data to PDF using browser print
 */
export function exportToPDF(title, data, columns) {
  const html = generatePDFHTML(title, data, columns)
  
  // Create a new window for printing
  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

/**
 * Export users to PDF
 */
export function exportUsersToPDF(users) {
  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'role', label: 'Role' },
    { key: 'status', label: 'Status' },
    { key: 'orders', label: 'Orders' },
    { key: 'totalSpent', label: 'Total Spent', format: 'currency' },
  ]
  
  exportToPDF('Users Report', users, columns)
}

/**
 * Export orders to PDF
 */
export function exportOrdersToPDF(orders) {
  const columns = [
    { key: 'id', label: 'Order ID' },
    { key: 'customer', label: 'Customer' },
    { key: 'product', label: 'Product' },
    { key: 'amount', label: 'Amount', format: 'currency' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Date', format: 'date' },
  ]
  
  exportToPDF('Orders Report', orders, columns)
}

/**
 * Export projects to PDF
 */
export function exportProjectsToPDF(projects) {
  const columns = [
    { key: 'id', label: 'Project ID' },
    { key: 'name', label: 'Project' },
    { key: 'customer', label: 'Customer' },
    { key: 'assignedStaff', label: 'Staff' },
    { key: 'totalPrice', label: 'Value', format: 'currency' },
    { key: 'status', label: 'Status' },
  ]
  
  exportToPDF('Projects Report', projects, columns)
}

/**
 * Export dashboard summary to PDF
 */
export function exportDashboardSummaryPDF(stats, recentOrders, topProducts) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Dashboard Summary</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #D4AF37; }
        .header h1 { color: #D4AF37; font-size: 24px; margin-bottom: 5px; }
        .header p { color: #666; font-size: 12px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; color: #D4AF37; }
        .stat-label { font-size: 11px; color: #666; margin-top: 5px; }
        .section { margin-bottom: 30px; }
        .section h2 { color: #D4AF37; font-size: 16px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #ddd; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; font-size: 12px; }
        th { background-color: #D4AF37; color: #000; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 11px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>CosmosCraft Dashboard</h1>
        <p>Summary Report - ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      
      <div class="stats-grid">
        ${stats.map(stat => `
          <div class="stat-card">
            <div class="stat-value">${stat.format === 'currency' ? formatCurrency(stat.value, true) : stat.value}</div>
            <div class="stat-label">${stat.label}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="section">
        <h2>Recent Orders</h2>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${recentOrders.map(order => `
              <tr>
                <td>${order.id}</td>
                <td>${order.customer}</td>
                <td>${order.product}</td>
                <td>${formatCurrency(order.amount, true)}</td>
                <td>${order.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="section">
        <h2>Top Products</h2>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Sold</th>
            </tr>
          </thead>
          <tbody>
            ${topProducts.map(product => `
              <tr>
                <td>${product.name}</td>
                <td>${product.category}</td>
                <td>${formatCurrency(product.price, true)}</td>
                <td>${product.sold}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <p>CosmosCraft Guitar Customization & Services</p>
        <p>Generated by CosmosCraft Admin System</p>
      </div>
    </body>
    </html>
  `
  
  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.onload = () => {
    printWindow.focus()
    printWindow.print()
  }
}

export default {
  exportUsersToCSV,
  exportProductsToCSV,
  exportOrdersToCSV,
  exportProjectsToCSV,
  exportAppointmentsToCSV,
  exportUsersToPDF,
  exportOrdersToPDF,
  exportProjectsToPDF,
  exportDashboardSummaryPDF,
}
