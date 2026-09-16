require('dotenv').config();
const { pool } = require('./config/database');

async function runMigration() {
  try {
    // Drop the old CHECK constraint on audit_logs action column
    await pool.query(
      `ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check`
    );
    console.log('✓ Dropped old audit_logs action check constraint');

    // Add new constraint with all project-related actions included
    await pool.query(
      `ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (
        action IN (
          'INSERT', 'UPDATE', 'DELETE', 'VERIFY', 'REJECT', 'REFUND',
          'LOGIN_ATTEMPT', 'PASSWORD_RESET', 'STOCK_ALERT',
          'project_claimed', 'project_unclaimed', 'project_reassigned',
          'project_cancelled', 'milestone_created', 'milestone_updated',
          'milestone_deleted', 'subtask_created', 'subtask_status_changed',
          'subtask_deleted', 'fulfillment_updated', 'workflow_initialized'
        )
      )`
    );
    console.log('✓ Added new audit_logs action check constraint with project actions');
    
    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runMigration();