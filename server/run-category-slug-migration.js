require('dotenv').config();
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const categoryCheckRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'categories'
         AND table_schema = current_schema()
         AND column_name = 'slug'`
    );

    if (categoryCheckRes.rows.length > 0) {
      await client.query(`ALTER TABLE categories DROP COLUMN IF EXISTS slug`);
      console.log('✓ Removed slug column from categories');
    } else {
      console.log('• slug column does not exist on categories');
    }

    await client.query(`DROP INDEX IF EXISTS idx_categories_slug`);
    console.log('✓ Removed category slug index if present');

    const orderItemCheckRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'order_items'
         AND table_schema = current_schema()
         AND column_name = 'product_sku'`
    );

    if (orderItemCheckRes.rows.length > 0) {
      await client.query(`ALTER TABLE order_items DROP COLUMN IF EXISTS product_sku`);
      console.log('✓ Removed product_sku column from order_items');
    } else {
      console.log('• product_sku column does not exist on order_items');
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
