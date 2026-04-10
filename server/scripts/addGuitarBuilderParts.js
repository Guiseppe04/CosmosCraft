require('dotenv').config();
const { pool } = require('../config/database');

async function runMigration() {
  let client;
  try {
    console.log('Starting migration to add guitar_builder_parts...');
    client = await pool.connect();

    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS guitar_builder_parts (
          part_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(150) NOT NULL,
          description TEXT,
          type_mapping VARCHAR(100) NOT NULL,
          price NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
          stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
          image_url TEXT,
          metadata JSONB,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    console.log('✓ Created guitar_builder_parts table');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_guitar_builder_parts_type ON guitar_builder_parts(type_mapping);
    `);
    console.log('✓ Created index on type_mapping');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_guitar_builder_parts_active ON guitar_builder_parts(is_active);
    `);
    console.log('✓ Created index on is_active');

    console.log('\n✅ Migration completed successfully!');
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
