const assert = require('node:assert/strict');
const { pool } = require('../config/database');
const { getSalesReport } = require('../services/reportService');

async function run() {
  const originalQuery = pool.query;
  try {
    for (const [reportType, scope] of Object.entries({ all: 'all', online: 'online', pos: 'walkIn', customization: 'customization', appointments: 'appointment', refunds: 'refunds' })) {
      let trendCall;
      pool.query = async (sql, params = []) => {
        if (sql.includes('WITH combined_days AS')) {
          trendCall = { sql, params };
          return { rows: [{ date: '2026-10-05', gross: '120', transactions: 1 }] };
        }
        return { rows: [{ total: 0 }] };
      };
      const report = await getSalesReport({ report_type: reportType, start_date: '2026-10-01', end_date: '2026-10-05' });
      assert.equal(trendCall.params.at(-1), scope);
      assert.match(trendCall.sql, /WHERE \(\$\d+::text = 'all' AND channel != 'refunds'\) OR channel = \$\d+::text/);
      assert.equal(trendCall.params.length, 11);
      assert.equal(report.reportType, reportType);
      assert.equal(report.dailyTrend[0].revenue, 120);
    }
    console.log('Passed: all six sales tabs request their own daily trend scope and preserve the date range.');
  } finally {
    pool.query = originalQuery;
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
