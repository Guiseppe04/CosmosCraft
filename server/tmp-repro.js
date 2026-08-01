require('dotenv').config();
const { pool } = require('./config/database');

(async () => {
  try {
    const res = await pool.query('SELECT project_id, title, order_id FROM projects ORDER BY created_at DESC LIMIT 10');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
