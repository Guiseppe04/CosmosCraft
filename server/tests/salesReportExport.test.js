const assert = require('node:assert/strict');
const { test } = require('node:test');
const ExcelJS = require('exceljs');
const { pool } = require('../config/database');
const reports = require('../services/reportService');
const controller = require('../controllers/reportController');

test('all six report types omit pagination only when requested and preserve filter/sort SQL', async () => {
  const original = pool.query;
  try {
    for (const type of ['all','online','pos','customization','appointments','refunds']) {
      for (const paginate of [undefined, false, 'false']) {
        const queries = [];
        pool.query = async (sql, params = []) => {
          queries.push({sql,params});
          return {rows: [{total:25}]};
        };
        const report = await reports.getSalesReport({report_type:type, page:3, limit:10, paginate,
          search:'Customer', status:'completed', sort_by:'amount', sort_order:'asc'});
        const transactionQuery = queries.find(q => /ORDER BY gross_amount ASC/.test(q.sql));
        assert.ok(transactionQuery, type);
        assert.ok(transactionQuery.params.includes('%Customer%'), type + ' search preserved');
        if (paginate === undefined) {
          assert.match(transactionQuery.sql, /LIMIT 10 OFFSET 20/);
          assert.equal(report.pagination.page, 3);
          assert.equal(report.pagination.totalPages, 3);
        } else {
          assert.doesNotMatch(transactionQuery.sql, /LIMIT \d+ OFFSET \d+/);
          assert.equal(report.pagination.page, 1);
          assert.equal(report.pagination.totalPages, 1);
        }
      }
    }
  } finally { pool.query = original; }
});

test('Excel export fetches every matching transaction and includes records beyond 10000', async () => {
  const original = reports.getSalesReport;
  let receivedFilters;
  reports.getSalesReport = async filters => {
    receivedFilters = filters;
    return {reportType:'online', summary:{}, channels:{}, transactions:Array.from({length:10001}, (_,i)=>({
      transaction_number:'ORDER-'+(i+1), date:'2026-10-01', customer_name:'Customer', gross_amount:1, net_amount:1,
    }))};
  };
  try {
    const headers = {};
    let buffer, error;
    await controller.exportSalesExcel({query:{page:3,limit:10},body:{reportType:'online',filters:{search:'Customer',sort_by:'amount',sort_order:'asc',paginate:true},
      reportData:{transactions:[{transaction_number:'STALE-PAGE'}]}}},
      {setHeader(name,value){headers[name]=value;},send(value){buffer=value;}}, err=>{error=err;});
    assert.equal(error, undefined);
    assert.equal(receivedFilters.paginate, false);
    assert.equal(receivedFilters.search, 'Customer');
    assert.equal(receivedFilters.sort_by, 'amount');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const cells = [];
    workbook.eachSheet(sheet=>sheet.eachRow(row=>row.eachCell(cell=>cells.push(cell.value))));
    assert.ok(cells.includes('ORDER-1'));
    assert.ok(cells.includes('ORDER-10001'));
    assert.ok(!cells.includes('STALE-PAGE'));
    assert.match(headers['Content-Type'], /spreadsheetml/);
  } finally { reports.getSalesReport = original; }
});
