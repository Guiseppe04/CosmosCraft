require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if the sku column exists on products
    const checkRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'products'
         AND table_schema = current_schema()
         AND column_name = 'sku'`
    );

    if (checkRes.rows.length > 0) {
      await client.query(`ALTER TABLE products DROP COLUMN sku`);
      console.log('✓ Dropped sku column from products');
    } else {
      console.log('• sku column does not exist on products');
    }

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();