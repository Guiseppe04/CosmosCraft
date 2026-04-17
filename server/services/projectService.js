const { pool } = require('../config/database');

const normalizeProjectStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_')

  if (normalized === 'completed') return 'completed'
  if (normalized === 'in_progress') return 'in_progress'
  if (normalized === 'not_started' || normalized === 'pending') return 'not_started'

  return null
}

const PROJECT_BASE_SELECT = `
  SELECT
    p.*,
    p.title AS name,
    p.notes AS description,
    o.user_id AS customer_id,
    o.order_number,
    CONCAT(
      COALESCE(u.first_name, ''),
      CASE
        WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> '' THEN ' '
        ELSE ''
      END,
      COALESCE(u.last_name, '')
    ) AS customer_name
  FROM projects p
  JOIN orders o ON o.order_id = p.order_id
  LEFT JOIN users u ON u.user_id = o.user_id
`

const getProjectTaskStats = async (db, projectId) => {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(CASE WHEN ps.status = 'completed' THEN 1 END)::int AS completed
     FROM project_subtasks ps
     JOIN project_milestones pm ON ps.milestone_id = pm.milestone_id
     WHERE pm.project_id = $1`,
    [projectId]
  );

  return {
    total: result.rows[0]?.total || 0,
    completed: result.rows[0]?.completed || 0,
  };
};

const buildProjectTaskTracking = ({ total, completed }, currentStatus) => {
  const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
  const normalizedCurrentStatus = normalizeProjectStatus(currentStatus);

  let status = normalizedCurrentStatus || 'not_started';
  if (total > 0) {
    if (completed === total) status = 'completed';
    else if (completed > 0) status = 'in_progress';
    else status = 'not_started';
  }

  return {
    progress,
    status,
    task_summary: {
      total,
      completed,
      pending: Math.max(total - completed, 0),
    },
  };
};

const applyProjectTaskTracking = async (db, project, { stats = null, persist = false } = {}) => {
  const resolvedStats = stats || await getProjectTaskStats(db, project.project_id);
  const tracking = buildProjectTaskTracking(resolvedStats, project.status);

  if (persist) {
    const currentProgress = Number.isFinite(Number(project.progress)) ? Number(project.progress) : 0;
    if (currentProgress !== tracking.progress || project.status !== tracking.status) {
      await db.query(
        `UPDATE projects
         SET progress = $1,
             status = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $3`,
        [tracking.progress, tracking.status, project.project_id]
      );
    }
  }

  return {
    ...project,
    ...tracking,
  };
};

exports.getProjects = async () => {
  const result = await pool.query(`${PROJECT_BASE_SELECT} ORDER BY p.created_at DESC`);

  return Promise.all(
    result.rows.map((project) => applyProjectTaskTracking(pool, project, { persist: true }))
  );
};

exports.getProjectById = async (projectId) => {
  const result = await pool.query(
    `${PROJECT_BASE_SELECT} WHERE p.project_id = $1`,
    [projectId]
  );
  if (result.rows.length === 0) return null;
  return applyProjectTaskTracking(pool, result.rows[0], { persist: true });
};

exports.getMyProjects = async (userId) => {
  const result = await pool.query(
    `${PROJECT_BASE_SELECT}
     WHERE o.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  for (let p of result.rows) {
    const stats = await getProjectTaskStats(pool, p.project_id);
    const customizationsRes = await pool.query(
      `SELECT DISTINCT customization_id
       FROM order_items
      WHERE order_id = $1
         AND customization_id IS NOT NULL`,
      [p.order_id]
    );
    const tracking = await applyProjectTaskTracking(pool, p, { stats, persist: true });
    p.customization_ids = customizationsRes.rows.map(row => row.customization_id);
    p.primary_customization_id = p.customization_ids[0] || null;
    p.progress = tracking.progress;
    p.status = tracking.status;
    p.task_summary = tracking.task_summary;
  }
  return result.rows;
};

