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

async function connectDB(retries = 5, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();
      console.log(`PostgreSQL connected: ${client.host || 'remote'}`);
      return pool;
    } catch (error) {
      console.error(`PostgreSQL connection attempt ${attempt}/${retries} failed: ${error.message}`);
      if (attempt === retries) {
        throw error;
      }
    } finally {
      client?.release();
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

module.exports = { pool, connectDB };
