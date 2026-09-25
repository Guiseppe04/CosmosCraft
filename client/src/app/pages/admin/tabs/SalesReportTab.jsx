import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import {
  BarChart3, DollarSign, ShoppingBag, TrendingUp, Printer,
  CreditCard, Calendar, ArrowDownRight, Download, RefreshCw,
  Filter, ChevronDown, X,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  format, startOfWeek, startOfMonth, endOfMonth, subMonths,
  startOfDay, endOfDay,
} from "date-fns";
import * as XLSX from "xlsx";
import { formatCurrency } from "../../../utils/formatCurrency";
import { useAuth } from "../../../context/AuthContext";

/* ─── Constants ─── */

const PRESETS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
];

const PRINT_SECTIONS = [
  { key: "summary", label: "Executive Summary (KPIs)", description: "Gross sales, net sales, transactions, averages" },
  { key: "channels", label: "Channel Breakdown", description: "Walk-in, online, customization, appointments" },
  { key: "adjustments", label: "Sales Adjustments", description: "Refunds, returns, voids by type and channel" },
  { key: "products", label: "Top Selling Products", description: "Best performing products by units and revenue" },
  { key: "customization", label: "Customization Performance", description: "Customization orders, revenue, and averages" },
  { key: "payments", label: "Payment Method Analysis", description: "Overall sales and appointment payment method breakdown" },
  { key: "dailyTrend", label: "Daily Sales Trend", description: "Day-by-day revenue and transaction count" },
  { key: "adjusted", label: "Top Adjusted / Returned Products", description: "Most refunded or returned items" },
  { key: "refundReasons", label: "Refund Reasons", description: "Breakdown of why refunds were issued" },
  { key: "performance", label: "Performance Summary", description: "Daily, weekly, and monthly totals" },
];

const DEFAULT_PRINT_SECTIONS = PRINT_SECTIONS.map((s) => s.key);

const CHANNEL_META = {
  walkIn: { label: "Walk-in / POS", color: "#10B981" },
  online: { label: "Online Orders", color: "#3B82F6" },
  customization: { label: "Customization", color: "#8B5CF6" },
  appointments: { label: "Appointments", color: "#F59E0B" },
};

const PAYMENT_COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#8B5CF6", "#EC4899", "#6366F1"];

/* ─── Helpers ─── */

function getPresetRange(preset) {
  const now = new Date();
  switch (preset) {
    case "today":
      return { start_date: format(startOfDay(now), "yyyy-MM-dd"), end_date: format(endOfDay(now), "yyyy-MM-dd") };
    case "week":
      return { start_date: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), end_date: format(endOfDay(now), "yyyy-MM-dd") };
    case "month":
      return { start_date: format(startOfMonth(now), "yyyy-MM-dd"), end_date: format(endOfDay(now), "yyyy-MM-dd") };
    case "last_month": {
      const last = subMonths(now, 1);
      return { start_date: format(startOfMonth(last), "yyyy-MM-dd"), end_date: format(endOfMonth(last), "yyyy-MM-dd") };
    }
    default:
      return {};
  }
}

function groupWeekly(data) {
  const weeks = [];
  for (let i = 0; i < data.length; i += 7) {
    const chunk = data.slice(i, Math.min(i + 7, data.length));
    weeks.push({
      date: chunk[0].date,
      label: `W${Math.floor(i / 7) + 1}`,
      gross: chunk.reduce((s, d) => s + d.gross, 0),
      net: chunk.reduce((s, d) => s + d.net, 0),
      transactions: chunk.reduce((s, d) => s + d.transactions, 0),
    });
  }
  return weeks;
}

function groupMonthly(data) {
  const months = {};
  data.forEach((d) => {
    const monthKey = d.date ? d.date.substring(0, 7) : "Unknown";
    if (!months[monthKey]) months[monthKey] = { date: d.date, label: monthKey, gross: 0, net: 0, transactions: 0 };
    months[monthKey].gross += d.gross;
    months[monthKey].net += d.net;
    months[monthKey].transactions += d.transactions;
  });
  return Object.values(months);
}

function fmtInteger(n) {
  return new Intl.NumberFormat("en-PH").format(Math.round(n || 0));
}

/* ─── Filename helper ─── */

