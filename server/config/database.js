const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

const connectDB = async () => {
  let client;
  try {
    client = await pool.connect();
    console.log(`PostgreSQL connected: ${client.host || 'local'}`);
    return pool;
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`);
    process.exit(1);
  } finally {
    if (client) client.release();
  }
};

module.exports = { pool, connectDB };