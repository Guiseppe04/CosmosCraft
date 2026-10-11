const { Pool } = require('pg');
const { installAuditDatabaseContext } = require('./auditDatabaseContext');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

installAuditDatabaseContext(pool);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err.message);
});

const connectDB = async (retries = 5, delay = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();
      const auditReady = await client.query(`SELECT to_regprocedure('public.audit_record_change()') IS NOT NULL AS ready`);
      if (!auditReady.rows[0]?.ready) {
        throw new Error('Database audit triggers are missing. Run server/migrations/run-migration46.js before starting the server.');
      }
      const unaudited = await client.query(`SELECT c.relname
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'audit_logs'
          AND NOT EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.oid
            AND t.tgname = 'trg_database_audit' AND t.tgenabled IN ('O', 'A'))`);
      if (unaudited.rows.length) {
        throw new Error(`Missing database audit triggers for: ${unaudited.rows.map(row => row.relname).join(', ')}`);
      }
      console.log(`PostgreSQL connected: ${client.host || 'remote'}`);
      return pool;
    } catch (error) {
      console.error(`PostgreSQL connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) {
        console.error('Exhausted PostgreSQL connection attempts. Exiting...');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    } finally {
      if (client) client.release();
    }
  }
};

module.exports = { pool, connectDB };