function sanitizeFilename(str) {
  // Strip characters that are actually invalid in Windows/Mac/Linux filenames,
  // but leave spaces, dashes, and other readable characters untouched.
  return str.replace(/[\\/:*?"<>|]/g, "").trim();
}

function buildReportFilename(dateLabel, ext) {
  const period = dateLabel ? sanitizeFilename(dateLabel) : "All Time";
  return `CosmosCraft Sales Report - ${period}.${ext}`;
}

/* ─── Excel Table & Formatting Helper ─── */

function createExcelTableSheet(headers, rows, colFormats = [], options = {}) {
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (!ws["!ref"]) return ws;
  const range = XLSX.utils.decode_range(ws["!ref"]);

  // Apply number formats and typed values
  for (let R = 1; R <= range.e.r; ++R) {
    for (let C = 0; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (!cell || cell.v === undefined || cell.v === null) continue;

      let fmt = colFormats[C];
      if (options.getCellFormat) {
        const customFmt = options.getCellFormat(R - 1, C, cell.v, rows[R - 1]);
        if (customFmt) fmt = customFmt;
      }

      if (fmt === "currency") {
        cell.t = "n";
        cell.z = '"₱"#,##0.00';
      } else if (fmt === "int") {
        cell.t = "n";
        cell.z = "#,##0";
      } else if (fmt === "pct") {
        cell.t = "n";
        cell.z = '0.0"%"';
      } else if (fmt === "date") {
        cell.z = "yyyy-mm-dd";
      }
    }
  }

  // Calculate reasonable column widths based on cell content length
  const colWidths = headers.map((h, C) => {
    let maxLen = String(h || "").length;
    for (let R = 1; R <= range.e.r; ++R) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellRef];
      if (cell) {
        let valStr = "";
        if (cell.w) {
          valStr = cell.w;
        } else if (cell.v !== undefined && cell.v !== null) {
          let fmt = colFormats[C];
          if (options.getCellFormat) {
            const customFmt = options.getCellFormat(R - 1, C, cell.v, rows[R - 1]);
            if (customFmt) fmt = customFmt;
          }
          if (fmt === "currency") valStr = `₱${Number(cell.v).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
          else if (fmt === "pct") valStr = `${cell.v}%`;
          else if (fmt === "int") valStr = `${Number(cell.v).toLocaleString("en-PH")}`;
          else valStr = String(cell.v);
        }
        maxLen = Math.max(maxLen, valStr.length);
      }
    }
    const minW = options.minColWidth || 14;
    return { wch: Math.max(maxLen + 4, minW) };
  });
  ws["!cols"] = colWidths;

  // AutoFilter enables proper Excel Table filter dropdowns on the table header
  if (options.autofilter !== false && rows.length > 0) {
    ws["!autofilter"] = { ref: ws["!ref"] };
  }

  return ws;
}

function exportExcel(salesReport, dateLabel, printedBy, datePrinted) {
  if (!salesReport) return;
  const wb = XLSX.utils.book_new();
  const fc = (v) => Number((v || 0).toFixed(2));
  const fi = (v) => Math.round(v || 0);
  const pct = (v, total) => (total > 0 ? Number(((v / total) * 100).toFixed(1)) : 0);
  const chs = salesReport.channels || {};
  const ns = salesReport.netSales || 0;

  // 1. Report Info Table
  const infoHeaders = ["Report Metadata", "Details"];
  const infoRows = [
    ["Report Title", "CosmosCraft Sales Analytics Report"],
    ["Reporting Period", dateLabel || "All Time"],
    ["Generated On", new Date().toLocaleString("en-PH")],
    ["Exported By", printedBy || "Unknown User"],
    ["Print / Export Timestamp", datePrinted || new Date().toLocaleString("en-PH")],
    ["Currency", "Philippine Peso (PHP / ₱)"],
  ];
  XLSX.utils.book_append_sheet(wb, createExcelTableSheet(infoHeaders, infoRows, ["text", "text"]), "Report Info");

  // 2. Executive Summary Table
  const sumHeaders = ["Sales Metric", "Amount / Value", "Description / Notes"];
  const sumRows = [
    ["Gross Sales", fc(salesReport.grossSales), "Total unadjusted sales value across all channels"],
    ["Total Adjustments", fc(salesReport.totalAdjustments), "Refunds, returns, and canceled items deducted"],
    ["Net Sales", fc(salesReport.netSales), "Gross Sales minus Total Adjustments (Primary KPI)"],
    ["Total Transactions", fi(salesReport.totalTransactions), "Completed transactions across all channels"],
    ["Average per Transaction", fc(salesReport.averagePerTransaction), "Average revenue generated per transaction"],
    ["Customization Orders", fi(salesReport.customizationOrders), "Total custom product orders processed"],
    ["Adjustment Rate", salesReport.adjustmentRate || 0, "Adjustments as a percentage of gross sales"],
    ["Net as % of Gross", salesReport.grossSales > 0 ? Number((100 - (salesReport.adjustmentRate || 0)).toFixed(1)) : 0, "Percentage of gross sales retained as net revenue"],
  ];
  const sumSheet = createExcelTableSheet(sumHeaders, sumRows, ["text", "mixed", "text"], {
    getCellFormat: (rowIdx, colIdx) => {
      if (colIdx === 1) {
        if ([0, 1, 2, 4].includes(rowIdx)) return "currency";
        if ([3, 5].includes(rowIdx)) return "int";
        if ([6, 7].includes(rowIdx)) return "pct";
      }
      return "text";
    },
  });
  XLSX.utils.book_append_sheet(wb, sumSheet, "Executive Summary");

  // 3. Channels Table
  const chHeaders = ["Sales Channel", "Transactions", "Gross Sales", "Adjustments", "Net Sales", "% of Net Sales"];
  const chRows = [];
  Object.entries(chs).forEach(([key, ch]) => {
    const lbl = (CHANNEL_META[key] || { label: key }).label;
    chRows.push([lbl, fi(ch.transactions), fc(ch.gross), fc(ch.adjustments), fc(ch.net), pct(ch.net, ns)]);
  });
  chRows.push(["TOTAL", fi(salesReport.totalTransactions), fc(salesReport.grossSales), fc(salesReport.totalAdjustments), fc(salesReport.netSales), 100]);
  XLSX.utils.book_append_sheet(
    wb,
    createExcelTableSheet(chHeaders, chRows, ["text", "int", "currency", "currency", "currency", "pct"]),
    "Channels"
  );

  // 4. Adjustments by Type Table
  const adjTypes = salesReport.adjustmentsByType || [];
  const totAdjAmt = salesReport.totalAdjustments || 0;
  const adjTypeHeaders = ["Adjustment Type", "Count", "Total Amount", "% of Adjustments"];
  const adjTypeRows = adjTypes.map((a) => {
    const typeName = (a.type || "Unknown").charAt(0).toUpperCase() + (a.type || "Unknown").slice(1) + "s";
    return [typeName, fi(a.count), fc(a.amount), pct(a.amount, totAdjAmt)];
  });
  adjTypeRows.push(["TOTAL", fi(adjTypes.reduce((s, a) => s + (a.count || 0), 0)), fc(totAdjAmt), 100]);
  XLSX.utils.book_append_sheet(
    wb,
    createExcelTableSheet(adjTypeHeaders, adjTypeRows, ["text", "int", "currency", "pct"]),
    "Adjustments - Type"
  );

  // 5. Adjustments by Channel Table
  const adjChannels = salesReport.adjustmentsByChannel || [];
  const adjChHeaders = ["Sales Channel", "Count", "Total Amount", "% of Adjustments"];
  const adjChRows = adjChannels.map((a) => {
    const chLabel = (CHANNEL_META[a.channel] || {}).label || a.channel;
    return [chLabel, fi(a.count), fc(a.amount), pct(a.amount, totAdjAmt)];
  });
  adjChRows.push(["TOTAL", fi(adjChannels.reduce((s, a) => s + (a.count || 0), 0)), fc(totAdjAmt), 100]);
  XLSX.utils.book_append_sheet(
    wb,
    createExcelTableSheet(adjChHeaders, adjChRows, ["text", "int", "currency", "pct"]),
    "Adjustments - Channel"
  );

  // 6. Top Products Table
  if ((salesReport.bestSellingProducts || []).length > 0) {
    const pHeaders = ["Rank", "Product Name", "Category", "Units Sold", "Total Revenue", "Avg Price per Unit"];
    const pRows = salesReport.bestSellingProducts.map((p, i) => [
      i + 1,
      p.name,
      p.category || "—",
      fi(p.units),
      fc(p.revenue),
      fc(p.units > 0 ? p.revenue / p.units : 0),
    ]);
    XLSX.utils.book_append_sheet(
      wb,
      createExcelTableSheet(pHeaders, pRows, ["int", "text", "text", "int", "currency", "currency"]),
      "Top Products"
    );
  }

  // 7. Customization Table
  const cc = chs.customization || {};
  const co = salesReport.customizationOrders || 0;
  const custHeaders = ["Customization Metric", "Amount / Value", "Notes"];
  const custRows = [
    ["Total Customization Orders", fi(co), "Total custom keyboard builds & requests"],
    ["Gross Sales", fc(cc.gross), "Customization gross billings"],
    ["Adjustments", fc(cc.adjustments), "Customization refunds or deductions"],
    ["Net Sales", fc(cc.net), "Gross minus adjustments"],
    ["Total Transactions", fi(cc.transactions), "Number of transactions"],
    ["Avg Order Value", fc(co > 0 ? (cc.net || 0) / co : 0), "Average net revenue per custom order"],
    ["% of Total Net Sales", pct(cc.net, ns), "Share of company-wide net sales"],
  ];
  const custSheet = createExcelTableSheet(custHeaders, custRows, ["text", "mixed", "text"], {
    getCellFormat: (rowIdx, colIdx) => {
      if (colIdx === 1) {
        if ([1, 2, 3, 5].includes(rowIdx)) return "currency";
        if ([0, 4].includes(rowIdx)) return "int";
        if (rowIdx === 6) return "pct";
      }
      return "text";
    },
  });
  XLSX.utils.book_append_sheet(wb, custSheet, "Customization");

  // 8. Order Payment Methods Table
  const om = salesReport.orderPaymentMethods || [];
  if (om.length > 0) {
    const oHeaders = ["Payment Method", "Transactions", "Total Amount", "% of Volume", "Avg Transaction"];
    const oAmt = om.reduce((s, m) => s + (m.amount || 0), 0);
    const oTx = om.reduce((s, m) => s + (m.transactions || 0), 0);
    const oRows = om.map((m) => {
      const lbl = m.method === "gcash" ? "GCash" : m.method === "bank_transfer" ? "Bank Transfer" : m.method;
      return [lbl, fi(m.transactions), fc(m.amount), pct(m.amount, oAmt), fc(m.transactions > 0 ? (m.amount || 0) / m.transactions : 0)];
    });
    oRows.push(["TOTAL", fi(oTx), fc(oAmt), 100, fc(oTx > 0 ? oAmt / oTx : 0)]);
    XLSX.utils.book_append_sheet(
      wb,
      createExcelTableSheet(oHeaders, oRows, ["text", "int", "currency", "pct", "currency"]),
      "Payments - Orders"
    );
  }

  // 9. Appointment Payment Methods Table
  const am = salesReport.appointmentPaymentMethods || [];
  if (am.length > 0) {
    const aHeaders = ["Payment Method", "Appointments", "Total Revenue", "% of Appt Payments", "Avg Transaction"];
    const aRev = am.reduce((s, m) => s + (m.revenue || 0), 0);
    const aAp = am.reduce((s, m) => s + (m.appointments || 0), 0);
    const aRows = am.map((m) => {
      const lbl = m.method === "cash" ? "Cash" : m.method === "gcash" ? "GCash" : m.method === "bank_transfer" ? "Bank Transfer" : m.method;
      return [lbl, fi(m.appointments), fc(m.revenue), pct(m.revenue, aRev), fc(m.appointments > 0 ? (m.revenue || 0) / m.appointments : 0)];
    });
    aRows.push(["TOTAL", fi(aAp), fc(aRev), 100, fc(aAp > 0 ? aRev / aAp : 0)]);
    XLSX.utils.book_append_sheet(
      wb,
      createExcelTableSheet(aHeaders, aRows, ["text", "int", "currency", "pct", "currency"]),
      "Payments - Appts"
    );
  }

  // 10. Daily Trend Table
  if ((salesReport.dailyTrend || []).length > 0) {
    const tHeaders = ["Date", "Revenue", "Transactions", "Avg per Transaction"];
    const tRows = salesReport.dailyTrend.map((d) => [
      d.date,
      fc(d.revenue),
      fi(d.transactions),
      fc(d.transactions > 0 ? (d.revenue || 0) / d.transactions : 0),
    ]);
    const totRev = salesReport.dailyTrend.reduce((s, d) => s + (d.revenue || 0), 0);
    const totTx = salesReport.dailyTrend.reduce((s, d) => s + (d.transactions || 0), 0);
    tRows.push(["TOTAL", fc(totRev), fi(totTx), fc(totTx > 0 ? totRev / totTx : 0)]);
    XLSX.utils.book_append_sheet(
      wb,
      createExcelTableSheet(tHeaders, tRows, ["text", "currency", "int", "currency"]),
      "Daily Trend"
    );
  }

  // 11. Top Adjusted Products Table
  if ((salesReport.topAdjustedProducts || []).length > 0) {
    const apHeaders = ["Product Name", "Adjustment Amount", "Primary Reason"];
    const apRows = salesReport.topAdjustedProducts.map((p) => [p.name, fc(p.adjustmentAmount), p.reason || "—"]);
    XLSX.utils.book_append_sheet(
      wb,
      createExcelTableSheet(apHeaders, apRows, ["text", "currency", "text"]),
      "Adjusted Products"
    );
  }

  // 12. Refund Reasons Table
  if ((salesReport.refundReasons || []).length > 0) {
    const totRefundAmt = salesReport.refundReasons.reduce((s, r) => s + (r.amount || 0), 0);
    const totRefundCount = salesReport.refundReasons.reduce((s, r) => s + (r.count || 0), 0);
    const rrHeaders = ["Refund Reason", "Incident Count", "Total Amount", "% of Refund Amount"];
    const rrRows = salesReport.refundReasons.map((r) => [r.reason, fi(r.count), fc(r.amount), pct(r.amount, totRefundAmt)]);
    rrRows.push(["TOTAL", fi(totRefundCount), fc(totRefundAmt), 100]);
    XLSX.utils.book_append_sheet(
      wb,
      createExcelTableSheet(rrHeaders, rrRows, ["text", "int", "currency", "pct"]),
      "Refund Reasons"
    );
  }

  // 13. Performance Summary Table
  const perfHeaders = ["Period", "Revenue", "Transactions", "Avg per Transaction"];
  const perfRows = [
    ["Today", fc(salesReport.dailySales), fi(salesReport.dailyTransactions), fc(salesReport.dailyTransactions > 0 ? (salesReport.dailySales || 0) / salesReport.dailyTransactions : 0)],
    ["This Week", fc(salesReport.weeklySales), fi(salesReport.weeklyTransactions), fc(salesReport.weeklyTransactions > 0 ? (salesReport.weeklySales || 0) / salesReport.weeklyTransactions : 0)],
    ["This Month", fc(salesReport.monthlySales), fi(salesReport.monthlyTransactions), fc(salesReport.monthlyTransactions > 0 ? (salesReport.monthlySales || 0) / salesReport.monthlyTransactions : 0)],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    createExcelTableSheet(perfHeaders, perfRows, ["text", "currency", "int", "currency"]),
    "Performance"
  );

  XLSX.writeFile(wb, buildReportFilename(dateLabel, "xlsx"));
}

/* ─── Shared HTML builder (used by Print) ─── */

function buildSalesReportHTML(salesReport, dateLabel, selectedSections, printedBy, datePrinted) {
  if (!salesReport) return "";
  const sections = new Set(selectedSections || DEFAULT_PRINT_SECTIONS);
  const reportDate = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const printMetaDate = datePrinted || new Date().toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
  const printMetaBy = printedBy || "Unknown User";
  const channels = salesReport.channels || {};
  const adjustmentsByType = salesReport.adjustmentsByType || [];
  const adjustmentsByChannel = salesReport.adjustmentsByChannel || [];
  const bestSellingProducts = salesReport.bestSellingProducts || [];
  const topAdjustedProducts = salesReport.topAdjustedProducts || [];
  const refundReasons = salesReport.refundReasons || [];
  const orderPaymentMethods = salesReport.orderPaymentMethods || [];
  const appointmentPaymentMethods = salesReport.appointmentPaymentMethods || [];
  const dailyTrend = salesReport.dailyTrend || [];
  const custChannel = channels.customization || {};
  const custOrders = salesReport.customizationOrders || 0;
  const adjRate = salesReport.adjustmentRate || 0;
  const netSales = salesReport.netSales || 0;

  const fc = (v) => formatCurrency(v || 0);
  const fi = (v) => new Intl.NumberFormat("en-PH").format(Math.round(v || 0));
  const pct = (v, total) => (total > 0 ? ((v / total) * 100).toFixed(1) : "0.0");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>CosmosCraft Sales Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 24px; color: #000; background: #fff; font-size: 11px; line-height: 1.4; }
    .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #000; }
    .header h1 { font-size: 20px; margin-bottom: 2px; letter-spacing: 1px; }
    .header h2 { font-size: 14px; font-weight: normal; margin-bottom: 4px; }
    .header p { font-size: 10px; color: #444; }
    .section { margin-bottom: 16px; page-break-inside: avoid; }
    .section-title { font-size: 13px; font-weight: bold; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #000; text-transform: uppercase; letter-spacing: 0.5px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
    .kpi-card { padding: 10px; text-align: center; border: 1px solid #333; }
    .kpi-card .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #444; margin-bottom: 3px; }
    .kpi-card .value { font-size: 16px; font-weight: bold; }
    .kpi-card.primary { border-width: 2px; }
    .summary-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
    .summary-row .lbl { color: #444; }
    .summary-row .val { font-weight: bold; font-family: 'Courier New', monospace; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
    th { background: #f0f0f0; color: #000; padding: 5px 6px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #999; font-weight: bold; }
    th.r { text-align: right; }
    td { padding: 4px 6px; border: 1px solid #ccc; }
    td.r { text-align: right; font-family: 'Courier New', monospace; }
    td.b { font-weight: bold; }
    tr.total { background: #f0f0f0; font-weight: bold; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-box { border: 1px solid #333; padding: 8px; margin-bottom: 8px; }
    .info-box .title { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
    .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #000; text-align: center; font-size: 9px; color: #666; }
    @media print {
      body { padding: 12px; }
      .section { page-break-inside: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>COSMOSCRAFT</h1>
    <h2>Sales Performance Report</h2>
    <p>${dateLabel ? `Period: ${dateLabel}` : "All Time"} &nbsp;|&nbsp; Generated: ${reportDate}</p>
    <p style="margin-top: 4px; font-size: 9px; color: #555;">Date Printed: ${printMetaDate} &nbsp;|&nbsp; Printed By: ${printMetaBy}</p>
  </div>

  ${sections.has("summary") ? `
  <div class="section">
    <div class="section-title">Executive Summary</div>
    <div class="kpi-grid">
      <div class="kpi-card"><div class="label">Gross Sales</div><div class="value">${fc(salesReport.grossSales)}</div></div>
      <div class="kpi-card"><div class="label">Total Adjustments</div><div class="value">-${fc(salesReport.totalAdjustments)}</div></div>
      <div class="kpi-card primary"><div class="label">Net Sales</div><div class="value">${fc(salesReport.netSales)}</div></div>
      <div class="kpi-card"><div class="label">Total Transactions</div><div class="value">${fi(salesReport.totalTransactions)}</div></div>
      <div class="kpi-card"><div class="label">Avg per Transaction</div><div class="value">${fc(salesReport.averagePerTransaction)}</div></div>
      <div class="kpi-card"><div class="label">Customization Orders</div><div class="value">${fi(salesReport.customizationOrders)}</div></div>
    </div>
    <div class="info-box">
      <div class="summary-row"><span class="lbl">Adjustment Rate</span><span class="val">${adjRate}%</span></div>
      <div class="summary-row"><span class="lbl">Net Sales as % of Gross</span><span class="val">${salesReport.grossSales > 0 ? (100 - adjRate).toFixed(1) : "0.0"}%</span></div>
    </div>
  </div>` : ""}

  ${sections.has("channels") ? `
  <div class="section">
    <div class="section-title">Sales by Channel</div>
    <table>
      <thead>
        <tr><th>Channel</th><th class="r">Transactions</th><th class="r">Gross Sales</th><th class="r">Adjustments</th><th class="r">Net Sales</th><th class="r">% of Net</th></tr>
      </thead>
      <tbody>
        ${Object.entries(channels).map(([key, ch]) => {
    const meta = CHANNEL_META[key] || { label: key };
    return `<tr>
            <td class="b">${meta.label}</td>
            <td class="r">${fi(ch.transactions)}</td>
            <td class="r">${fc(ch.gross)}</td>
            <td class="r">${fc(ch.adjustments)}</td>
            <td class="r b">${fc(ch.net)}</td>
            <td class="r">${pct(ch.net, netSales)}%</td>
          </tr>`;
  }).join("")}
        <tr class="total">
          <td>TOTAL</td>
          <td class="r">${fi(salesReport.totalTransactions)}</td>
          <td class="r">${fc(salesReport.grossSales)}</td>
          <td class="r">${fc(salesReport.totalAdjustments)}</td>
          <td class="r">${fc(salesReport.netSales)}</td>
          <td class="r">100%</td>
        </tr>
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("adjustments") ? `
  <div class="section">
    <div class="section-title">Sales Adjustments</div>
    ${adjustmentsByType.length > 0 ? `
    <table>
      <thead><tr><th>Type</th><th class="r">Count</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${adjustmentsByType.map(a => `<tr><td class="b">${(a.type || 'Unknown').charAt(0).toUpperCase() + (a.type || 'Unknown').slice(1)}s</td><td class="r">${a.count}</td><td class="r">${fc(a.amount)}</td></tr>`).join("")}
        <tr class="total"><td>TOTAL</td><td class="r">${adjustmentsByType.reduce((s, a) => s + (a.count || 0), 0)}</td><td class="r">${fc(salesReport.totalAdjustments)}</td></tr>
      </tbody>
    </table>` : "<p>No adjustments recorded.</p>"}
    ${adjustmentsByChannel.length > 0 ? `
    <table>
      <thead><tr><th>By Channel</th><th class="r">Count</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${adjustmentsByChannel.map(a => `<tr><td>${(CHANNEL_META[a.channel] || {}).label || a.channel}</td><td class="r">${a.count}</td><td class="r">${fc(a.amount)}</td></tr>`).join("")}
      </tbody>
    </table>` : ""}
    <div class="info-box"><div class="summary-row"><span class="lbl">Adjustment Rate (Adjustments ÷ Gross × 100)</span><span class="val">${adjRate}%</span></div></div>
  </div>` : ""}

  ${sections.has("products") && bestSellingProducts.length > 0 ? `
  <div class="section">
    <div class="section-title">Top Selling Products</div>
    <table>
      <thead><tr><th>#</th><th>Product</th><th>Category</th><th class="r">Units Sold</th><th class="r">Revenue</th></tr></thead>
      <tbody>
        ${bestSellingProducts.map((p, i) => `<tr><td class="b">${i + 1}</td><td class="b">${p.name}</td><td>${p.category || "—"}</td><td class="r">${fi(p.units)}</td><td class="r b">${fc(p.revenue)}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("customization") ? `
  <div class="section">
    <div class="section-title">Customization Performance</div>
    <table>
      <thead><tr><th>Metric</th><th class="r">Value</th></tr></thead>
      <tbody>
        <tr><td>Total Orders</td><td class="r b">${fi(custOrders)}</td></tr>
        <tr><td>Gross Sales</td><td class="r">${fc(custChannel.gross)}</td></tr>
        <tr><td>Adjustments</td><td class="r">${fc(custChannel.adjustments)}</td></tr>
        <tr><td class="b">Net Sales</td><td class="r b">${fc(custChannel.net)}</td></tr>
        <tr><td>Total Transactions</td><td class="r">${fi(custChannel.transactions)}</td></tr>
        <tr><td>Avg Order Value</td><td class="r">${fc(custOrders > 0 ? (custChannel.net || 0) / custOrders : 0)}</td></tr>
        <tr><td>% of Total Net Sales</td><td class="r">${pct(custChannel.net, netSales)}%</td></tr>
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("payments") ? `
  <div class="section">
    <div class="section-title">Payment Method Analysis</div>
    
    <p style="font-weight: bold; font-size: 11px; margin-bottom: 4px; text-transform: uppercase;">Overall Sales</p>
    <table>
      <thead>
        <tr>
          <th>Payment Method</th>
          <th class="r">Transactions</th>
          <th class="r">Amount</th>
          <th class="r">% of Payment Volume</th>
          <th class="r">Average Transaction</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
        const list = orderPaymentMethods.length > 0 ? orderPaymentMethods : [
          { method: "gcash", transactions: 0, amount: 0 },
          { method: "bank_transfer", transactions: 0, amount: 0 },
        ];
        const totalAmount = list.reduce((s, m) => s + (m.amount || 0), 0);
        const totalTx = list.reduce((s, m) => s + (m.transactions || 0), 0);
        const avgTotal = totalTx > 0 ? totalAmount / totalTx : 0;
        return list.map(m => {
          const label = m.method === "gcash" ? "GCash" : m.method === "bank_transfer" ? "Bank Transfer" : m.method;
          const avg = m.transactions > 0 ? (m.amount || 0) / m.transactions : 0;
          return `<tr>
              <td class="b">${label}</td>
              <td class="r">${fi(m.transactions)}</td>
              <td class="r">${fc(m.amount)}</td>
              <td class="r">${pct(m.amount, totalAmount)}%</td>
              <td class="r">${fc(avg)}</td>
            </tr>`;
        }).join("") + `
            <tr class="total">
              <td>TOTAL</td>
              <td class="r">${fi(totalTx)}</td>
              <td class="r">${fc(totalAmount)}</td>
              <td class="r">100%</td>
              <td class="r">${fc(avgTotal)}</td>
            </tr>`;
      })()}
      </tbody>
    </table>

    <div style="margin-top: 14px; margin-bottom: 4px;">
      <p style="font-weight: bold; font-size: 11px; text-transform: uppercase; margin-bottom: 2px;">Appointment Payments</p>
      <p style="font-size: 9px; color: #555; margin-bottom: 4px; font-style: italic;">Payment activity from appointment transactions.</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Payment Method</th>
          <th class="r">Transactions</th>
          <th class="r">Amount</th>
          <th class="r">% of Appointment Payments</th>
          <th class="r">Average Transaction</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
        const list = appointmentPaymentMethods.length > 0 ? appointmentPaymentMethods : [
          { method: "cash", appointments: 0, revenue: 0 },
          { method: "gcash", appointments: 0, revenue: 0 },
          { method: "bank_transfer", appointments: 0, revenue: 0 },
        ];
        const totalRev = list.reduce((s, m) => s + (m.revenue || 0), 0);
        const totalAppt = list.reduce((s, m) => s + (m.appointments || 0), 0);
        const avgTotal = totalAppt > 0 ? totalRev / totalAppt : 0;
        return list.map(m => {
          const label = m.method === "cash" ? "Cash" : m.method === "gcash" ? "GCash" : m.method === "bank_transfer" ? "Bank Transfer" : m.method;
          const avg = m.appointments > 0 ? (m.revenue || 0) / m.appointments : 0;
          return `<tr>
              <td class="b">${label}</td>
              <td class="r">${fi(m.appointments)}</td>
              <td class="r">${fc(m.revenue)}</td>
              <td class="r">${pct(m.revenue, totalRev)}%</td>
              <td class="r">${fc(avg)}</td>
            </tr>`;
        }).join("") + `
            <tr class="total">
              <td>TOTAL</td>
              <td class="r">${fi(totalAppt)}</td>
              <td class="r">${fc(totalRev)}</td>
              <td class="r">100%</td>
              <td class="r">${fc(avgTotal)}</td>
            </tr>`;
      })()}
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("dailyTrend") && dailyTrend.length > 0 ? `
  <div class="section">
    <div class="section-title">Daily Sales Trend</div>
    <table>
      <thead><tr><th>Date</th><th class="r">Revenue</th><th class="r">Transactions</th></tr></thead>
      <tbody>
        ${dailyTrend.map(d => `<tr><td>${d.date}</td><td class="r">${fc(d.revenue)}</td><td class="r">${fi(d.transactions)}</td></tr>`).join("")}
        <tr class="total">
          <td>TOTAL</td>
          <td class="r">${fc(dailyTrend.reduce((s, d) => s + (d.revenue || 0), 0))}</td>
          <td class="r">${fi(dailyTrend.reduce((s, d) => s + (d.transactions || 0), 0))}</td>
        </tr>
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("adjusted") && topAdjustedProducts.length > 0 ? `
  <div class="section">
    <div class="section-title">Top Adjusted / Returned Products</div>
    <table>
      <thead><tr><th>Product</th><th class="r">Adjustment Amount</th><th>Reason</th></tr></thead>
      <tbody>
        ${topAdjustedProducts.map(p => `<tr><td class="b">${p.name}</td><td class="r">${fc(p.adjustmentAmount)}</td><td>${p.reason || "—"}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("refundReasons") && refundReasons.length > 0 ? `
  <div class="section">
    <div class="section-title">Refund Reasons</div>
    <table>
      <thead><tr><th>Reason</th><th class="r">Count</th><th class="r">Amount</th></tr></thead>
      <tbody>
        ${refundReasons.map(r => `<tr><td>${r.reason}</td><td class="r">${r.count}</td><td class="r">${fc(r.amount)}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${sections.has("performance") ? `
  <div class="section">
    <div class="section-title">Performance Summary</div>
    <table>
      <thead><tr><th>Period</th><th class="r">Revenue</th><th class="r">Transactions</th></tr></thead>
      <tbody>
        <tr><td class="b">Today</td><td class="r">${fc(salesReport.dailySales)}</td><td class="r">${fi(salesReport.dailyTransactions)}</td></tr>
        <tr><td class="b">This Week</td><td class="r">${fc(salesReport.weeklySales)}</td><td class="r">${fi(salesReport.weeklyTransactions)}</td></tr>
        <tr><td class="b">This Month</td><td class="r">${fc(salesReport.monthlySales)}</td><td class="r">${fi(salesReport.monthlyTransactions)}</td></tr>
      </tbody>
    </table>
  </div>` : ""}

  <div class="footer">
    <p><strong>CosmosCraft</strong> &mdash; Guitar Customization &amp; Services</p>
    <p>This is an automated report. For inquiries, contact support@cosmoscraft.com</p>
    <p style="margin-top:4px; font-size:8px;">Sections included: ${Array.from(sections).map(s => PRINT_SECTIONS.find(ps => ps.key === s)?.label || s).join(" · ")}</p>
  </div>
</body>
</html>`;

  return html;
}

/* ─── Print helper ─── */

function printSalesReport(salesReport, dateLabel, selectedSections, printedBy, datePrinted) {
  if (!salesReport) return;
  const html = buildSalesReportHTML(salesReport, dateLabel, selectedSections, printedBy, datePrinted);
  const pw = window.open("", "_blank");
  pw.document.write(html);
  pw.document.close();
  pw.onload = () => { pw.focus(); pw.print(); };
}

/* ─── Print Options Modal ─── */

function PrintOptionsModal({
  isOpen,
  onClose,
  onPrint,
  salesReport,
  printedBy,
  datePrinted,
}) {
  const [selected, setSelected] = useState(new Set(DEFAULT_PRINT_SECTIONS));

  useEffect(() => {
    if (isOpen) setSelected(new Set(DEFAULT_PRINT_SECTIONS));
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(DEFAULT_PRINT_SECTIONS));
  const selectNone = () => setSelected(new Set());

  // Quick presets
  const quickPresets = [
    { label: "Sales Today", keys: ["summary", "performance"] },
    { label: "Trending Products", keys: ["summary", "products"] },
    { label: "Customization Revenue", keys: ["summary", "customization"] },
    { label: "Adjustments & Refunds", keys: ["summary", "adjustments", "adjusted", "refundReasons"] },
    { label: "Full Report", keys: DEFAULT_PRINT_SECTIONS },
  ];

  const hasData = (key) => {
    if (!salesReport) return false;
    switch (key) {
      case "products": return (salesReport.bestSellingProducts || []).length > 0;
      case "adjusted": return (salesReport.topAdjustedProducts || []).length > 0;
      case "refundReasons": return (salesReport.refundReasons || []).length > 0;
      case "payments": return (salesReport.orderPaymentMethods || []).length > 0 || (salesReport.appointmentPaymentMethods || []).length > 0;
      case "dailyTrend": return (salesReport.dailyTrend || []).length > 0;
      case "adjustments": return (salesReport.adjustmentsByType || []).length > 0 || (salesReport.adjustmentsByChannel || []).length > 0;
      default: return true;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl w-full max-w-lg mx-4 shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-white text-lg font-semibold">Print Options</h3>
            <p className="text-[var(--text-muted)] text-xs mt-0.5">
              Select sections to include in your printed report
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="px-6 py-3 border-b border-[var(--border)]">
          <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Quick Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {quickPresets.map((qp) => (
              <button
                key={qp.label}
                onClick={() => setSelected(new Set(qp.keys))}
                className="px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-white hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
              >
                {qp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Section Checkboxes */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Sections</p>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-[var(--gold-primary)] hover:underline">Select All</button>
              <span className="text-[var(--text-muted)]">|</span>
              <button onClick={selectNone} className="text-xs text-[var(--text-muted)] hover:text-white hover:underline">Clear All</button>
            </div>
          </div>
          <div className="space-y-1">
            {PRINT_SECTIONS.map((sec) => {
              const noData = !hasData(sec.key);
              return (
                <label
                  key={sec.key}
                  className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${selected.has(sec.key) ? "bg-[var(--gold-primary)]/10 border border-[var(--gold-primary)]/30" : "border border-transparent hover:bg-[var(--bg-primary)]"
                    } ${noData ? "opacity-40" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(sec.key)}
                    onChange={() => toggle(sec.key)}
                    className="mt-0.5 w-4 h-4 accent-[var(--gold-primary)] rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white block">{sec.label}</span>
                    <span className="text-xs text-[var(--text-muted)]">{sec.description}</span>
                    {noData && <span className="text-xs text-[var(--text-muted)] italic ml-1">(no data)</span>}
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[var(--text-muted)]">{selected.size} of {PRINT_SECTIONS.length} sections selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-sm font-medium text-[var(--text-muted)] bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onPrint(Array.from(selected), printedBy, datePrinted);
                onClose();
              }}
              disabled={selected.size === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-lg transition-colors border bg-[var(--gold-primary)] text-black border-[var(--gold-primary)] hover:opacity-90 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" />
              Print ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Custom Tooltip ─── */

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl shadow-lg px-4 py-3 text-sm min-w-[200px]">
      <p className="font-semibold text-white mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between text-xs gap-4">
          <span className="text-[var(--text-muted)]">Gross Sales</span>
          <span className="font-mono text-white">{formatCurrency(d?.gross ?? 0)}</span>
        </div>
        <div className="flex justify-between text-xs gap-4">
          <span className="text-[var(--text-muted)]">Adjustments</span>
          <span className="font-mono text-red-400">{formatCurrency(d ? d.gross - d.net : 0)}</span>
        </div>
        <div className="flex justify-between text-xs gap-4 pt-1 border-t border-[var(--border)]">
          <span className="font-medium text-white">Net Sales</span>
          <span className="font-mono font-semibold text-[var(--gold-primary)]">{formatCurrency(d?.net ?? 0)}</span>
        </div>
        <div className="flex justify-between text-xs gap-4">
          <span className="text-[var(--text-muted)]">Transactions</span>
          <span className="font-mono text-white">{fmtInteger(d?.transactions ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Toggle Button Group ─── */

function ToggleGroup({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-1 bg-[var(--bg-primary)] rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${value === opt.value
            ? "bg-[var(--surface-dark)] text-[var(--gold-primary)] shadow-sm"
            : "text-[var(--text-muted)] hover:text-white"
            }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */

export function SalesReportTab({ salesReport, fetchSalesReport }) {
  const { user } = useAuth();
  const [preset, setPreset] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activePreset, setActivePreset] = useState("all");
  const [trendMetric, setTrendMetric] = useState("gross");
  const [chartView, setChartView] = useState("daily");
  const [sortBy, setSortBy] = useState("units");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [paymentScope, setPaymentScope] = useState("overall"); // "overall" | "appointments"

  const printedBy = user?.name?.firstName && user?.name?.lastName
    ? `${user.name.firstName} ${user.name.lastName}`
    : user?.name?.firstName || user?.firstName || user?.email?.split('@')[0] || "Unknown User";
  const datePrinted = new Date().toLocaleString("en-PH", { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  /* ─── Derived data ─── */

  const dateLabel = useMemo(() => {
    if (preset === "all") return "All Time";
    if (preset === "custom") {
      if (customStart && customEnd) {
        return customStart === customEnd ? customStart : `${customStart} — ${customEnd}`;
      }
      if (customStart) return `From ${customStart}`;
      if (customEnd) return `Until ${customEnd}`;
      return "Custom Range";
    }
    const range = getPresetRange(preset);
    if (range.start_date && range.end_date) {
      if (range.start_date === range.end_date) return range.start_date;
      return `${range.start_date} — ${range.end_date}`;
    }
    return "Custom Range";
  }, [preset, customStart, customEnd]);

  const applyPreset = (key) => {
    setActivePreset(key);
    setPreset(key);
    setCustomStart("");
    setCustomEnd("");
    fetchSalesReport(getPresetRange(key));
  };

  const handleCustomStartChange = (val) => {
    setCustomStart(val);
    if (!val && !customEnd) {
      applyPreset("all");
      return;
    }
    setActivePreset("custom");
    setPreset("custom");
    if (val && customEnd && val > customEnd) {
      setCustomEnd(val);
      fetchSalesReport({ start_date: val, end_date: val });
    } else {
      fetchSalesReport({ start_date: val || undefined, end_date: customEnd || undefined });
    }
  };

  const handleCustomEndChange = (val) => {
    setCustomEnd(val);
    if (!customStart && !val) {
      applyPreset("all");
      return;
    }
    setActivePreset("custom");
    setPreset("custom");
    if (customStart && val && customStart > val) {
      setCustomStart(val);
      fetchSalesReport({ start_date: val, end_date: val });
    } else {
      fetchSalesReport({ start_date: customStart || undefined, end_date: val || undefined });
    }
  };

  const clearCustomDates = () => {
    setCustomStart("");
    setCustomEnd("");
    applyPreset("all");
  };

  const handleRefresh = () => {
    if (activePreset === "custom") {
      fetchSalesReport({ start_date: customStart || undefined, end_date: customEnd || undefined });
    } else {
      fetchSalesReport(getPresetRange(activePreset));
    }
  };

  // Channel data array
  const channelData = useMemo(() => {
    const ch = salesReport?.channels || {};
    const ns = salesReport?.netSales || 0;
    return Object.entries(CHANNEL_META).map(([key, meta]) => ({
      key,
      channel: meta.label,
      color: meta.color,
      gross: ch[key]?.gross || 0,
      adjustments: ch[key]?.adjustments || 0,
      net: ch[key]?.net || 0,
      transactions: ch[key]?.transactions || 0,
      pct: ns > 0 ? Number(((ch[key]?.net || 0) / ns) * 100).toFixed(1) : "0.0",
    }));
  }, [salesReport]);

  // Chart data with view toggle
  const chartData = useMemo(() => {
    const daily = (salesReport?.dailyTrend || []).map((d) => ({
      date: d.date,
      label: d.date,
      gross: d.revenue || 0,
      net: d.revenue || 0,
      transactions: d.transactions || 0,
    }));

    if (chartView === "weekly") return groupWeekly(daily);
    if (chartView === "monthly") return groupMonthly(daily);
    return daily;
  }, [salesReport, chartView]);

  // Sorted products
  const sortedProducts = useMemo(() => {
    const products = salesReport?.bestSellingProducts || [];
    return [...products].sort((a, b) =>
      sortBy === "units" ? b.units - a.units : b.revenue - a.revenue
    );
  }, [salesReport, sortBy]);

  // Payment methods breakdown (Overall vs Appointments)
  const METHOD_LABELS = {
    gcash: "GCash",
    bank_transfer: "Bank Transfer",
    cash: "Cash",
  };

  const METHOD_COLORS = {
    gcash: "#007DFE",
    bank_transfer: "#D4AF37",
    cash: "#10B981",
  };

  const overallPaymentMethods = useMemo(() => {
    const raw = salesReport?.orderPaymentMethods || [];
    const list = raw.map((m) => ({
      method: m.method,
      label: METHOD_LABELS[m.method] || m.method,
      transactions: m.transactions || 0,
      amount: m.amount || 0,
      color: METHOD_COLORS[m.method] || "#D4AF37",
    }));
    return list;
  }, [salesReport]);

  const totalOverallAmount = overallPaymentMethods.reduce((s, p) => s + (p.amount || 0), 0);
  const totalOverallTransactions = overallPaymentMethods.reduce((s, p) => s + (p.transactions || 0), 0);
  const overallAvgTransaction = totalOverallTransactions > 0 ? totalOverallAmount / totalOverallTransactions : 0;

  const appointmentPaymentMethods = useMemo(() => {
    const raw = salesReport?.appointmentPaymentMethods || [];
    const list = raw.map((m) => ({
      method: m.method,
      label: METHOD_LABELS[m.method] || m.method,
      transactions: m.appointments || 0,
      amount: m.revenue || 0,
      color: METHOD_COLORS[m.method] || "#10B981",
    }));
    return list;
  }, [salesReport]);

  const totalApptAmount = appointmentPaymentMethods.reduce((s, p) => s + (p.amount || 0), 0);
  const totalApptTransactions = appointmentPaymentMethods.reduce((s, p) => s + (p.transactions || 0), 0);
  const apptAvgTransaction = totalApptTransactions > 0 ? totalApptAmount / totalApptTransactions : 0;

  const activePaymentMethods = paymentScope === "overall" ? overallPaymentMethods : appointmentPaymentMethods;
  const activePaymentTotalAmount = paymentScope === "overall" ? totalOverallAmount : totalApptAmount;
  const activePaymentTotalTransactions = paymentScope === "overall" ? totalOverallTransactions : totalApptTransactions;
  const activePaymentAvgTransaction = paymentScope === "overall" ? overallAvgTransaction : apptAvgTransaction;
  const activePaymentPercentLabel = paymentScope === "overall" ? "% of Payment Volume" : "% of Appointment Payments";

  // Adjustment stats
  const adjustmentsByType = salesReport?.adjustmentsByType || [];
  const adjustmentsByChannel = salesReport?.adjustmentsByChannel || [];
  const adjustmentRate = salesReport?.adjustmentRate || 0;

  // Customization channel data
  const custChannel = salesReport?.channels?.customization || {};
  const custOrders = salesReport?.customizationOrders || 0;

  /* ─── KPIs ─── */

  const kpis = [
    { label: "Gross Sales", value: formatCurrency(salesReport?.grossSales || 0), icon: DollarSign, color: "var(--text-light)", borderCls: "border-[var(--border)]" },
    { label: "Sales Adjustments", value: `-${formatCurrency(salesReport?.totalAdjustments || 0)}`, icon: ArrowDownRight, color: "#f87171", borderCls: "border-red-500/30", tag: "Deducted", tagCls: "bg-red-500/20 text-red-400" },
    { label: "Net Sales", value: formatCurrency(salesReport?.netSales || 0), icon: TrendingUp, color: "#D4AF37", borderCls: "border-[var(--gold-primary)]/40 ring-1 ring-[var(--gold-primary)]/20", tag: "Primary", tagCls: "bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]" },
    { label: "Total Transactions", value: fmtInteger(salesReport?.totalTransactions || 0), icon: ShoppingBag, color: "#60a5fa", borderCls: "border-blue-500/30" },
    { label: "Avg Transaction", value: formatCurrency(salesReport?.averagePerTransaction || 0), icon: BarChart3, color: "#34d399", borderCls: "border-green-500/30" },
    { label: "Customization Orders", value: fmtInteger(salesReport?.customizationOrders || 0), icon: Calendar, color: "#a78bfa", borderCls: "border-purple-500/30" },
  ];

  /* ─── Render ─── */

  return (
    <motion.div key="sales-report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      {salesReport ? (
        <div className="space-y-6">

          {/* ── Header ── */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 no-print">
            <div>
              <h1 className="text-[var(--text-light)] text-2xl font-bold tracking-tight">Sales Report</h1>
              <p className="text-[var(--text-muted)] text-sm mt-0.5">
                {dateLabel} &middot; Generated on {new Date().toLocaleDateString("en-PH")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleRefresh}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-muted)] hover:border-[var(--gold-primary)] transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={() => exportExcel(salesReport, dateLabel, printedBy, datePrinted)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-muted)] hover:border-[var(--gold-primary)] transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
              <button
                onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[var(--gold-primary)] text-black rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Printer className="w-4 h-4" />
                Print Report
              </button>
            </div>
          </div>

          {/* ── Date Range Controls ── */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activePreset === p.key
                  ? "bg-[var(--gold-primary)] text-black"
                  : "bg-[var(--surface-dark)] border border-[var(--border)] text-[var(--text-light)] hover:border-[var(--gold-primary)]"
                  }`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => handleCustomStartChange(e.target.value)}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text-light)] text-sm focus:border-[var(--gold-primary)] focus:outline-none"
              />
              <span className="text-[var(--text-muted)]">to</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                onChange={(e) => handleCustomEndChange(e.target.value)}
                className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-[var(--text-light)] text-sm focus:border-[var(--gold-primary)] focus:outline-none"
              />
              {(customStart || customEnd) && (
                <button
                  onClick={clearCustomDates}
                  title="Clear custom date filter"
                  className="px-2.5 py-1.5 bg-[var(--surface-dark)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-light)] rounded-lg text-sm font-medium hover:border-[var(--gold-primary)] transition-colors flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className={`bg-[var(--surface-dark)] border rounded-xl p-5 ${k.borderCls}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide">{k.label}</span>
                    {k.tag && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${k.tagCls}`}>{k.tag}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} />
                    <span className="font-mono text-xl font-semibold text-[var(--text-light)]" style={{ color: k.color }}>{k.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Sales Trend Chart ── */}
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="font-semibold text-white text-lg">Sales Trend</h2>
              <div className="flex items-center gap-3">
                <ToggleGroup
                  options={[
                    { value: "gross", label: "Gross Sales" },
                    { value: "net", label: "Net Sales" },
                    { value: "transactions", label: "Transactions" },
                  ]}
                  value={trendMetric}
                  onChange={setTrendMetric}
                />
                <ToggleGroup
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                  ]}
                  value={chartView}
                  onChange={setChartView}
                />
              </div>
            </div>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => trendMetric === "transactions" ? v : `₱${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<TrendTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={trendMetric}
                    name={trendMetric === "gross" ? "Gross Sales" : trendMetric === "net" ? "Net Sales" : "Transactions"}
                    stroke="#D4AF37" strokeWidth={2.5} fill="url(#trendGrad)" dot={false}
                    animationDuration={800}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BarChart3 className="w-10 h-10 text-[var(--text-muted)] mb-3" />
                <p className="text-white font-medium">No trend data available</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">Try selecting a different date range.</p>
              </div>
            )}
          </div>

          {/* ── Channel Analysis ── */}
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-light)] text-lg">Sales Channel Analysis</h2>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 divide-y xl:divide-y-0 xl:divide-x divide-[var(--border)]">
              {/* Table */}
              <div className="xl:col-span-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                      {["Channel", "Transactions", "Gross Sales", "Adjustments", "Net Sales", "% of Sales"].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap ${h === "Channel" ? "text-left" : "text-right"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {channelData.map((c) => (
                      <tr key={c.key} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                            <span className="font-medium text-[var(--text-light)]">{c.channel}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--text-light)]">{fmtInteger(c.transactions)}</td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--text-light)]">{formatCurrency(c.gross)}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-400">{formatCurrency(c.adjustments)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--gold-primary)]">{formatCurrency(c.net)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-[var(--border)] rounded-full h-1.5">
                              <div className="h-1.5 rounded-full bg-[var(--gold-primary)]" style={{ width: `${c.pct}%` }} />
                            </div>
                            <span className="font-mono text-[var(--text-muted)] text-xs w-10 text-right">{c.pct}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-[var(--bg-primary)] font-semibold border-t-2 border-[var(--border)]">
                      <td className="px-4 py-3 text-[var(--text-light)]">Total</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-light)]">{fmtInteger(channelData.reduce((s, c) => s + c.transactions, 0))}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-light)]">{formatCurrency(salesReport?.grossSales || 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-red-400">{formatCurrency(salesReport?.totalAdjustments || 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--gold-primary)]">{formatCurrency(salesReport?.netSales || 0)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[var(--text-light)]">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Horizontal Bar Chart */}
              <div className="p-5 flex flex-col justify-center">
                <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-3">Net Sales by Channel</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={channelData} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="channel" tick={{ fontSize: 10, fill: "#d1d5db" }} tickLine={false} axisLine={false} width={100} />
                    <Tooltip
                      formatter={(v) => formatCurrency(v)}
                      contentStyle={{ backgroundColor: "var(--surface-dark)", border: "1px solid var(--border)", borderRadius: "8px", color: "white" }}
                    />
                    <Bar dataKey="net" radius={[0, 4, 4, 0]}>
                      {channelData.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* ── Sales Adjustments ── */}
          <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-semibold text-[var(--text-light)] text-lg">Sales Adjustments</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Refunds, Returns &amp; Voids</p>
            </div>
            <div className="p-5">
              {/* Adjustment type cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                {adjustmentsByType.map((a) => (
                  <div key={a.type} className="bg-[var(--bg-primary)] rounded-xl p-4 border border-[var(--border)]">
                    <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
                      {(a.type || 'Unknown').charAt(0).toUpperCase() + (a.type || 'Unknown').slice(1)}s
                    </p>
                    <p className="font-mono text-xl font-semibold text-red-400">{a.count}</p>
                    <p className="font-mono text-sm text-red-300 mt-0.5">{formatCurrency(a.amount)}</p>
                  </div>
                ))}
                <div className="bg-[var(--bg-primary)] rounded-xl p-4 border border-red-500/20">
                  <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">Total Adjustments</p>
                  <p className="font-mono text-xl font-semibold text-red-400">{formatCurrency(salesReport?.totalAdjustments || 0)}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">{adjustmentRate}% adj. rate</p>
                </div>
              </div>

              {/* Adjustment rate badge */}
              <div className="flex items-center gap-2 mb-4">
                <div className="px-3 py-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                  <span className="text-xs font-semibold text-red-400">Adjustment Rate: {adjustmentRate}%</span>
                </div>
                <span className="text-xs text-[var(--text-muted)]">= Total Adjustments ÷ Gross Sales × 100</span>
              </div>

              {/* By-channel table */}
              {adjustmentsByChannel.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                        <th className="text-left py-3 px-4 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Channel</th>
                        <th className="text-left py-3 px-4 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Count</th>
                        <th className="text-right py-3 px-4 text-[var(--text-muted)] font-semibold uppercase text-xs tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {adjustmentsByChannel.map((a) => (
                        <tr key={a.channel} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                          <td className="py-3 px-4 text-[var(--text-light)] font-medium capitalize">{CHANNEL_META[a.channel]?.label || a.channel}</td>
                          <td className="py-3 px-4 text-[var(--text-light)]">{a.count}</td>
                          <td className="py-3 px-4 text-right font-mono text-red-400 font-medium">{formatCurrency(a.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Top Selling Products ── */}
          {sortedProducts.length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-semibold text-[var(--text-light)] text-lg">Top Selling Products</h2>
                <ToggleGroup
                  options={[
                    { value: "units", label: "Units Sold" },
                    { value: "revenue", label: "Revenue" },
                  ]}
                  value={sortBy}
                  onChange={setSortBy}
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                      {["Rank", "Product", "Category", "Units Sold", "Revenue"].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide whitespace-nowrap ${["Units Sold", "Revenue"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {sortedProducts.map((p, i) => (
                      <tr key={p.name + i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${i === 0 ? "bg-[var(--gold-primary)] text-black" :
                            i === 1 ? "bg-gray-400 text-black" :
                              i === 2 ? "bg-orange-600 text-white" :
                                "bg-[var(--bg-primary)] text-[var(--text-muted)]"
                            }`}>
                            {i + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-[var(--text-light)]">{p.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-1 bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] rounded-full text-xs font-medium">{p.category || "—"}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--text-light)]">{fmtInteger(p.units)}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[var(--gold-primary)]">{formatCurrency(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Customization Performance + Payment Methods ── */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

            {/* Customization Performance */}
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-[var(--text-light)] text-lg">Customization Performance</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: "Orders", value: fmtInteger(custOrders), accent: false },
                    { label: "Gross Sales", value: formatCurrency(custChannel.gross || 0), accent: false },
                    { label: "Net Sales", value: formatCurrency(custChannel.net || 0), accent: true },
                    { label: "Adjustments", value: formatCurrency(custChannel.adjustments || 0), neg: true },
                    { label: "Avg Order Value", value: formatCurrency(custOrders > 0 ? (custChannel.net || 0) / custOrders : 0), accent: false },
                  ].map((k) => (
                    <div key={k.label} className="bg-[var(--bg-primary)] rounded-lg p-3 border border-[var(--border)]">
                      <p className="text-xs text-[var(--text-muted)] mb-1">{k.label}</p>
                      <p className={`font-mono font-semibold ${k.accent ? "text-[var(--gold-primary)]" : k.neg ? "text-red-400" : "text-[var(--text-light)]"}`}>
                        {k.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Channel breakdown for customization */}
                <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border)]">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-1">Transactions</p>
                      <p className="font-mono font-semibold text-[var(--text-light)]">{fmtInteger(custChannel.transactions || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-1">Gross</p>
                      <p className="font-mono font-semibold text-[var(--text-light)]">{formatCurrency(custChannel.gross || 0)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[var(--text-muted)] mb-1">Net</p>
                      <p className="font-mono font-semibold text-[var(--gold-primary)]">{formatCurrency(custChannel.net || 0)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method Analysis */}
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[var(--text-light)] text-lg">Payment Method Analysis</h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {paymentScope === "overall"
                      ? "Online & regular order payment methods (GCash, Bank Transfer)"
                      : "Payment activity from appointment transactions."}
                  </p>
                </div>

                {/* Segmented Control for Screen */}
                <div className="flex items-center bg-[var(--bg-primary)] p-1 rounded-xl border border-[var(--border)]">
                  <button
                    onClick={() => setPaymentScope("overall")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${paymentScope === "overall"
                      ? "bg-[var(--gold-primary)] text-black shadow-sm"
                      : "text-[var(--text-muted)] hover:text-white"
                      }`}
                  >
                    Overall Sales
                  </button>
                  <button
                    onClick={() => setPaymentScope("appointments")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${paymentScope === "appointments"
                      ? "bg-[var(--gold-primary)] text-black shadow-sm"
                      : "text-[var(--text-muted)] hover:text-white"
                      }`}
                  >
                    Appointments
                  </button>
                </div>
              </div>
              <div className="p-5">
                {activePaymentMethods.length > 0 ? (
                  <>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-center">
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={activePaymentMethods} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="amount" paddingAngle={2}>
                            {activePaymentMethods.map((p, i) => <Cell key={i} fill={p.color} />)}
                          </Pie>
                          <Tooltip
                            formatter={(v) => formatCurrency(v)}
                            contentStyle={{ backgroundColor: "var(--surface-dark)", border: "1px solid var(--border)", borderRadius: "8px", color: "white" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {activePaymentMethods.map((p) => (
                          <div key={p.method} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                              <span className="text-sm text-gray-300 capitalize">{p.label}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-mono text-sm font-semibold text-[var(--text-light)]">{formatCurrency(p.amount)}</span>
                              <span className="text-xs text-[var(--text-muted)] ml-2">
                                {activePaymentTotalAmount > 0 ? ((p.amount / activePaymentTotalAmount) * 100).toFixed(1) : 0}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm mt-4 pt-4 border-t border-[var(--border)]">
                        <thead>
                          <tr className="bg-[var(--bg-primary)] border-y border-[var(--border)]">
                            <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide text-left">Payment Method</th>
                            <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide text-right">Transactions</th>
                            <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide text-right">Amount</th>
                            <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide text-right">{activePaymentPercentLabel}</th>
                            <th className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide text-right">Average Transaction</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border)]">
                          {activePaymentMethods.map((p) => {
                            const avg = p.transactions > 0 ? p.amount / p.transactions : 0;
                            return (
                              <tr key={p.method} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                                <td className="px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                    <span className="font-medium text-[var(--text-light)] capitalize">{p.label}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-[var(--text-light)]">{fmtInteger(p.transactions)}</td>
                                <td className="px-3 py-2.5 text-right font-mono font-semibold text-[var(--text-light)]">{formatCurrency(p.amount)}</td>
                                <td className="px-3 py-2.5 text-right font-mono text-[var(--text-muted)]">
                                  {activePaymentTotalAmount > 0 ? ((p.amount / activePaymentTotalAmount) * 100).toFixed(1) : 0}%
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono text-[var(--text-light)]">{formatCurrency(avg)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-[var(--bg-primary)] font-semibold border-t-2 border-[var(--border)]">
                            <td className="px-3 py-2.5 text-[var(--text-light)]">Total</td>
                            <td className="px-3 py-2.5 text-right font-mono text-[var(--text-light)]">{fmtInteger(activePaymentTotalTransactions)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-[var(--gold-primary)]">{formatCurrency(activePaymentTotalAmount)}</td>
                            <td className="px-3 py-2.5 text-right font-mono text-[var(--text-light)]">100%</td>
                            <td className="px-3 py-2.5 text-right font-mono text-[var(--text-light)]">{formatCurrency(activePaymentAvgTransaction)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CreditCard className="w-8 h-8 text-[var(--text-muted)] mb-2" />
                    <p className="text-[var(--text-muted)] text-sm">No payment method data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Top Adjusted Products ── */}
          {(salesReport.topAdjustedProducts || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-white text-lg">Top Adjusted / Returned Products</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                      {["Product", "Adjustment Amount", "Reason"].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide ${h === "Adjustment Amount" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesReport.topAdjustedProducts.map((product, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{product.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">{formatCurrency(product.adjustmentAmount)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)] max-w-[300px] truncate">{product.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Refund Reasons ── */}
          {(salesReport.refundReasons || []).length > 0 && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border)]">
                <h2 className="font-semibold text-white text-lg">Refund Reasons</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--bg-primary)] border-b border-[var(--border)]">
                      {["Reason", "Count", "Amount"].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {salesReport.refundReasons.map((r, i) => (
                      <tr key={i} className="hover:bg-[var(--bg-primary)]/50 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{r.reason}</td>
                        <td className="px-4 py-3 text-gray-300">{r.count}</td>
                        <td className="px-4 py-3 text-right font-mono text-red-400 font-bold">{formatCurrency(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Performance Summary (All Time fallback) ── */}
          {preset === "all" && (
            <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
              <h2 className="text-white text-lg font-semibold mb-4">Performance Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: "Daily Performance", sales: salesReport?.dailySales, tx: salesReport?.dailyTransactions },
                  { label: "Weekly Performance", sales: salesReport?.weeklySales, tx: salesReport?.weeklyTransactions },
                  { label: "Monthly Performance", sales: salesReport?.monthlySales, tx: salesReport?.monthlyTransactions },
                ].map((p) => (
                  <div key={p.label} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl p-4">
                    <h3 className="text-white font-semibold mb-3">{p.label}</h3>
                    <div className="flex justify-between py-2 border-b border-[var(--border)]">
                      <span className="text-[var(--text-muted)]">Revenue</span>
                      <span className="text-[var(--gold-primary)] font-bold font-mono">{formatCurrency(p.sales || 0)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-[var(--text-muted)]">Transactions</span>
                      <span className="text-white font-medium font-mono">{fmtInteger(p.tx || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        <div className="text-center py-16">
          <BarChart3 className="w-16 h-16 text-[var(--gold-primary)] mx-auto mb-4 animate-pulse" />
          <h2 className="text-white text-xl font-semibold mb-2">Loading Sales Report...</h2>
          <p className="text-[var(--text-muted)]">Fetching comprehensive sales analytics data.</p>
        </div>
      )}
      <PrintOptionsModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={(sections, pBy, dPrinted) => printSalesReport(salesReport, dateLabel, sections, pBy, dPrinted)}
        salesReport={salesReport}
        printedBy={printedBy}
        datePrinted={datePrinted}
      />
    </motion.div>
  );
}