exports.createProject = async (projectData) => {
  const { order_id, orderId, title, name, status, description, notes, estimated_completion_date } = projectData;
  const projectOrderId = order_id || orderId
  const projectTitle = title || name
  const normalizedStatus = normalizeProjectStatus(status) || 'not_started'

  const result = await pool.query(
    `INSERT INTO projects (order_id, title, status, notes, estimated_completion_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [projectOrderId, projectTitle, normalizedStatus, notes ?? description ?? null, estimated_completion_date || null]
  );
  return { ...result.rows[0], name: result.rows[0].title, description: result.rows[0].notes };
};

exports.updateProject = async (projectId, projectData) => {
  const { title, name, status, description, notes, estimated_completion_date } = projectData;
  const normalizedStatus = normalizeProjectStatus(status)

  const result = await pool.query(
    `UPDATE projects 
     SET title = COALESCE($1, title),
         status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         estimated_completion_date = COALESCE($4, estimated_completion_date),
         updated_at = CURRENT_TIMESTAMP
     WHERE project_id = $5 RETURNING *`,
    [title || name, normalizedStatus, notes ?? description, estimated_completion_date || null, projectId]
  );
  if (result.rows.length === 0) return null;
  return { ...result.rows[0], name: result.rows[0].title, description: result.rows[0].notes };
};

exports.deleteProject = async (projectId) => {
  const result = await pool.query('DELETE FROM projects WHERE project_id = $1 RETURNING *', [projectId]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
};

exports.assignTeam = async (projectId, userIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM project_team_members WHERE project_id = $1', [projectId]);
    
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        await client.query(
          'INSERT INTO project_team_members (project_id, user_id) VALUES ($1, $2)',
          [projectId, userId]
        );
      }
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ─── PROJECT TRACKING & TASKS ───────────────────────────────────────────────

const logActivity = async (client, projectId, userId, actionType, details) => {
  await client.query(
    'INSERT INTO project_activity_logs (project_id, user_id, action_type, details) VALUES ($1, $2, $3, $4)',
    [projectId, userId, actionType, JSON.stringify(details)]
  );
};

exports.getProjectHierarchy = async (projectId) => {
  const client = await pool.connect();
  try {
    const pResult = await client.query(
      `${PROJECT_BASE_SELECT} WHERE p.project_id = $1`,
      [projectId]
    );
    if (pResult.rows.length === 0) return null;
    const project = pResult.rows[0];

    // Fetch team members
    const teamResult = await client.query(`
      SELECT ptm.user_id, u.first_name, u.last_name, u.email, u.role
      FROM project_team_members ptm
      JOIN users u ON ptm.user_id = u.user_id
      WHERE ptm.project_id = $1
    `, [projectId]);
    project.team = teamResult.rows;

    const customizationResult = await client.query(
      `SELECT DISTINCT
         c.customization_id,
         c.created_at,
         c.name,
         c.guitar_type,
         c.body_wood,
         c.neck_wood,
         c.fingerboard_wood,
         c.bridge_type,
         c.pickups,
         c.color,
         c.finish_type
       FROM order_items oi
       JOIN customizations c ON c.customization_id = oi.customization_id
       WHERE oi.order_id = $1
      ORDER BY c.created_at ASC`,
      [project.order_id]
    );

    const customizationIds = customizationResult.rows.map((row) => row.customization_id);
    let linkedParts = [];

    if (customizationIds.length > 0) {
      const linkedPartsResult = await client.query(
        `SELECT
           cp.part_id::text AS part_id,
           cp.customization_id,
           cp.part_name AS name,
           cp.quantity,
           cp.price,
           c.guitar_type,
           pi.image_url,
           'additional_parts' AS part_category,
           p.is_active,
           i.stock
         FROM customization_parts cp
         JOIN customizations c ON c.customization_id = cp.customization_id
         LEFT JOIN products p ON p.product_id = cp.product_id
         LEFT JOIN inventory i ON i.product_id = cp.product_id
         LEFT JOIN product_images pi
           ON pi.product_id = cp.product_id
          AND pi.is_primary = true
         WHERE cp.customization_id = ANY($1::uuid[])
         ORDER BY cp.created_at ASC`,
        [customizationIds]
      );

      linkedParts = linkedPartsResult.rows;
    }

    const specFields = [
      ['name', 'model'],
      ['body_wood', 'body'],
      ['neck_wood', 'neck'],
      ['fingerboard_wood', 'fretboard'],
      ['bridge_type', 'bridge'],
      ['pickups', 'pickups'],
      ['color', 'finish'],
      ['finish_type', 'finish'],
    ];

    const configuredParts = customizationResult.rows.flatMap((customization) =>
      specFields.flatMap(([field, category]) => {
        const value = customization[field];
        if (!value) return [];

        return [{
          part_id: `${customization.customization_id}:${field}`,
          customization_id: customization.customization_id,
          name: value,
          guitar_type: customization.guitar_type,
          part_category: category,
          stock: null,
          is_active: true,
          source: 'configuration',
        }];
      })
    );

    project.customization_ids = customizationIds;
    project.parts = [...configuredParts, ...linkedParts];

    // Fetch milestones
    const mResult = await client.query('SELECT * FROM project_milestones WHERE project_id = $1 ORDER BY order_index ASC, created_at ASC', [projectId]);
    const milestones = mResult.rows;

    // Fetch subtasks
    const sResult = await client.query(`
      SELECT s.*, u.first_name as assignee_first, u.last_name as assignee_last
      FROM project_subtasks s
      LEFT JOIN users u ON s.assigned_user_id = u.user_id
      JOIN project_milestones m ON s.milestone_id = m.milestone_id
      WHERE m.project_id = $1
      ORDER BY s.created_at ASC
    `, [projectId]);
    
    let totalSubtasks = 0;
    let completedSubtasks = 0;

    // Group subtasks into milestones
    const milestoneMap = milestones.reduce((acc, m) => {
      m.subtasks = [];
      acc[m.milestone_id] = m;
      return acc;
    }, {});

    sResult.rows.forEach(s => {
      if (milestoneMap[s.milestone_id]) {
        milestoneMap[s.milestone_id].subtasks.push(s);
        totalSubtasks++;
        if (s.status === 'completed') completedSubtasks++;
      }
    });

    project.milestones = Object.values(milestoneMap);

    return applyProjectTaskTracking(
      client,
      project,
      {
        stats: { total: totalSubtasks, completed: completedSubtasks },
        persist: true,
      }
    );
  } finally {
    client.release();
  }
};

exports.addMilestone = async (projectId, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, order_index } = data;
    const res = await client.query(
      'INSERT INTO project_milestones (project_id, title, description, order_index) VALUES ($1, $2, $3, $4) RETURNING *',
      [projectId, title, description, order_index || 0]
    );
    await logActivity(client, projectId, userId, 'milestone_created', { title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateMilestone = async (milestoneId, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { title, description, order_index, status } = data;
    const res = await client.query(
      `UPDATE project_milestones 
       SET title = COALESCE($1, title), description = COALESCE($2, description), 
           order_index = COALESCE($3, order_index), status = COALESCE($4, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE milestone_id = $5 RETURNING *`,
      [title, description, order_index, status, milestoneId]
    );
    if (res.rows.length === 0) throw new Error('Milestone not found');
    await logActivity(client, res.rows[0].project_id, userId, 'milestone_updated', { title: res.rows[0].title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteMilestone = async (milestoneId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query('DELETE FROM project_milestones WHERE milestone_id = $1 RETURNING *', [milestoneId]);
    if (res.rows.length === 0) throw new Error('Milestone not found');
    await logActivity(client, res.rows[0].project_id, userId, 'milestone_deleted', { title: res.rows[0].title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.addSubtask = async (milestoneId, data, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mRes = await client.query('SELECT project_id FROM project_milestones WHERE milestone_id = $1', [milestoneId]);
    if (mRes.rows.length === 0) throw new Error('Milestone not found');
    const projectId = mRes.rows[0].project_id;

    const { title, is_customer_updatable, assigned_user_id } = data;
    const res = await client.query(
      'INSERT INTO project_subtasks (milestone_id, title, is_customer_updatable, assigned_user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [milestoneId, title, is_customer_updatable || false, assigned_user_id || null]
    );

    // If milestone was completed, revert to in_progress because a new pending subtask was added
    await client.query("UPDATE project_milestones SET status = 'in_progress' WHERE milestone_id = $1 AND status = 'completed'", [milestoneId]);

    await logActivity(client, projectId, userId, 'subtask_created', { title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateSubtaskStatus = async (subtaskId, data, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sRes = await client.query(`
      SELECT s.*, m.project_id FROM project_subtasks s
      JOIN project_milestones m ON s.milestone_id = m.milestone_id
      WHERE s.subtask_id = $1
    `, [subtaskId]);
    
    if (sRes.rows.length === 0) throw new Error('Subtask not found');
    const subtask = sRes.rows[0];

    // Authorization check
    if (!['super_admin', 'admin', 'staff'].includes(userRole)) {
      if (!subtask.is_customer_updatable) {
        throw new Error('Not authorized to update this subtask');
      }
    }

    const { status, title, assigned_user_id, is_customer_updatable } = data;
    let completedAt = subtask.completed_at;
    let completedBy = subtask.completed_by;

    if (status === 'completed' && subtask.status !== 'completed') {
      completedAt = new Date();
      completedBy = userId;
    } else if (status === 'pending' || status === 'in_progress') {
      completedAt = null;
      completedBy = null;
    }

    const updatedRes = await client.query(
      `UPDATE project_subtasks 
       SET status = COALESCE($1, status),
           title = COALESCE($2, title),
           assigned_user_id = COALESCE($3, assigned_user_id),
           is_customer_updatable = COALESCE($4, is_customer_updatable),
           completed_at = $5,
           completed_by = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE subtask_id = $7 RETURNING *`,
      [status || subtask.status, title, assigned_user_id, is_customer_updatable, completedAt, completedBy, subtaskId]
    );

    const mId = subtask.milestone_id;
    // Auto-complete milestone logic
    const pendingCount = await client.query(`SELECT COUNT(*) FROM project_subtasks WHERE milestone_id = $1 AND status != 'completed'`, [mId]);
    if (parseInt(pendingCount.rows[0].count) === 0) {
      await client.query(`UPDATE project_milestones SET status = 'completed' WHERE milestone_id = $1`, [mId]);
    } else {
      await client.query(`UPDATE project_milestones SET status = 'in_progress' WHERE milestone_id = $1`, [mId]);
    }

    if (status && status !== subtask.status) {
      await logActivity(client, subtask.project_id, userId, 'subtask_status_changed', { title: subtask.title, status });
    }

    await client.query('COMMIT');
    return updatedRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deleteSubtask = async (subtaskId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`
      DELETE FROM project_subtasks 
      WHERE subtask_id = $1 
      RETURNING *, (SELECT project_id FROM project_milestones WHERE milestone_id = project_subtasks.milestone_id) as project_id
    `, [subtaskId]);
    
    if (res.rows.length === 0) throw new Error('Subtask not found');
    await logActivity(client, res.rows[0].project_id, userId, 'subtask_deleted', { title: res.rows[0].title });
    await client.query('COMMIT');
    return res.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getActivityLogs = async (projectId) => {
  const res = await pool.query(`
    SELECT l.*, u.first_name, u.last_name, u.email, u.role
    FROM project_activity_logs l
    LEFT JOIN users u ON l.user_id = u.user_id
    WHERE l.project_id = $1
    ORDER BY l.created_at DESC
  `, [projectId]);
  return res.rows;
};
