const AsposeCells = require('aspose.cells.node');

const {
  BackgroundType,
  ChartType,
  Color,
  FileFormatType,
  License,
  PageOrientationType,
  PaperSizeType,
  SaveFormat,
  TextAlignmentType,
  Workbook,
} = AsposeCells;

const CHANNEL_META = {
  walkIn: 'Walk-in / POS',
  online: 'Online Orders',
  customization: 'Customization',
  appointments: 'Appointments',
};

const PAYMENT_LABELS = {
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
};

const CURRENCY_FORMAT = '"₱"#,##0.00';
const INTEGER_FORMAT = '#,##0';
const PERCENT_FORMAT = '0.0%';

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function currency(value) {
  return Number(number(value).toFixed(2));
}

function integer(value) {
  return Math.round(number(value));
}

function percent(value, total) {
  return total > 0 ? Number((value / total).toFixed(4)) : 0;
}

function formatMethod(method) {
  if (!method) return 'Unknown';
  if (PAYMENT_LABELS[method]) return PAYMENT_LABELS[method];
  return method.split(/[_\s]+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatAdjustmentType(type) {
  if (!type) return 'Other';
  const clean = type.trim();
  const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
  return capitalized.endsWith('s') ? capitalized : `${capitalized}s`;
}

function getStyles(workbook) {
  const cache = new Map();
  const palette = {
    ink: new Color(31, 41, 55),
    gold: new Color(180, 83, 9),
    paleGold: new Color(254, 243, 199),
    paleBlue: new Color(239, 246, 255),
    paleGray: new Color(249, 250, 251),
    green: new Color(5, 150, 105),
    red: new Color(185, 28, 28),
    white: Color.White,
    text: new Color(31, 41, 55),
    muted: new Color(75, 85, 99),
  };

  function get({ fill, fontColor, bold = false, alignment = 'left', format = '' } = {}) {
    const key = [fill || '', fontColor || '', bold, alignment, format].join('|');
    if (cache.has(key)) return cache.get(key);

    const style = workbook.createStyle();
    if (fill) {
      style.pattern = BackgroundType.Solid;
      style.foregroundColor = fill;
    }
    style.font.color = fontColor || palette.text;
    style.font.isBold = bold;
    style.verticalAlignment = TextAlignmentType.Center;
    style.horizontalAlignment = alignment === 'right'
      ? TextAlignmentType.Right
      : alignment === 'center' ? TextAlignmentType.Center : TextAlignmentType.Left;
    style.isTextWrapped = true;
    if (format) style.custom = format;
    cache.set(key, style);
    return style;
  }

  return { get, palette };
}

function writeCell(sheet, row, column, value, style) {
  const cell = sheet.cells.get(row, column);
  cell.putValue(value === undefined || value === null ? '' : value);
  if (style) cell.setStyle(style);
}

function columnName(index) {
  let value = index + 1;
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

function configurePrint(sheet, lastRow, lastColumn, { repeatHeader = true } = {}) {
  const setup = sheet.pageSetup;
  setup.orientation = PageOrientationType.Landscape;
  setup.paperSize = PaperSizeType.PaperA4;
  setup.fitToPagesWide = 1;
  setup.fitToPagesTall = 0;
  setup.isPercentScale = false;
  setup.centerHorizontally = true;
  setup.printArea = `A1:${columnName(lastColumn)}${Math.max(1, lastRow + 1)}`;
  setup.setHeader(1, '&BCosmosCraft Sales Report');
  setup.setFooter(0, '&LPrinted by CosmosCraft');
  setup.setFooter(2, 'Page &P of &N');
  if (repeatHeader) setup.printTitleRows = '$1:$1';
}

function addTableSheet(workbook, styles, name, headers, rows, options = {}) {
  const sheetIndex = workbook.worksheets.add();
  const sheet = workbook.worksheets.get(sheetIndex);
  sheet.name = name;
  sheet.tabColor = options.tabColor || styles.palette.gold;

  headers.forEach((header, column) => {
    writeCell(sheet, 0, column, header, styles.get({
      fill: styles.palette.ink,
      fontColor: styles.palette.white,
      bold: true,
      alignment: column === 0 ? 'left' : 'center',
    }));
  });
  sheet.cells.setRowHeight(0, 26);

  rows.forEach((row, rowIndex) => {
    const total = options.totalRow?.(row, rowIndex) ?? row[0]?.toString().startsWith('TOTAL');
    const fill = total ? styles.palette.paleGold : rowIndex % 2 ? styles.palette.paleGray : undefined;
    row.forEach((value, column) => {
      const format = options.formatForCell
        ? options.formatForCell(value, row, rowIndex, column)
        : options.formats?.[column] || '';
      const isNumeric = typeof value === 'number';
      writeCell(sheet, rowIndex + 1, column, value, styles.get({
        fill,
        fontColor: total ? styles.palette.gold : (column === options.negativeColumn ? styles.palette.red : undefined),
        bold: total,
        alignment: isNumeric ? 'right' : 'left',
        format,
      }));
    });
  });

  const widths = headers.map((header, column) => {
    const longest = Math.max(
      String(header).length,
      ...rows.map((row) => String(row[column] ?? '').length),
    );
    return Math.min(Math.max(longest + 3, options.minWidth || 12), options.maxWidth || 42);
  });
  widths.forEach((width, column) => sheet.cells.setColumnWidth(column, width));
  configurePrint(sheet, rows.length, headers.length - 1, { repeatHeader: options.repeatHeader !== false });
  return sheet;
}

function addChart(sheet, type, title, categoryRange, valueRange, placement) {
  const index = sheet.charts.add(type, placement.top, placement.left, placement.bottom, placement.right);
  const chart = sheet.charts.get(index);
  chart.style = 10;
  chart.title.setText(title);
  chart.nSeries.add(valueRange, true);
  chart.nSeries.categoryData = categoryRange;
  return chart;
}

function maybeApplyLicense() {
  const licensePath = process.env.ASPOSE_CELLS_LICENSE;
  if (licensePath) {
    new License().setLicense(licensePath);
  }
}

function generateCustomerSummaryExcelWorkbook(customerSummary, options = {}) {
  if (!customerSummary || !Array.isArray(customerSummary.rows)) {
    throw new Error('Customer summary rows are required to generate the workbook.');
  }
  maybeApplyLicense();

  const workbook = new Workbook(FileFormatType.Xlsx);
  const styles = getStyles(workbook);
  const sheet = workbook.worksheets.get(0);
  const rows = customerSummary.rows;
  const totals = customerSummary.totals || { customers: 0, transactions: 0, sales: 0 };
  const filters = customerSummary.filters || {};
  const filterLabels = {
    channel: 'Sales channel',
    status: 'Order status',
    payment_status: 'Payment status',
    payment_method: 'Payment method',
    start_date: 'From',
    end_date: 'To',
  };
  const activeFilters = Object.entries(filterLabels)
    .filter(([key]) => filters[key])
    .map(([key, label]) => `${label}: ${String(filters[key]).replace(/_/g, ' ')}`);
  const sortLabels = { sales: 'Total sales', orders: 'Transactions', recent: 'Last purchase', name: 'Customer name' };
  const headerRow = 8;
  const firstDataRow = headerRow + 1;
  const dateFormat = 'mmm d, yyyy';

  sheet.name = 'Customer Summary';
  sheet.tabColor = styles.palette.gold;
  writeCell(sheet, 0, 0, 'CUSTOMER SALES PREVIEW', styles.get({ fontColor: styles.palette.gold, bold: true }));
  writeCell(sheet, 2, 0, 'Search');
  writeCell(sheet, 2, 1, customerSummary.search || 'All customers');
  writeCell(sheet, 3, 0, 'Filters');
  writeCell(sheet, 3, 1, activeFilters.length ? activeFilters.join('; ') : 'None');
  writeCell(sheet, 4, 0, 'Sorted By');
  writeCell(sheet, 4, 1, `${sortLabels[filters.sort_by] || filters.sort_by || 'Total sales'} (${filters.sort_order || 'desc'})`);
  writeCell(sheet, 5, 0, 'Printed By');
  writeCell(sheet, 5, 1, options.printedBy || 'Unknown User');
  writeCell(sheet, 6, 0, 'Printed On');
  writeCell(sheet, 6, 1, options.datePrinted || new Date().toLocaleString('en-PH'));

  const headers = ['Sales Channel', 'Customer', 'Transactions', 'Total Sales', 'Last Purchase'];
  headers.forEach((header, column) => writeCell(sheet, headerRow, column, header, styles.get({
    fill: styles.palette.ink,
    fontColor: styles.palette.white,
    bold: true,
    alignment: column > 1 ? 'center' : 'left',
  })));
  sheet.cells.setRowHeight(headerRow, 26);

  rows.forEach((row, index) => {
    const rowIndex = firstDataRow + index;
    const fill = index % 2 ? styles.palette.paleGray : undefined;
    let lastPurchase = row.last_purchase_date || '';
    if (lastPurchase) {
      const parsedDate = new Date(lastPurchase);
      lastPurchase = Number.isNaN(parsedDate.getTime()) ? String(lastPurchase) : parsedDate;
    }
    [
      row.channel || '',
      row.customer_name || '',
      integer(row.transactions),
      currency(row.total_sales),
      lastPurchase,
    ].forEach((value, column) => {
      const format = column === 2 ? INTEGER_FORMAT : column === 3 ? CURRENCY_FORMAT : column === 4 && value instanceof Date ? dateFormat : '';
      writeCell(sheet, rowIndex, column, value, styles.get({
        fill,
        alignment: column > 1 ? 'right' : 'left',
        format,
      }));
    });
  });

  const totalRow = firstDataRow + rows.length;
  [
    'Total',
    `${integer(totals.customers)} customers`,
    integer(totals.transactions),
    currency(totals.sales),
    '',
  ].forEach((value, column) => writeCell(sheet, totalRow, column, value, styles.get({
    fill: styles.palette.paleGold,
    fontColor: styles.palette.gold,
    bold: true,
    alignment: column > 1 ? 'right' : 'left',
    format: column === 2 ? INTEGER_FORMAT : column === 3 ? CURRENCY_FORMAT : '',
  })));

  [22, 30, 16, 20, 20].forEach((width, column) => sheet.cells.setColumnWidth(column, width));
  configurePrint(sheet, totalRow, headers.length - 1, { repeatHeader: false });
  sheet.pageSetup.printTitleRows = `$${headerRow + 1}:$${headerRow + 1}`;
  return Buffer.from(workbook.save(SaveFormat.Xlsx));
}

function generateSalesExcelWorkbook(salesReport, options = {}) {
  if (!salesReport) throw new Error('Sales report data is required to generate the workbook.');
  maybeApplyLicense();

  const {
    dateLabel = 'All Time',
    printedBy = 'Administrator',
    datePrinted = new Date().toLocaleString('en-PH'),
  } = options;
  const workbook = new Workbook(FileFormatType.Xlsx);
  const styles = getStyles(workbook);
  const channels = salesReport.channels || {};
  const netSales = number(salesReport.netSales);
  const grossSales = number(salesReport.grossSales);
  const totalAdjustments = number(salesReport.totalAdjustments);
  const totalTransactions = integer(salesReport.totalTransactions);

  const channelsList = Object.entries(channels).map(([key, channel]) => ({
    label: CHANNEL_META[key] || key,
    transactions: integer(channel.transactions),
    gross: currency(channel.gross),
    adjustments: currency(channel.adjustments),
    net: currency(channel.net),
    average: number(channel.transactions) > 0 ? currency(channel.gross / channel.transactions) : 0,
    share: percent(number(channel.net), netSales),
  })).sort((a, b) => b.net - a.net);

  const dailyData = (salesReport.dailyTrend || []).map((day) => ({
    date: day.date,
    gross: currency(day.revenue),
    adjustments: currency(day.adjustments),
    net: currency(number(day.revenue) - number(day.adjustments)),
    transactions: integer(day.transactions),
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  const products = [...(salesReport.bestSellingProducts || [])]
    .sort((a, b) => number(b.revenue) - number(a.revenue));
  const orderPayments = [...(salesReport.orderPaymentMethods || [])]
    .sort((a, b) => number(b.amount) - number(a.amount));
  const appointmentPayments = [...(salesReport.appointmentPaymentMethods || [])]
    .sort((a, b) => number(b.revenue) - number(a.revenue));

  const dashboard = workbook.worksheets.get(0);
  dashboard.name = 'Dashboard';
  dashboard.tabColor = styles.palette.gold;
  writeCell(dashboard, 0, 0, 'COSMOSCRAFT GUITARS & CUSTOM SHOP', styles.get({
    fontColor: styles.palette.gold,
    bold: true,
  }));
  writeCell(dashboard, 1, 0, 'Executive Sales & Management Analytics Dashboard', styles.get({
    fontColor: styles.palette.muted,
  }));
  writeCell(dashboard, 3, 0, 'REPORT METADATA', styles.get({
    fontColor: styles.palette.gold,
    bold: true,
  }));
  writeCell(dashboard, 4, 0, 'Reporting Period');
  writeCell(dashboard, 4, 1, dateLabel || 'All Time');
  writeCell(dashboard, 4, 3, 'Generated On');
  writeCell(dashboard, 4, 4, new Date().toLocaleString('en-PH'));
  writeCell(dashboard, 5, 0, 'Exported By');
  writeCell(dashboard, 5, 1, printedBy || 'Unknown User');
  writeCell(dashboard, 5, 3, 'Currency');
  writeCell(dashboard, 5, 4, 'Philippine Peso (PHP / ₱)');

  const kpiHeaders = ['Metric', 'Amount / Value', 'Metric Type', 'Performance Notes'];
  const kpis = [
    ['Gross Sales', grossSales, 'Revenue', 'Total unadjusted sales value across all channels'],
    ['Total Adjustments', totalAdjustments, 'Deduction', 'Refunds, returns, and voids'],
    ['Net Sales', netSales, 'Primary KPI', 'Gross Sales minus Total Adjustments'],
    ['Total Transactions', totalTransactions, 'Volume', 'Completed customer transactions'],
    ['Average Transaction', totalTransactions ? grossSales / totalTransactions : 0, 'Efficiency', 'Gross revenue per transaction'],
    ['Customization Orders', integer(salesReport.customizationOrders), 'Custom Shop', 'Custom builds and modifications'],
    ['Adjustment Rate', grossSales ? totalAdjustments / grossSales : 0, 'Operational', 'Adjustments as a share of gross sales'],
    ['Net Sales as % of Gross', grossSales ? netSales / grossSales : 0, 'Operational', 'Revenue retained after adjustments'],
  ];
  kpiHeaders.forEach((header, column) => writeCell(dashboard, 8, column, header, styles.get({
    fill: styles.palette.ink,
    fontColor: styles.palette.white,
    bold: true,
  })));
  kpis.forEach((row, index) => {
    const rowIndex = index + 9;
    const primary = row[0] === 'Net Sales';
    const fill = primary ? styles.palette.paleGold : index % 2 ? styles.palette.paleGray : undefined;
    writeCell(dashboard, rowIndex, 0, row[0], styles.get({ fill, bold: primary, fontColor: primary ? styles.palette.gold : undefined }));
    const format = ['Gross Sales', 'Total Adjustments', 'Net Sales', 'Average Transaction'].includes(row[0])
      ? CURRENCY_FORMAT
      : ['Adjustment Rate', 'Net Sales as % of Gross'].includes(row[0]) ? PERCENT_FORMAT
        : ['Total Transactions', 'Customization Orders'].includes(row[0]) ? INTEGER_FORMAT : '';
    writeCell(dashboard, rowIndex, 1, row[1], styles.get({
      fill,
      bold: primary,
      fontColor: primary ? styles.palette.gold : undefined,
      alignment: 'right',
      format,
    }));
    writeCell(dashboard, rowIndex, 2, row[2]);
    writeCell(dashboard, rowIndex, 3, row[3]);
  });

  const channelSnapshotRow = 19;
  writeCell(dashboard, channelSnapshotRow, 0, 'CHANNEL REVENUE CONTRIBUTION', styles.get({
    fontColor: styles.palette.gold,
    bold: true,
  }));
  const channelHeaders = ['Sales Channel', 'Transactions', 'Gross Sales', 'Net Sales', 'Share of Net Sales'];
  channelHeaders.forEach((header, column) => writeCell(dashboard, channelSnapshotRow + 1, column, header, styles.get({
    fill: styles.palette.ink,
    fontColor: styles.palette.white,
    bold: true,
  })));
  channelsList.forEach((channel, index) => {
    const row = channelSnapshotRow + 2 + index;
    [channel.label, channel.transactions, channel.gross, channel.net, channel.share].forEach((value, column) => {
      const format = column === 1 ? INTEGER_FORMAT : [2, 3].includes(column) ? CURRENCY_FORMAT : column === 4 ? PERCENT_FORMAT : '';
      writeCell(dashboard, row, column, value, styles.get({
        fill: index % 2 ? styles.palette.paleGray : undefined,
        alignment: typeof value === 'number' ? 'right' : 'left',
        format,
      }));
    });
  });
  const dashboardTotalRow = channelSnapshotRow + 2 + channelsList.length;
  ['TOTAL', totalTransactions, grossSales, netSales, 1].forEach((value, column) => {
    const format = column === 1 ? INTEGER_FORMAT : [2, 3].includes(column) ? CURRENCY_FORMAT : column === 4 ? PERCENT_FORMAT : '';
    writeCell(dashboard, dashboardTotalRow, column, value, styles.get({
      fill: styles.palette.paleGold,
      fontColor: styles.palette.gold,
      bold: true,
      alignment: typeof value === 'number' ? 'right' : 'left',
      format,
    }));
  });
  [30, 18, 18, 18, 20, 18, 18, 4, 18, 18, 18, 18, 18, 18, 18, 18].forEach((width, column) => {
    dashboard.cells.setColumnWidth(column, width);
  });

  addTableSheet(workbook, styles, 'Executive Summary',
    ['Sales Metric', 'Amount / Value', 'Operational Definition'],
    [
      ['Gross Sales', grossSales, 'Total unadjusted sales value across all channels'],
      ['Total Adjustments', totalAdjustments, 'Refunds, returns, and voids'],
      ['Net Sales', netSales, 'Gross Sales less Total Adjustments'],
      ['Total Transactions', totalTransactions, 'Completed customer transactions'],
      ['Average Transaction', totalTransactions ? grossSales / totalTransactions : 0, 'Gross revenue per transaction'],
      ['Customization Orders', integer(salesReport.customizationOrders), 'Custom builds and modifications'],
      ['Adjustment Rate', grossSales ? totalAdjustments / grossSales : 0, 'Adjustments as a share of gross sales'],
      ['Net Sales as % of Gross', grossSales ? netSales / grossSales : 0, 'Revenue retained after adjustments'],
    ],
    {
      tabColor: new Color(37, 99, 235),
      formatForCell: (_value, row) => {
        if (['Total Transactions', 'Customization Orders'].includes(row[0])) return INTEGER_FORMAT;
        if (['Adjustment Rate', 'Net Sales as % of Gross'].includes(row[0])) return PERCENT_FORMAT;
        return CURRENCY_FORMAT;
      },
    },
  );

  const channelRows = channelsList.map((channel) => [
    channel.label,
    channel.transactions,
    channel.gross,
    channel.adjustments,
    channel.net,
    channel.share,
    channel.average,
  ]);
  channelRows.push(['TOTAL', totalTransactions, grossSales, totalAdjustments, netSales, 1, totalTransactions ? grossSales / totalTransactions : 0]);
  const channelSheet = addTableSheet(workbook, styles, 'Sales by Channel',
    ['Sales Channel', 'Transactions', 'Gross Sales', 'Adjustments', 'Net Sales', '% of Net Sales', 'Average Transaction'],
    channelRows,
    { tabColor: new Color(5, 150, 105), formats: { 1: INTEGER_FORMAT, 2: CURRENCY_FORMAT, 3: CURRENCY_FORMAT, 4: CURRENCY_FORMAT, 5: PERCENT_FORMAT, 6: CURRENCY_FORMAT },
      totalRow: (_row, index) => index === channelRows.length - 1 },
  );

  const dailyRows = dailyData.map((day) => [
    day.date,
    day.gross,
    day.adjustments,
    day.net,
    day.transactions,
    day.transactions ? day.gross / day.transactions : 0,
  ]);
  dailyRows.push([
    'TOTAL',
    dailyData.reduce((sum, day) => sum + day.gross, 0),
    dailyData.reduce((sum, day) => sum + day.adjustments, 0),
    dailyData.reduce((sum, day) => sum + day.net, 0),
    dailyData.reduce((sum, day) => sum + day.transactions, 0),
    totalTransactions ? grossSales / totalTransactions : 0,
  ]);
  const dailySheet = addTableSheet(workbook, styles, 'Daily Sales',
    ['Date', 'Gross Sales', 'Adjustments', 'Net Sales', 'Transactions', 'Average Transaction'],
    dailyRows,
    { tabColor: new Color(2, 132, 199), formats: { 1: CURRENCY_FORMAT, 2: CURRENCY_FORMAT, 3: CURRENCY_FORMAT, 4: INTEGER_FORMAT, 5: CURRENCY_FORMAT },
      totalRow: (_row, index) => index === dailyRows.length - 1 },
  );

  const productRows = products.map((product, index) => {
    const units = integer(product.units);
    const revenue = currency(product.revenue);
    return [index + 1, product.name || 'Unknown Product', product.category || 'General', units, revenue,
      units ? revenue / units : 0, percent(revenue, products.reduce((sum, item) => sum + number(item.revenue), 0))];
  });
  const productRevenue = products.reduce((sum, product) => sum + number(product.revenue), 0);
  const productUnits = products.reduce((sum, product) => sum + integer(product.units), 0);
  productRows.push(['', 'TOTAL', '', productUnits, productRevenue, productUnits ? productRevenue / productUnits : 0, 1]);
  const productSheet = addTableSheet(workbook, styles, 'Top Products',
    ['Rank', 'Product Name', 'Category', 'Units Sold', 'Total Revenue', 'Average Price per Unit', 'Revenue Share %'],
    productRows,
    { tabColor: new Color(217, 119, 6), formats: { 0: INTEGER_FORMAT, 3: INTEGER_FORMAT, 4: CURRENCY_FORMAT, 5: CURRENCY_FORMAT, 6: PERCENT_FORMAT },
      totalRow: (_row, index) => index === productRows.length - 1 },
  );

  const customization = channels.customization || {};
  const customizationRows = [
    ['Total Customization Orders', integer(salesReport.customizationOrders), 'Total custom guitar build requests'],
    ['Gross Sales', currency(customization.gross), 'Custom builds and modifications before deductions'],
    ['Adjustments', currency(customization.adjustments), 'Refunds and deductions'],
    ['Net Sales', currency(customization.net), 'Gross sales less adjustments'],
    ['Transactions', integer(customization.transactions), 'Completed custom-shop transactions'],
    ['Average Order Value', integer(salesReport.customizationOrders) ? currency(customization.net / salesReport.customizationOrders) : 0, 'Net sales per customization order'],
    ['% of Total Net Sales', percent(number(customization.net), netSales), 'Share of overall net sales'],
  ];
  const customizationSheet = addTableSheet(workbook, styles, 'Customization',
    ['Customization Metric', 'Amount / Value', 'Operational Notes'],
    customizationRows,
    {
      tabColor: new Color(124, 58, 237),
      formatForCell: (_value, row, _rowIndex, column) => {
        if (column !== 1) return '';
        if (['Total Customization Orders', 'Transactions'].includes(row[0])) return INTEGER_FORMAT;
        if (row[0] === '% of Total Net Sales') return PERCENT_FORMAT;
        return CURRENCY_FORMAT;
      },
    },
  );

  const paymentRows = [];
  const paymentTotals = {};
  orderPayments.forEach((payment) => {
    const scope = 'Order';
    paymentTotals[scope] ||= { transactions: 0, amount: 0 };
    const transactions = integer(payment.transactions);
    const amount = currency(payment.amount);
    paymentTotals[scope].transactions += transactions;
    paymentTotals[scope].amount += amount;
    paymentRows.push([scope, formatMethod(payment.method), transactions, amount, transactions ? amount / transactions : 0]);
  });
  appointmentPayments.forEach((payment) => {
    const scope = 'Appointment';
    paymentTotals[scope] ||= { transactions: 0, amount: 0 };
    const transactions = integer(payment.appointments);
    const amount = currency(payment.revenue);
    paymentTotals[scope].transactions += transactions;
    paymentTotals[scope].amount += amount;
    paymentRows.push([scope, formatMethod(payment.method), transactions, amount, transactions ? amount / transactions : 0]);
  });
  Object.entries(paymentTotals).forEach(([scope, totals]) => {
    paymentRows.push([`TOTAL ${scope.toUpperCase()}`, '', totals.transactions, totals.amount,
      totals.transactions ? totals.amount / totals.transactions : 0]);
  });
  addTableSheet(workbook, styles, 'Payments',
    ['Payment Scope', 'Payment Method', 'Transactions', 'Total Amount', 'Average Transaction'],
    paymentRows,
    { tabColor: new Color(15, 118, 110), formats: { 2: INTEGER_FORMAT, 3: CURRENCY_FORMAT, 4: CURRENCY_FORMAT },
      totalRow: (row) => String(row[0]).startsWith('TOTAL') },
  );

  const adjustmentRows = [];
  (salesReport.adjustmentsByType || []).forEach((adjustment) => adjustmentRows.push([
    'Type', formatAdjustmentType(adjustment.type), integer(adjustment.count), currency(adjustment.amount), '',
  ]));
  (salesReport.adjustmentsByChannel || []).forEach((adjustment) => adjustmentRows.push([
    'Channel', CHANNEL_META[adjustment.channel] || adjustment.channel, integer(adjustment.count), currency(adjustment.amount), '',
  ]));
  (salesReport.topAdjustedProducts || []).forEach((product) => adjustmentRows.push([
    'Product', product.name || 'Unknown Product', '', currency(product.adjustmentAmount), product.reason || '—',
  ]));
  addTableSheet(workbook, styles, 'Adjustments',
    ['Adjustment Group', 'Type / Channel / Product', 'Count', 'Adjustment Amount', 'Reason'],
    adjustmentRows,
    { tabColor: new Color(220, 38, 38), formats: { 2: INTEGER_FORMAT, 3: CURRENCY_FORMAT } },
  );

  const refunds = [...(salesReport.refundReasons || [])].sort((a, b) => number(b.amount) - number(a.amount));
  const refundRows = refunds.map((refund) => [
    refund.reason || 'Unspecified Reason', integer(refund.count), currency(refund.amount), percent(number(refund.amount), refunds.reduce((sum, item) => sum + number(item.amount), 0)),
  ]);
  refundRows.push(['TOTAL', refunds.reduce((sum, refund) => sum + integer(refund.count), 0), refunds.reduce((sum, refund) => sum + currency(refund.amount), 0), 1]);
  addTableSheet(workbook, styles, 'Refund Reasons',
    ['Refund Reason', 'Incident Count', 'Total Amount', '% of Refund Amount'],
    refundRows,
    { tabColor: new Color(190, 24, 93), formats: { 1: INTEGER_FORMAT, 2: CURRENCY_FORMAT, 3: PERCENT_FORMAT },
      totalRow: (_row, index) => index === refundRows.length - 1 },
  );

  addTableSheet(workbook, styles, 'Performance',
    ['Period', 'Revenue', 'Transactions', 'Average Transaction'],
    [
      ['Today', currency(salesReport.dailySales), integer(salesReport.dailyTransactions), number(salesReport.dailyTransactions) ? currency(salesReport.dailySales / salesReport.dailyTransactions) : 0],
      ['This Week', currency(salesReport.weeklySales), integer(salesReport.weeklyTransactions), number(salesReport.weeklyTransactions) ? currency(salesReport.weeklySales / salesReport.weeklyTransactions) : 0],
      ['This Month', currency(salesReport.monthlySales), integer(salesReport.monthlyTransactions), number(salesReport.monthlyTransactions) ? currency(salesReport.monthlySales / salesReport.monthlyTransactions) : 0],
    ],
    { tabColor: new Color(79, 70, 229), formats: { 1: CURRENCY_FORMAT, 2: INTEGER_FORMAT, 3: CURRENCY_FORMAT } },
  );

  const reportInfo = [
    ['Report Title', 'CosmosCraft Sales Analytics Report'],
    ['Reporting Period', dateLabel || 'All Time'],
    ['Generated On', new Date().toLocaleString('en-PH')],
    ['Exported By', printedBy || 'Unknown User'],
    ['Print / Export Timestamp', datePrinted || new Date().toLocaleString('en-PH')],
    ['Currency', 'Philippine Peso (PHP / ₱)'],
    ['Workbook Engine', 'Aspose.Cells for Node.js via C++'],
    ['Data Status', 'Verified live database records'],
  ];
  addTableSheet(workbook, styles, 'Report Info',
    ['Configuration / Metadata Item', 'Report Value'], reportInfo,
    { tabColor: new Color(75, 85, 99), minWidth: 18 },
  );

  const channelEndRow = channelsList.length + 1;
  const dailyEndRow = dailyData.length + 1;
  if (channelsList.length) {
    addChart(dashboard, ChartType.Column, 'Net Sales by Channel',
      `'Sales by Channel'!$A$2:$A$${channelEndRow}`,
      `'Sales by Channel'!$E$2:$E$${channelEndRow}`,
      { top: 27, left: 0, bottom: 43, right: 7 },
    );
  }
  if (dailyData.length) {
    addChart(dashboard, ChartType.Line, 'Net Sales Trend',
      `'Daily Sales'!$A$2:$A$${dailyEndRow}`,
      `'Daily Sales'!$D$2:$D$${dailyEndRow}`,
      { top: 27, left: 8, bottom: 43, right: 15 },
    );
  }
  if (products.length) {
    const productEndRow = Math.min(products.length + 1, 11);
    addChart(dashboard, ChartType.Bar, 'Top Products by Revenue',
      `'Top Products'!$B$2:$B$${productEndRow}`,
      `'Top Products'!$E$2:$E$${productEndRow}`,
      { top: 45, left: 0, bottom: 61, right: 7 },
    );
  }

  configurePrint(dashboard, Math.max(dashboardTotalRow, channelsList.length ? 43 : 25, dailyData.length ? 43 : 25, products.length ? 61 : 25),
    channelsList.length || dailyData.length || products.length ? 15 : 4, { repeatHeader: false });

  return Buffer.from(workbook.save(SaveFormat.Xlsx));
}

module.exports = {
  generateCustomerSummaryExcelWorkbook,
  generateSalesExcelWorkbook,
};
