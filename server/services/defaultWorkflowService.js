const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

let defaultWorkflowReady = false;
let defaultWorkflowPromise = null;



/**
 * Get the complete default workflow with steps and tasks.
 * Returns an array of steps, each with a `tasks` array.
 */
exports.getDefaultWorkflow = async () => {
  await ensureDefaultWorkflowTables();
  const stepsResult = await pool.query(
    'SELECT * FROM default_workflow_steps ORDER BY sort_order ASC, created_at ASC'
  );
  const steps = stepsResult.rows;

  if (steps.length === 0) return [];

  const stepIds = steps.map((s) => s.step_id);
  const tasksResult = await pool.query(
    `SELECT * FROM default_workflow_tasks
     WHERE step_id = ANY($1::uuid[])
     ORDER BY sort_order ASC, created_at ASC`,
    [stepIds]
  );

  const taskMap = {};
  for (const task of tasksResult.rows) {
    if (!taskMap[task.step_id]) taskMap[task.step_id] = [];
    taskMap[task.step_id].push(task);
  }

  return steps.map((step) => ({
    ...step,
    tasks: taskMap[step.step_id] || [],
  }));
};

/**
 * Validate and save (overwrite) the default workflow.
 * This is a bulk replace: clears all existing steps+tasks, then inserts new ones.
 */
exports.saveDefaultWorkflow = async (steps) => {
  await ensureDefaultWorkflowTables();
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new AppError('At least one step is required', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate all data first
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step.step_name || !String(step.step_name).trim()) {
        throw new AppError(`Step ${i + 1}: Step name is required`, 400);
      }
      if (step.sort_order !== undefined && (Number(step.sort_order) < 0 || !Number.isFinite(Number(step.sort_order)))) {
        throw new AppError(`Step "${step.step_name}": Invalid sort order`, 400);
      }

      const tasks = step.tasks || [];
      for (let j = 0; j < tasks.length; j++) {
        const task = tasks[j];
        if (!task.task_name || !String(task.task_name).trim()) {
          throw new AppError(`Step "${step.step_name}", Task ${j + 1}: Task name is required`, 400);
        }
        if (task.sort_order !== undefined && (Number(task.sort_order) < 0 || !Number.isFinite(Number(task.sort_order)))) {
          throw new AppError(`Step "${step.step_name}", Task "${task.task_name}": Invalid sort order`, 400);
        }
      }
    }

    // Clear existing data (CASCADE will handle tasks)
    await client.query('DELETE FROM default_workflow_tasks');
    await client.query('DELETE FROM default_workflow_steps');

    // Insert steps and tasks
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const sortOrder = step.sort_order !== undefined ? step.sort_order : i + 1;

      const stepRes = await client.query(
        `INSERT INTO default_workflow_steps (step_name, sort_order)
         VALUES ($1, $2) RETURNING step_id`,
        [String(step.step_name).trim(), sortOrder]
      );
      const stepId = stepRes.rows[0].step_id;

      const tasks = step.tasks || [];
      for (let j = 0; j < tasks.length; j++) {
        const task = tasks[j];
        const taskSortOrder = task.sort_order !== undefined ? task.sort_order : j + 1;

        await client.query(
          `INSERT INTO default_workflow_tasks (step_id, task_name, sort_order)
           VALUES ($1, $2, $3)`,
          [stepId, String(task.task_name).trim(), taskSortOrder]
        );
      }
    }

    await client.query('COMMIT');

    // Return the saved workflow
    return await exports.getDefaultWorkflow();
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Apply the default workflow to a specific project, creating milestones and subtasks.
 * Only runs if no milestones exist yet for the project.
 */
exports.applyDefaultWorkflowToProject = async (projectId, userId) => {
  await ensureDefaultWorkflowTables();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if milestones already exist for this project
    const existing = await client.query(
      'SELECT COUNT(*) FROM project_milestones WHERE project_id = $1',
      [projectId]
    );
    if (parseInt(existing.rows[0].count) > 0) {
      await client.query('COMMIT');
      return { applied: false, message: 'Project already has milestones' };
    }

    // Get the default workflow
    const stepsResult = await client.query(
      'SELECT * FROM default_workflow_steps ORDER BY sort_order ASC, created_at ASC'
    );
    const steps = stepsResult.rows;

    if (steps.length === 0) {
      await client.query('COMMIT');
      return { applied: false, message: 'No default workflow defined' };
    }

    const stepIds = steps.map((s) => s.step_id);
    const tasksResult = await client.query(
      `SELECT * FROM default_workflow_tasks
       WHERE step_id = ANY($1::uuid[])
       ORDER BY sort_order ASC, created_at ASC`,
      [stepIds]
    );

    const taskMap = {};
    for (const task of tasksResult.rows) {
      if (!taskMap[task.step_id]) taskMap[task.step_id] = [];
      taskMap[task.step_id].push(task);
    }

    // Create milestones and subtasks for each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const mRes = await client.query(
        `INSERT INTO project_milestones (project_id, title, order_index, status)
         VALUES ($1, $2, $3, 'pending') RETURNING milestone_id`,
        [projectId, step.step_name, step.sort_order]
      );
      const milestoneId = mRes.rows[0].milestone_id;

      const tasks = taskMap[step.step_id] || [];
      for (const task of tasks) {
        await client.query(
          `INSERT INTO project_subtasks (milestone_id, title, status)
           VALUES ($1, $2, 'pending')`,
          [milestoneId, task.task_name]
        );
      }
    }

    // Log the activity
    await client.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        'UPDATE',
        'project',
        projectId,
        JSON.stringify({ message: 'Default workflow applied to project' }),
      ]
    );

    await client.query('COMMIT');
    return { applied: true, message: 'Default workflow applied successfully' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};