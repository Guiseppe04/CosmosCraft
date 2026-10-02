const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  keepAlive: true,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err.message);
});

const connectDB = async (retries = 5, delay = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    let client;
    try {
      client = await pool.connect();
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