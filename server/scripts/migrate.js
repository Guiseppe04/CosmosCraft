require('dotenv').config();
const { pool } = require('../config/database');

async function runMigration() {
  let client;
  try {
    console.log('Starting migration...');
    client = await pool.connect();

    // Add new columns
    try {
      await client.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS product_sku VARCHAR(50);
      `);
      console.log('✓ Added product_sku column');
    } catch (e) {
      console.log('ℹ product_sku column already exists or error:', e.message);
    }

    try {
      await client.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);
      `);
      console.log('✓ Added product_name column');
    } catch (e) {
      console.log('ℹ product_name column already exists or error:', e.message);
    }

    // Drop old constraint
    try {
      await client.query(`
        ALTER TABLE order_items
        DROP CONSTRAINT IF EXISTS order_items_check;
      `);
      console.log('✓ Dropped old constraint');
    } catch (e) {
      console.log('ℹ Constraint drop error:', e.message);
    }

    // Add new constraint
    try {
      await client.query(`
        ALTER TABLE order_items
        ADD CONSTRAINT order_items_check 
        CHECK ((product_id IS NOT NULL) OR (customization_id IS NOT NULL) OR (product_sku IS NOT NULL));
      `);
      console.log('✓ Added new constraint allowing product_sku');
    } catch (e) {
      console.log('ℹ Constraint add error:', e.message);
    }

    // Create index
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_order_items_product_sku ON order_items(product_sku);
      `);
      console.log('✓ Created index on product_sku');
    } catch (e) {
      console.log('ℹ Index create error:', e.message);
    }

    console.log('\n✅ Migration completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration();
