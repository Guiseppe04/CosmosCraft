require('dotenv').config();
const { pool } = require('./config/database');

async function alter() {
  try {
    // We drop the foreign key via CASCADE if it exists, along with the column.
    console.log('Restructuring appointments table...');
    
    await pool.query(`
      ALTER TABLE appointments 
      DROP COLUMN IF EXISTS service_id CASCADE;
    `);

    await pool.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]'::jsonb;
    `);

    await pool.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS location_id VARCHAR(50);
    `);

    await pool.query(`
      ALTER TABLE appointments 
      ADD COLUMN IF NOT EXISTS guitar_details JSONB;
    `);

    console.log('Successfully altered appointments table!');
  } catch (err) {
    console.error('Error altering table:', err);
  } finally {
    if(pool && pool.end) await pool.end();
    setTimeout(()=>process.exit(0), 1000);
  }
}

alter();
