const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require(path.join(__dirname, 'config', 'database'));

(async () => {
  try {
    const { rows } = await pool.query('SELECT DISTINCT action FROM audit_logs');
    console.log(rows.map(r => r.action).sort().join('\n'));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();