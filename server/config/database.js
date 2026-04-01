const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log(`PostgreSQL connected: ${client.host || 'local'}`);
    client.release();
    return pool;
  } catch (error) {
    console.error(`PostgreSQL connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { pool, connectDB };