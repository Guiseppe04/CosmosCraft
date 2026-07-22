require('dotenv').config();
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check and add custom_build_id column
    const checkRes = await client.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'projects' AND column_name = 'custom_build_id'`
    );

    if (checkRes.rows.length === 0) {
      await client.query(
        `ALTER TABLE projects ADD COLUMN custom_build_id VARCHAR(20) UNIQUE`
      );
      console.log('✓ Added custom_build_id column');
    } else {
      console.log('• custom_build_id column already exists');
    }

    // Generate IDs for existing projects that don't have one
    const projects = await client.query(
      `SELECT project_id, created_at FROM projects 
       WHERE custom_build_id IS NULL AND deleted_at IS NULL 
       ORDER BY created_at ASC`
    );
    console.log(`Found ${projects.rows.length} projects needing custom_build_id`);

    for (let i = 0; i < projects.rows.length; i++) {
      const p = projects.rows[i];
      const d = new Date(p.created_at);
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const seq = String(i + 1).padStart(4, '0');
      const cid = `CMB-${yy}${mm}${dd}-${seq}`;

      await client.query(
        `UPDATE projects SET custom_build_id = $1 WHERE project_id = $2`,
        [cid, p.project_id]
      );
      console.log(`  Set ${cid} for project ${p.project_id}`);
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