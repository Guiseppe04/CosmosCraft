const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./config/database');

(async () => {
  try {
    const res = await pool.query('SELECT DISTINCT action FROM audit_logs');
    console.log('Distinct actions:', res.rows.map(r => r.action).join(', '));
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();