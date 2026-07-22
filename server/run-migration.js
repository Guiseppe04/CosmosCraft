require('dotenv').config();
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if columns already exist
    const checkRes = await client.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'projects'
         AND table_schema = current_schema()
         AND column_name IN ('claimed_by', 'claimed_at')`
    );
    
    const existing = new Set(checkRes.rows.map((row) => row.column_name));
    
    if (!existing.has('claimed_by')) {
      await client.query(
        `ALTER TABLE projects ADD COLUMN claimed_by UUID REFERENCES users(user_id) ON DELETE SET NULL`
      );
      console.log('✓ Added claimed_by column');
    } else {
      console.log('• claimed_by column already exists');
    }
    
    if (!existing.has('claimed_at')) {
      await client.query(
        `ALTER TABLE projects ADD COLUMN claimed_at TIMESTAMPTZ`
      );
      console.log('✓ Added claimed_at column');
    } else {
      console.log('• claimed_at column already exists');
    }
    
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_projects_claimed_by ON projects(claimed_by)`
    );
    console.log('✓ Index created');
    
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