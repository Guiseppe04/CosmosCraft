const { pool } = require('../config/database');

const createProjectTasksTables = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create milestones table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_milestones (
        milestone_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        order_index INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create subtasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_subtasks (
        subtask_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        milestone_id UUID REFERENCES project_milestones(milestone_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        is_customer_updatable BOOLEAN DEFAULT FALSE,
        assigned_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pending', -- pending, completed
        completed_at TIMESTAMP WITH TIME ZONE,
        completed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_activity_logs (
        log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID REFERENCES projects(project_id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
        action_type VARCHAR(100) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query('COMMIT');
    console.log('Project tracking tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating project tracking tables:', error);
  } finally {
    client.release();
    process.exit();
  }
};

createProjectTasksTables();
