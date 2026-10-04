const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
let ready = false;
let pending = null;

// Run before opening task transactions. Retry on failure instead of leaving
// the application permanently marked ready after a failed schema migration.
exports.ensureTaskSchema = async () => {
  if (ready) return;
  if (!pending) pending = (async () => {
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/37_project_task_progress.sql'), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
    ready = true;
  })().finally(() => { pending = null; });
  return pending;
};
