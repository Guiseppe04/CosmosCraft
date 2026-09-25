const { Workbook, Chart, Format } = require('@nazarkalytiuk/rusc-xlsx');

const CHANNEL_META = {
  walkIn: { label: 'Walk-in / POS' },
  online: { label: 'Online Orders' },
  customization: { label: 'Customization' },
  appointments: { label: 'Appointments' },
};

const PAYMENT_LABELS = {
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
};

function formatMethodLabel(method) {
  if (!method) return 'Unknown';
  if (PAYMENT_LABELS[method]) return PAYMENT_LABELS[method];
  return method.split(/[_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatAdjustmentType(type) {
  if (!type) return 'Other';
  const clean = type.trim();
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return capitalized.endsWith('s') ? capitalized : `${capitalized}s`;
}

/**
 * Builds a professional multi-sheet Excel workbook with native Excel charts
 * powered by rusc-xlsx (rust_xlsxwriter engine).
 *
 * Sheet Order:
 * 1. Dashboard (KPIs, metadata, channel overview, and native charts)
 * 2. Executive Summary
 * 3. Sales by Channel
 * 4. Daily Sales
 * 5. Top Products
 * 6. Customization
 * 7. Payments
 * 8. Adjustments
 * 9. Refund Reasons
 * 10. Performance
 * 11. Report Info
 */
function generateSalesExcelWorkbook(salesReport, options = {}) {
  const {
    dateLabel = 'All Time',
    printedBy = 'Administrator',
    datePrinted = new Date().toLocaleString('en-PH'),
  } = options;

  const wb = new Workbook();

  // Helper formatting numbers
  const fc = (v) => Number((v || 0).toFixed(2));
  const fi = (v) => Math.round(v || 0);
  const fp = (num, denom) => (denom > 0 ? Number((num / denom).toFixed(4)) : 0);

  // Core metrics
  const grossSales = salesReport.grossSales || 0;
  const totalAdjustments = salesReport.totalAdjustments || 0;
  const netSales = salesReport.netSales || 0;
  const totalTransactions = salesReport.totalTransactions || 0;
  const avgTx = totalTransactions > 0 ? grossSales / totalTransactions : 0;
  const customizationOrders = salesReport.customizationOrders || 0;
  const adjustmentRateDecimal = grossSales > 0 ? totalAdjustments / grossSales : 0;
  const netRetentionDecimal = grossSales > 0 ? netSales / grossSales : 0;

  // Reusable cell formats
  const fmtHeader = new Format();
  fmtHeader.setBold();
  fmtHeader.setFontColor('#FFFFFF');
  fmtHeader.setBackgroundColor('#1F2937');
  fmtHeader.setBorder('thin');

  const fmtSubHeader = new Format();
  fmtSubHeader.setBold();
  fmtSubHeader.setFontColor('#111827');
  fmtSubHeader.setBackgroundColor('#F3F4F6');
  fmtSubHeader.setBorder('thin');

  const fmtTitle = new Format();
  fmtTitle.setBold();
  fmtTitle.setFontSize(14);
  fmtTitle.setFontColor('#B45309');

  const fmtSubtitle = new Format();
  fmtSubtitle.setItalic();
  fmtSubtitle.setFontSize(10);
  fmtSubtitle.setFontColor('#4B5563');

  const fmtSection = new Format();
  fmtSection.setBold();
  fmtSection.setFontSize(11);
  fmtSection.setFontColor('#1E3A8A');

  const fmtCurrency = new Format();
  fmtCurrency.setNumFormat('"₱"#,##0.00');

  const fmtInt = new Format();
  fmtInt.setNumFormat('#,##0');

  const fmtPct = new Format();
  fmtPct.setNumFormat('0.0%');

  const fmtTotalCurrency = new Format();
  fmtTotalCurrency.setBold();
  fmtTotalCurrency.setNumFormat('"₱"#,##0.00');
  fmtTotalCurrency.setBorderTop('thin');
  fmtTotalCurrency.setBorderBottom('double');

  const fmtTotalInt = new Format();
  fmtTotalInt.setBold();
  fmtTotalInt.setNumFormat('#,##0');
  fmtTotalInt.setBorderTop('thin');
  fmtTotalInt.setBorderBottom('double');

  const fmtTotalPct = new Format();
  fmtTotalPct.setBold();
  fmtTotalPct.setNumFormat('0.0%');
  fmtTotalPct.setBorderTop('thin');
  fmtTotalPct.setBorderBottom('double');

  const fmtTotalLabel = new Format();
  fmtTotalLabel.setBold();
  fmtTotalLabel.setBorderTop('thin');
  fmtTotalLabel.setBorderBottom('double');

  // Shared channel list
  const chs = salesReport.channels || {};
  const channelsList = Object.entries(chs).map(([key, ch]) => ({
    key,
    label: (CHANNEL_META[key] || { label: key }).label,
    transactions: fi(ch.transactions),
    gross: fc(ch.gross),
    adjustments: fc(ch.adjustments),
    net: fc(ch.net),
    avg: ch.transactions > 0 ? fc(ch.gross / ch.transactions) : 0,
    share: fp(ch.net, netSales),
  })).sort((a, b) => b.net - a.net);

  // Daily trend
  const dailyData = (salesReport.dailyTrend || []).map((d) => ({
    date: d.date,
    gross: fc(d.revenue),
    adjustments: fc(d.adjustments || 0),
    net: fc((d.revenue || 0) - (d.adjustments || 0)),
    transactions: fi(d.transactions),
    avg: d.transactions > 0 ? fc(d.revenue / d.transactions) : 0,
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Products
  const rawProducts = salesReport.bestSellingProducts || [];
  const sortedProducts = [...rawProducts].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const totProdRevenue = sortedProducts.reduce((s, p) => s + (p.revenue || 0), 0);
  const totProdUnits = sortedProducts.reduce((s, p) => s + (p.units || 0), 0);
  const totProdAvgPrice = totProdUnits > 0 ? totProdRevenue / totProdUnits : 0;

  // Payments
  const orderPayments = [...(salesReport.orderPaymentMethods || [])].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const apptPayments = [...(salesReport.appointmentPaymentMethods || [])].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  const totOrderAmt = orderPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totOrderTx = orderPayments.reduce((s, p) => s + (p.transactions || 0), 0);
  const totApptRev = apptPayments.reduce((s, p) => s + (p.revenue || 0), 0);
  const totApptCount = apptPayments.reduce((s, p) => s + (p.appointments || 0), 0);

  // Adjustments
  const adjTypes = [...(salesReport.adjustmentsByType || [])].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const adjChannels = [...(salesReport.adjustmentsByChannel || [])].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const topAdjusted = [...(salesReport.topAdjustedProducts || [])].sort((a, b) => (b.adjustmentAmount || 0) - (a.adjustmentAmount || 0));
  const totAdjAmt = salesReport.totalAdjustments || 0;

  // Refund Reasons
  const refundReasons = [...(salesReport.refundReasons || [])].sort((a, b) => (b.amount || 0) - (a.amount || 0));
  const totRefundAmt = refundReasons.reduce((s, r) => s + (r.amount || 0), 0);
  const totRefundCount = refundReasons.reduce((s, r) => s + (r.count || 0), 0);

  // Customization
  const custCh = chs.customization || {};
  const hasCustData = customizationOrders > 0 || custCh.gross > 0 || custCh.transactions > 0;

  // Performance
  const hasPerf = salesReport.dailySales > 0 || salesReport.weeklySales > 0 || salesReport.monthlySales > 0 || salesReport.dailyTransactions > 0;

  /* ─────────────────────────────────────────────────────────────
     1. Dashboard Sheet (First & Most Useful Overview)
     ───────────────────────────────────────────────────────────── */
  const wsDash = wb.addWorksheet('Dashboard');

  wsDash.writeWithFormat(0, 0, 'COSMOSCRAFT GUITARS & CUSTOM SHOP', fmtTitle);
  wsDash.writeWithFormat(1, 0, 'Executive Sales & Management Analytics Dashboard', fmtSubtitle);

  wsDash.writeWithFormat(3, 0, 'REPORT METADATA', fmtSection);
  wsDash.write(4, 0, 'Reporting Period:');
  wsDash.write(4, 1, dateLabel || 'All Time');
  wsDash.write(4, 3, 'Generated On:');
  wsDash.write(4, 4, new Date().toLocaleString('en-PH'));

  wsDash.write(5, 0, 'Exported By:');
  wsDash.write(5, 1, printedBy || 'Unknown User');
  wsDash.write(5, 3, 'Currency:');
  wsDash.write(5, 4, 'Philippine Peso (PHP / ₱)');

  wsDash.writeWithFormat(7, 0, 'KEY PERFORMANCE INDICATORS (KPIs)', fmtSection);
  const kpiHeaders = ['Metric / Performance Indicator', 'Amount / Value', 'Metric Type', 'Performance Notes & Guidance'];
  kpiHeaders.forEach((h, col) => wsDash.writeWithFormat(8, col, h, fmtHeader));

  const kpiData = [
    ['Gross Sales', fc(grossSales), fmtCurrency, 'Revenue', 'Total unadjusted sales value across all channels before deductions'],
    ['Total Adjustments', fc(totalAdjustments), fmtCurrency, 'Deduction', 'Combined customer refunds, returns, discounts, and canceled orders'],
    ['Net Sales', fc(netSales), fmtCurrency, 'Primary KPI', 'Gross Sales minus Total Adjustments (Primary financial benchmark)'],
    ['Total Transactions', fi(totalTransactions), fmtInt, 'Volume', 'Total successfully completed customer sales and appointment orders'],
    ['Average Transaction', fc(avgTx), fmtCurrency, 'Efficiency', 'Average gross revenue generated per completed customer transaction'],
    ['Customization Orders', fi(customizationOrders), fmtInt, 'Custom Shop', 'Total bespoke guitar build projects and modification requests'],
    ['Adjustment Rate', adjustmentRateDecimal, fmtPct, 'Operational', 'Sales adjustments as a percentage of gross sales (Target: < 5.0%)'],
    ['Net Sales as % of Gross', netRetentionDecimal, fmtPct, 'Operational', 'Percentage of gross revenue retained after adjustments (Target: > 95.0%)'],
  ];

  kpiData.forEach((row, i) => {
    const r = 9 + i;
    wsDash.write(r, 0, row[0]);
    wsDash.writeWithFormat(r, 1, row[1], row[2]);
    wsDash.write(r, 2, row[3]);
    wsDash.write(r, 3, row[4]);
  });

  // Channel contribution snapshot
  const chSnapshotRow = 19;
  wsDash.writeWithFormat(chSnapshotRow, 0, 'CHANNEL REVENUE CONTRIBUTION', fmtSection);
  const chSnapHeaders = ['Sales Channel', 'Transactions', 'Gross Sales', 'Net Sales', 'Share of Net Sales'];
  chSnapHeaders.forEach((h, col) => wsDash.writeWithFormat(chSnapshotRow + 1, col, h, fmtHeader));

  channelsList.forEach((ch, idx) => {
    const r = chSnapshotRow + 2 + idx;
    wsDash.write(r, 0, ch.label);
    wsDash.writeWithFormat(r, 1, ch.transactions, fmtInt);
    wsDash.writeWithFormat(r, 2, ch.gross, fmtCurrency);
    wsDash.writeWithFormat(r, 3, ch.net, fmtCurrency);
    wsDash.writeWithFormat(r, 4, ch.share, fmtPct);
  });

  const chSnapTotalR = chSnapshotRow + 2 + channelsList.length;
  wsDash.writeWithFormat(chSnapTotalR, 0, 'TOTAL', fmtTotalLabel);
  wsDash.writeWithFormat(chSnapTotalR, 1, fi(totalTransactions), fmtTotalInt);
  wsDash.writeWithFormat(chSnapTotalR, 2, fc(grossSales), fmtTotalCurrency);
  wsDash.writeWithFormat(chSnapTotalR, 3, fc(netSales), fmtTotalCurrency);
  wsDash.writeWithFormat(chSnapTotalR, 4, 1.0, fmtTotalPct);

  wsDash.setColumnWidth(0, 26);
  wsDash.setColumnWidth(1, 18);
  wsDash.setColumnWidth(2, 18);
  wsDash.setColumnWidth(3, 18);
  wsDash.setColumnWidth(4, 20);

  /* ─────────────────────────────────────────────────────────────
     2. Executive Summary Sheet
     ───────────────────────────────────────────────────────────── */
  const wsExec = wb.addWorksheet('Executive Summary');
  const execHeaders = ['Sales Metric', 'Amount / Value', 'Operational Definition & Explanatory Notes'];
  execHeaders.forEach((h, col) => wsExec.writeWithFormat(0, col, h, fmtHeader));

  const execRows = [
    ['Gross Sales', fc(grossSales), fmtCurrency, 'Total unadjusted sales value generated across all retail and service channels.'],
    ['Total Adjustments', fc(totalAdjustments), fmtCurrency, 'Combined deductions including customer refunds, return credits, and order voids.'],
    ['Net Sales', fc(netSales), fmtCurrency, 'Net operating revenue (Gross Sales minus Adjustments). Primary financial KPI.'],
    ['Total Transactions', fi(totalTransactions), fmtInt, 'Total count of successfully completed customer orders and paid service appointments.'],
    ['Average Transaction', fc(avgTx), fmtCurrency, 'Average gross value generated per completed transaction across all channels.'],
    ['Customization Orders', fi(customizationOrders), fmtInt, 'Total volume of custom guitar builds and bespoke instrument modification orders.'],
    ['Adjustment Rate', adjustmentRateDecimal, fmtPct, 'Adjustments as a percentage of gross revenue. Measures return/void efficiency.'],
    ['Net Sales as % of Gross', netRetentionDecimal, fmtPct, 'Percentage of gross sales retained after accounting for all adjustments.'],
  ];

  execRows.forEach((row, idx) => {
    const r = idx + 1;
    wsExec.write(r, 0, row[0]);
    wsExec.writeWithFormat(r, 1, row[1], row[2]);
    wsExec.write(r, 2, row[3]);
  });
  wsExec.setColumnWidth(0, 24);
  wsExec.setColumnWidth(1, 18);
  wsExec.setColumnWidth(2, 60);

  /* ─────────────────────────────────────────────────────────────
     3. Sales by Channel Sheet
     ───────────────────────────────────────────────────────────── */
  let wsChannels = null;
  let chDataRowCount = 0;
  if (channelsList.length > 0) {
    wsChannels = wb.addWorksheet('Sales by Channel');
    const chHeaders = ['Sales Channel', 'Transactions', 'Gross Sales', 'Adjustments', 'Net Sales', '% of Net Sales', 'Average Transaction'];
    chHeaders.forEach((h, col) => wsChannels.writeWithFormat(0, col, h, fmtHeader));

    channelsList.forEach((ch, idx) => {
      const r = idx + 1;
      wsChannels.write(r, 0, ch.label);
      wsChannels.writeWithFormat(r, 1, ch.transactions, fmtInt);
      wsChannels.writeWithFormat(r, 2, ch.gross, fmtCurrency);
      wsChannels.writeWithFormat(r, 3, ch.adjustments, fmtCurrency);
      wsChannels.writeWithFormat(r, 4, ch.net, fmtCurrency);
      wsChannels.writeWithFormat(r, 5, ch.share, fmtPct);
      wsChannels.writeWithFormat(r, 6, ch.avg, fmtCurrency);
    });

    const totR = channelsList.length + 1;
    chDataRowCount = channelsList.length;
    wsChannels.writeWithFormat(totR, 0, 'TOTAL', fmtTotalLabel);
    wsChannels.writeWithFormat(totR, 1, fi(totalTransactions), fmtTotalInt);
    wsChannels.writeWithFormat(totR, 2, fc(grossSales), fmtTotalCurrency);
    wsChannels.writeWithFormat(totR, 3, fc(totalAdjustments), fmtTotalCurrency);
    wsChannels.writeWithFormat(totR, 4, fc(netSales), fmtTotalCurrency);
    wsChannels.writeWithFormat(totR, 5, 1.0, fmtTotalPct);
    wsChannels.writeWithFormat(totR, 6, fc(avgTx), fmtTotalCurrency);

    wsChannels.setColumnWidth(0, 22);
    wsChannels.setColumnWidth(1, 14);
    wsChannels.setColumnWidth(2, 16);
    wsChannels.setColumnWidth(3, 16);
    wsChannels.setColumnWidth(4, 16);
    wsChannels.setColumnWidth(5, 16);
    wsChannels.setColumnWidth(6, 18);
  }

  /* ─────────────────────────────────────────────────────────────
     4. Daily Sales Sheet
     ───────────────────────────────────────────────────────────── */
  let wsDaily = null;
  let dailyRowCount = 0;
  if (dailyData.length > 0) {
    wsDaily = wb.addWorksheet('Daily Sales');
    const dailyHeaders = ['Date', 'Gross Sales', 'Adjustments', 'Net Sales', 'Transactions', 'Average Transaction'];
    dailyHeaders.forEach((h, col) => wsDaily.writeWithFormat(0, col, h, fmtHeader));

    const totDailyGross = dailyData.reduce((s, d) => s + d.gross, 0);
    const totDailyAdj = dailyData.reduce((s, d) => s + d.adjustments, 0);
    const totDailyNet = dailyData.reduce((s, d) => s + d.net, 0);
    const totDailyTx = dailyData.reduce((s, d) => s + d.transactions, 0);
    const totDailyAvg = totDailyTx > 0 ? totDailyGross / totDailyTx : 0;
    dailyRowCount = dailyData.length;

    dailyData.forEach((d, idx) => {
      const r = idx + 1;
      wsDaily.write(r, 0, d.date);
      wsDaily.writeWithFormat(r, 1, d.gross, fmtCurrency);
      wsDaily.writeWithFormat(r, 2, d.adjustments, fmtCurrency);
      wsDaily.writeWithFormat(r, 3, d.net, fmtCurrency);
      wsDaily.writeWithFormat(r, 4, d.transactions, fmtInt);
      wsDaily.writeWithFormat(r, 5, d.avg, fmtCurrency);
    });

    const totR = dailyData.length + 1;
    wsDaily.writeWithFormat(totR, 0, 'TOTAL', fmtTotalLabel);
    wsDaily.writeWithFormat(totR, 1, fc(totDailyGross), fmtTotalCurrency);
    wsDaily.writeWithFormat(totR, 2, fc(totDailyAdj), fmtTotalCurrency);
    wsDaily.writeWithFormat(totR, 3, fc(totDailyNet), fmtTotalCurrency);
    wsDaily.writeWithFormat(totR, 4, fi(totDailyTx), fmtTotalInt);
    wsDaily.writeWithFormat(totR, 5, fc(totDailyAvg), fmtTotalCurrency);

    wsDaily.setColumnWidth(0, 16);
    wsDaily.setColumnWidth(1, 16);
    wsDaily.setColumnWidth(2, 16);
    wsDaily.setColumnWidth(3, 16);
    wsDaily.setColumnWidth(4, 14);
    wsDaily.setColumnWidth(5, 18);
  }

  /* ─────────────────────────────────────────────────────────────
     5. Top Products Sheet (Sorted by Revenue DESC)
     ───────────────────────────────────────────────────────────── */
  let wsProducts = null;
  let prodRowCount = 0;
  if (sortedProducts.length > 0) {
    wsProducts = wb.addWorksheet('Top Products');
    const prodHeaders = ['Rank', 'Product Name', 'Category', 'Units Sold', 'Total Revenue', 'Average Price per Unit', 'Revenue Share %'];
    prodHeaders.forEach((h, col) => wsProducts.writeWithFormat(0, col, h, fmtHeader));
    prodRowCount = sortedProducts.length;

    sortedProducts.forEach((p, idx) => {
      const r = idx + 1;
      const units = fi(p.units);
      const revenue = fc(p.revenue);
      const avgPrice = units > 0 ? fc(revenue / units) : 0;
      const share = fp(revenue, totProdRevenue);

      wsProducts.writeWithFormat(r, 0, idx + 1, fmtInt);
      wsProducts.write(r, 1, p.name || 'Unknown Product');
      wsProducts.write(r, 2, p.category || 'General');
      wsProducts.writeWithFormat(r, 3, units, fmtInt);
      wsProducts.writeWithFormat(r, 4, revenue, fmtCurrency);
      wsProducts.writeWithFormat(r, 5, avgPrice, fmtCurrency);
      wsProducts.writeWithFormat(r, 6, share, fmtPct);
    });

    const totR = sortedProducts.length + 1;
    wsProducts.writeWithFormat(totR, 0, '', fmtTotalLabel);
    wsProducts.writeWithFormat(totR, 1, 'TOTAL', fmtTotalLabel);
    wsProducts.writeWithFormat(totR, 2, '—', fmtTotalLabel);
    wsProducts.writeWithFormat(totR, 3, fi(totProdUnits), fmtTotalInt);
    wsProducts.writeWithFormat(totR, 4, fc(totProdRevenue), fmtTotalCurrency);
    wsProducts.writeWithFormat(totR, 5, fc(totProdAvgPrice), fmtTotalCurrency);
    wsProducts.writeWithFormat(totR, 6, 1.0, fmtTotalPct);

    wsProducts.setColumnWidth(0, 10);
    wsProducts.setColumnWidth(1, 32);
    wsProducts.setColumnWidth(2, 22);
    wsProducts.setColumnWidth(3, 14);
    wsProducts.setColumnWidth(4, 16);
    wsProducts.setColumnWidth(5, 18);
    wsProducts.setColumnWidth(6, 16);
  }

  /* ─────────────────────────────────────────────────────────────
     6. Customization Sheet (Bespoke Guitar & Workshop Builds)
     ───────────────────────────────────────────────────────────── */
  if (hasCustData) {
    const wsCust = wb.addWorksheet('Customization');
    const custHeaders = ['Customization Metric', 'Amount / Value', 'Operational Notes & Details'];
    custHeaders.forEach((h, col) => wsCust.writeWithFormat(0, col, h, fmtHeader));

    const custGross = fc(custCh.gross);
    const custAdj = fc(custCh.adjustments);
    const custNet = fc(custCh.net);
    const custTx = fi(custCh.transactions);
    const avgOrderVal = customizationOrders > 0 ? fc(custNet / customizationOrders) : 0;
    const custShare = fp(custNet, netSales);

    const custRows = [
      ['Total Customization Orders', fi(customizationOrders), fmtInt, 'Total bespoke guitar build requests & custom instrument jobs processed'],
      ['Gross Sales', custGross, fmtCurrency, 'Custom guitar builds & bespoke modification gross billings'],
      ['Adjustments', custAdj, fmtCurrency, 'Guitar customization refund credits or deductions'],
      ['Net Sales', custNet, fmtCurrency, 'Net revenue retained from custom guitar projects (Gross minus Adjustments)'],
      ['Total Transactions', custTx, fmtInt, 'Number of completed custom guitar payment transactions'],
      ['Average Order Value', avgOrderVal, fmtCurrency, 'Average net revenue generated per custom guitar order'],
      ['% of Total Net Sales', custShare, fmtPct, 'Share of overall CosmosCraft net sales generated by guitar customization'],
    ];

    custRows.forEach((row, idx) => {
      const r = idx + 1;
      wsCust.write(r, 0, row[0]);
      wsCust.writeWithFormat(r, 1, row[1], row[2]);
      wsCust.write(r, 2, row[3]);
    });

    wsCust.setColumnWidth(0, 26);
    wsCust.setColumnWidth(1, 18);
    wsCust.setColumnWidth(2, 60);
  }

  /* ─────────────────────────────────────────────────────────────
     7. Payments Sheet (Combined Order & Appointment Payments)
     ───────────────────────────────────────────────────────────── */
  let wsPayments = null;
  let orderPayRowCount = 0;
  const hasPaymentsData = orderPayments.length > 0 || apptPayments.length > 0;
  if (hasPaymentsData) {
    wsPayments = wb.addWorksheet('Payments');
    let curR = 0;

    if (orderPayments.length > 0) {
      wsPayments.writeWithFormat(curR, 0, 'ORDER PAYMENTS (Retail & Online Product Sales)', fmtSection);
      curR++;
      const payHeaders = ['Payment Method', 'Transactions', 'Total Amount', '% of Payment Volume', 'Average Transaction'];
      payHeaders.forEach((h, col) => wsPayments.writeWithFormat(curR, col, h, fmtHeader));
      curR++;
      orderPayRowCount = orderPayments.length;

      orderPayments.forEach((m) => {
        const amt = fc(m.amount);
        const tx = fi(m.transactions);
        const share = fp(amt, totOrderAmt);
        const avg = tx > 0 ? fc(amt / tx) : 0;

        wsPayments.write(curR, 0, formatMethodLabel(m.method));
        wsPayments.writeWithFormat(curR, 1, tx, fmtInt);
        wsPayments.writeWithFormat(curR, 2, amt, fmtCurrency);
        wsPayments.writeWithFormat(curR, 3, share, fmtPct);
        wsPayments.writeWithFormat(curR, 4, avg, fmtCurrency);
        curR++;
      });

      wsPayments.writeWithFormat(curR, 0, 'TOTAL ORDER PAYMENTS', fmtTotalLabel);
      wsPayments.writeWithFormat(curR, 1, fi(totOrderTx), fmtTotalInt);
      wsPayments.writeWithFormat(curR, 2, fc(totOrderAmt), fmtTotalCurrency);
      wsPayments.writeWithFormat(curR, 3, 1.0, fmtTotalPct);
      wsPayments.writeWithFormat(curR, 4, fc(totOrderTx > 0 ? totOrderAmt / totOrderTx : 0), fmtTotalCurrency);
      curR += 2;
    }

    if (apptPayments.length > 0) {
      wsPayments.writeWithFormat(curR, 0, 'APPOINTMENT PAYMENTS (Luthier Services & Repairs)', fmtSection);
      curR++;
      const apptHeaders = ['Payment Method', 'Appointments', 'Total Revenue', '% of Appointment Payments', 'Average Transaction'];
      apptHeaders.forEach((h, col) => wsPayments.writeWithFormat(curR, col, h, fmtHeader));
      curR++;

      apptPayments.forEach((m) => {
        const rev = fc(m.revenue);
        const appts = fi(m.appointments);
        const share = fp(rev, totApptRev);
        const avg = appts > 0 ? fc(rev / appts) : 0;

        wsPayments.write(curR, 0, formatMethodLabel(m.method));
        wsPayments.writeWithFormat(curR, 1, appts, fmtInt);
        wsPayments.writeWithFormat(curR, 2, rev, fmtCurrency);
        wsPayments.writeWithFormat(curR, 3, share, fmtPct);
        wsPayments.writeWithFormat(curR, 4, avg, fmtCurrency);
        curR++;
      });

      wsPayments.writeWithFormat(curR, 0, 'TOTAL APPOINTMENT PAYMENTS', fmtTotalLabel);
      wsPayments.writeWithFormat(curR, 1, fi(totApptCount), fmtTotalInt);
      wsPayments.writeWithFormat(curR, 2, fc(totApptRev), fmtTotalCurrency);
      wsPayments.writeWithFormat(curR, 3, 1.0, fmtTotalPct);
      wsPayments.writeWithFormat(curR, 4, fc(totApptCount > 0 ? totApptRev / totApptCount : 0), fmtTotalCurrency);
    }

    wsPayments.setColumnWidth(0, 24);
    wsPayments.setColumnWidth(1, 16);
    wsPayments.setColumnWidth(2, 18);
    wsPayments.setColumnWidth(3, 20);
    wsPayments.setColumnWidth(4, 18);
  }

  /* ─────────────────────────────────────────────────────────────
     8. Adjustments Sheet (By Type, By Channel, & Top Adjusted)
     ───────────────────────────────────────────────────────────── */
  let wsAdj = null;
  let adjTypeRowCount = 0;
  const hasAdjData = adjTypes.length > 0 || adjChannels.length > 0 || topAdjusted.length > 0 || totalAdjustments > 0;
  if (hasAdjData) {
    wsAdj = wb.addWorksheet('Adjustments');
    let curR = 0;

    if (adjTypes.length > 0) {
      wsAdj.writeWithFormat(curR, 0, 'SALES ADJUSTMENTS BY TYPE', fmtSection);
      curR++;
      const typeHeaders = ['Adjustment Type', 'Count', 'Total Amount', '% of Adjustments'];
      typeHeaders.forEach((h, col) => wsAdj.writeWithFormat(curR, col, h, fmtHeader));
      curR++;
      adjTypeRowCount = adjTypes.length;

      const totTypeCount = adjTypes.reduce((s, a) => s + (a.count || 0), 0);
      adjTypes.forEach((a) => {
        const amt = fc(a.amount);
        const share = fp(amt, totAdjAmt);

        wsAdj.write(curR, 0, formatAdjustmentType(a.type));
        wsAdj.writeWithFormat(curR, 1, fi(a.count), fmtInt);
        wsAdj.writeWithFormat(curR, 2, amt, fmtCurrency);
        wsAdj.writeWithFormat(curR, 3, share, fmtPct);
        curR++;
      });

      wsAdj.writeWithFormat(curR, 0, 'TOTAL BY TYPE', fmtTotalLabel);
      wsAdj.writeWithFormat(curR, 1, fi(totTypeCount), fmtTotalInt);
      wsAdj.writeWithFormat(curR, 2, fc(totAdjAmt), fmtTotalCurrency);
      wsAdj.writeWithFormat(curR, 3, 1.0, fmtTotalPct);
      curR += 2;
    }

    if (adjChannels.length > 0) {
      wsAdj.writeWithFormat(curR, 0, 'SALES ADJUSTMENTS BY CHANNEL', fmtSection);
      curR++;
      const chHeaders = ['Sales Channel', 'Count', 'Total Amount', '% of Adjustments'];
      chHeaders.forEach((h, col) => wsAdj.writeWithFormat(curR, col, h, fmtHeader));
      curR++;

      const totChCount = adjChannels.reduce((s, a) => s + (a.count || 0), 0);
      adjChannels.forEach((a) => {
        const chLabel = (CHANNEL_META[a.channel] || {}).label || a.channel;
        const amt = fc(a.amount);
        const share = fp(amt, totAdjAmt);

        wsAdj.write(curR, 0, chLabel);
        wsAdj.writeWithFormat(curR, 1, fi(a.count), fmtInt);
        wsAdj.writeWithFormat(curR, 2, amt, fmtCurrency);
        wsAdj.writeWithFormat(curR, 3, share, fmtPct);
        curR++;
      });

      wsAdj.writeWithFormat(curR, 0, 'TOTAL BY CHANNEL', fmtTotalLabel);
      wsAdj.writeWithFormat(curR, 1, fi(totChCount), fmtTotalInt);
      wsAdj.writeWithFormat(curR, 2, fc(totAdjAmt), fmtTotalCurrency);
      wsAdj.writeWithFormat(curR, 3, 1.0, fmtTotalPct);
      curR += 2;
    }

    if (topAdjusted.length > 0) {
      wsAdj.writeWithFormat(curR, 0, 'TOP ADJUSTED / RETURNED PRODUCTS', fmtSection);
      curR++;
      const prodAdjHeaders = ['Product Name', 'Adjustment Amount', 'Primary Reason'];
      prodAdjHeaders.forEach((h, col) => wsAdj.writeWithFormat(curR, col, h, fmtHeader));
      curR++;

      topAdjusted.forEach((p) => {
        wsAdj.write(curR, 0, p.name || 'Unknown Product');
        wsAdj.writeWithFormat(curR, 1, fc(p.adjustmentAmount), fmtCurrency);
        wsAdj.write(curR, 2, p.reason || '—');
        curR++;
      });
    }

    wsAdj.setColumnWidth(0, 24);
    wsAdj.setColumnWidth(1, 16);
    wsAdj.setColumnWidth(2, 18);
    wsAdj.setColumnWidth(3, 22);
  }

  /* ─────────────────────────────────────────────────────────────
     9. Refund Reasons Sheet (Sorted by Amount DESC)
     ───────────────────────────────────────────────────────────── */
  if (refundReasons.length > 0) {
    const wsRefunds = wb.addWorksheet('Refund Reasons');
    const rrHeaders = ['Refund Reason', 'Incident Count', 'Total Amount', '% of Refund Amount'];
    rrHeaders.forEach((h, col) => wsRefunds.writeWithFormat(0, col, h, fmtHeader));

    refundReasons.forEach((r, idx) => {
      const row = idx + 1;
      const amt = fc(r.amount);
      const count = fi(r.count);
      const share = fp(amt, totRefundAmt);

      wsRefunds.write(row, 0, r.reason || 'Unspecified Reason');
      wsRefunds.writeWithFormat(row, 1, count, fmtInt);
      wsRefunds.writeWithFormat(row, 2, amt, fmtCurrency);
      wsRefunds.writeWithFormat(row, 3, share, fmtPct);
    });

    const totR = refundReasons.length + 1;
    wsRefunds.writeWithFormat(totR, 0, 'TOTAL', fmtTotalLabel);
    wsRefunds.writeWithFormat(totR, 1, fi(totRefundCount), fmtTotalInt);
    wsRefunds.writeWithFormat(totR, 2, fc(totRefundAmt), fmtTotalCurrency);
    wsRefunds.writeWithFormat(totR, 3, 1.0, fmtTotalPct);

    wsRefunds.setColumnWidth(0, 28);
    wsRefunds.setColumnWidth(1, 16);
    wsRefunds.setColumnWidth(2, 18);
    wsRefunds.setColumnWidth(3, 20);
  }

  /* ─────────────────────────────────────────────────────────────
     10. Performance Sheet (Daily, Weekly, Monthly Summary)
     ───────────────────────────────────────────────────────────── */
  if (hasPerf) {
    const wsPerf = wb.addWorksheet('Performance');
    const perfHeaders = ['Period', 'Revenue', 'Transactions', 'Average Transaction'];
    perfHeaders.forEach((h, col) => wsPerf.writeWithFormat(0, col, h, fmtHeader));

    const dailyS = fc(salesReport.dailySales);
    const dailyT = fi(salesReport.dailyTransactions);
    const weeklyS = fc(salesReport.weeklySales);
    const weeklyT = fi(salesReport.weeklyTransactions);
    const monthlyS = fc(salesReport.monthlySales);
    const monthlyT = fi(salesReport.monthlyTransactions);

    const perfRows = [
      ['Today', dailyS, dailyT, dailyT > 0 ? dailyS / dailyT : 0],
      ['This Week', weeklyS, weeklyT, weeklyT > 0 ? weeklyS / weeklyT : 0],
      ['This Month', monthlyS, monthlyT, monthlyT > 0 ? monthlyS / monthlyT : 0],
    ];

    perfRows.forEach((row, idx) => {
      const r = idx + 1;
      wsPerf.write(r, 0, row[0]);
      wsPerf.writeWithFormat(r, 1, row[1], fmtCurrency);
      wsPerf.writeWithFormat(r, 2, row[2], fmtInt);
      wsPerf.writeWithFormat(r, 3, row[3], fmtCurrency);
    });

    wsPerf.setColumnWidth(0, 18);
    wsPerf.setColumnWidth(1, 18);
    wsPerf.setColumnWidth(2, 16);
    wsPerf.setColumnWidth(3, 18);
  }

  /* ─────────────────────────────────────────────────────────────
     11. Report Info Sheet (Audit, Provenance, Metadata)
     ───────────────────────────────────────────────────────────── */
  const wsInfo = wb.addWorksheet('Report Info');
  const infoHeaders = ['Configuration / Metadata Item', 'Report Value', 'Technical Description'];
  infoHeaders.forEach((h, col) => wsInfo.writeWithFormat(0, col, h, fmtHeader));

  const infoRows = [
    ['Report Title', 'CosmosCraft Sales Analytics Report', 'Official management & financial sales reporting workbook'],
    ['Reporting Period', dateLabel || 'All Time', 'Active date filtering period applied to transaction records'],
    ['Generated On', new Date().toLocaleString('en-PH'), 'Exact timestamp when this workbook was generated'],
    ['Exported By', printedBy || 'Unknown User', 'Authenticated administrator or staff account'],
    ['Print / Export Timestamp', datePrinted || new Date().toLocaleString('en-PH'), 'Client-side export invocation timestamp'],
    ['Currency', 'Philippine Peso (PHP / ₱)', 'Default financial currency for all monetary metrics'],
    ['Workbook Engine', 'rusc-xlsx (Native Rust xlsxwriter engine with Excel charts)', 'High-performance spreadsheet and chart generation'],
    ['Data Status', 'Verified live database records', 'Reconciled against walk-in, online, custom, and appointment tables'],
  ];

  infoRows.forEach((row, idx) => {
    const r = idx + 1;
    wsInfo.write(r, 0, row[0]);
    wsInfo.write(r, 1, row[1]);
    wsInfo.write(r, 2, row[2]);
  });

  wsInfo.setColumnWidth(0, 26);
  wsInfo.setColumnWidth(1, 32);
  wsInfo.setColumnWidth(2, 50);

  /* ─────────────────────────────────────────────────────────────
     NATIVE EXCEL CHARTS (Configured via rusc-xlsx)
     Reference source sheets so charts are dynamic & management-ready.
     ───────────────────────────────────────────────────────────── */
  let chartRowPlacement = 28;

  // Chart 1: Net Sales Trend (Line Chart)
  if (wsDaily && dailyRowCount > 0) {
    const endRow = dailyRowCount + 1;
    const chartTrend = new Chart('line');
    chartTrend.addSeries({
      categories: `='Daily Sales'!$A$2:$A$${endRow}`,
      values: `='Daily Sales'!$D$2:$D$${endRow}`,
      name: 'Net Sales',
    });
    chartTrend.setTitle('Net Sales Trend');
    chartTrend.setXAxisName('Date');
    chartTrend.setYAxisName('Net Sales (PHP)');
    chartTrend.setStyle(10);
    wsDash.insertChart(chartRowPlacement, 0, chartTrend);
  }

  // Chart 2: Sales by Channel (Column Chart)
  if (wsChannels && chDataRowCount > 0) {
    const endRow = chDataRowCount + 1;
    const chartChannels = new Chart('column');
    chartChannels.addSeries({
      categories: `='Sales by Channel'!$A$2:$A$${endRow}`,
      values: `='Sales by Channel'!$E$2:$E$${endRow}`,
      name: 'Net Sales',
    });
    chartChannels.setTitle('Sales by Channel');
    chartChannels.setXAxisName('Sales Channel');
    chartChannels.setYAxisName('Net Sales (PHP)');
    chartChannels.setStyle(11);
    wsDash.insertChart(chartRowPlacement, 7, chartChannels);
  }

  if ((wsDaily && dailyRowCount > 0) || (wsChannels && chDataRowCount > 0)) {
    chartRowPlacement += 18;
  }

  // Chart 3: Top Products (Horizontal Bar Chart)
  if (wsProducts && prodRowCount > 0) {
    const topLimit = Math.min(prodRowCount + 1, 11);
    const chartProducts = new Chart('bar');
    chartProducts.addSeries({
      categories: `='Top Products'!$B$2:$B$${topLimit}`,
      values: `='Top Products'!$E$2:$E$${topLimit}`,
      name: 'Total Revenue',
    });
    chartProducts.setTitle('Top Products by Revenue');
    chartProducts.setXAxisName('Revenue (PHP)');
    chartProducts.setYAxisName('Product');
    chartProducts.setStyle(12);
    wsDash.insertChart(chartRowPlacement, 0, chartProducts);
  }

  // Chart 4: Payment Methods (Column/Doughnut Chart)
  if (wsPayments && orderPayRowCount > 0) {
    const endRow = orderPayRowCount + 2;
    const chartPayments = new Chart('column');
    chartPayments.addSeries({
      categories: `='Payments'!$A$3:$A$${endRow}`,
      values: `='Payments'!$C$3:$C$${endRow}`,
      name: 'Order Volume',
    });
    chartPayments.setTitle('Payment Methods Volume');
    chartPayments.setXAxisName('Payment Method');
    chartPayments.setYAxisName('Amount (PHP)');
    chartPayments.setStyle(13);
    wsDash.insertChart(chartRowPlacement, 7, chartPayments);
  }

  if ((wsProducts && prodRowCount > 0) || (wsPayments && orderPayRowCount > 0)) {
    chartRowPlacement += 18;
  }

  // Chart 5: Adjustments by Type (Bar Chart)
  if (wsAdj && adjTypeRowCount > 0) {
    const endRow = adjTypeRowCount + 2;
    const chartAdj = new Chart('bar');
    chartAdj.addSeries({
      categories: `='Adjustments'!$A$3:$A$${endRow}`,
      values: `='Adjustments'!$C$3:$C$${endRow}`,
      name: 'Adjustment Amount',
    });
    chartAdj.setTitle('Sales Adjustments by Type');
    chartAdj.setXAxisName('Amount (PHP)');
    chartAdj.setYAxisName('Adjustment Type');
    chartAdj.setStyle(14);
    wsDash.insertChart(chartRowPlacement, 0, chartAdj);
  }

  return wb.saveToBuffer();
}

module.exports = {
  generateSalesExcelWorkbook,
};
