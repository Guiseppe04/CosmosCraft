/**
 * MIGRATION SCRIPT: Migrate product inventory data to new inventory table
 * 
 * This script handles the migration from products table inventory fields to a separate inventory table.
 * 
 * Run: node migrateToinventory.js
 */

const { pool } = require('../config/database');

async function migrateProductsToInventory() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting inventory migration...');
    
    await client.query('BEGIN');

    // 1. Create inventory records for all existing products
    console.log('📝 Creating inventory records from existing products...');
    
    const migrateRes = await client.query(`
      INSERT INTO inventory (product_id, cost_price, stock, low_stock_threshold, created_at, updated_at)
      SELECT 
        product_id,
        cost,
        stock,
        low_stock_threshold,
        now(),
        now()
      FROM products p
      WHERE NOT EXISTS (
        SELECT 1 FROM inventory i WHERE i.product_id = p.product_id
      )
      RETURNING product_id
    `);

    console.log(`✅ Created ${migrateRes.rows.length} inventory records`);

    // 2. Verify migration
    const inventoryCount = await client.query('SELECT COUNT(*) as count FROM inventory');
    const productsCount = await client.query('SELECT COUNT(*) as count FROM products');
    
    console.log(`\n📊 Migration Statistics:`);
    console.log(`   - Total products: ${productsCount.rows[0].count}`);
    console.log(`   - Total inventory records: ${inventoryCount.rows[0].count}`);

    // 3. Check for any products without inventory
    const orphaned = await client.query(`
      SELECT COUNT(*) as count FROM products p
      WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.product_id)
    `);
    
    if (orphaned.rows[0].count > 0) {
      console.warn(`⚠️  Found ${orphaned.rows[0].count} products without inventory records`);
    }

    await client.query('COMMIT');
    console.log(`\n✨ Migration completed successfully!`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
migrateProductsToInventory();
