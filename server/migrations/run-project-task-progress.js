require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const { pool } = require('../config/database');
const fs = require('fs');
(async () => {
  let client;
  try {
    client = await pool.connect(); await client.query('BEGIN');
    await client.query(fs.readFileSync(require('path').join(__dirname, '37_project_task_progress.sql'), 'utf8'));
    await client.query('COMMIT'); console.log('Project task progress migration applied.');
  } catch (e) { if (client) await client.query('ROLLBACK').catch(() => {}); console.error('Task migration failed:', e.code || e.name, e.message.replace(/postgres(?:ql)?:\/\/\S+/gi, '[database connection]')); process.exitCode = 1; }
  finally { if (client) client.release(); await pool.end(); }
})();
