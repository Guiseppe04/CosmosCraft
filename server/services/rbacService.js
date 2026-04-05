const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const permissionCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

async function clearCache(userId) {
  permissionCache.delete(`user_${userId}`);
  permissionCache.delete(`roles_${userId}`);
}

async function getAllRoles() {
  const result = await pool.query(
    `SELECT r.*, 
      (SELECT COUNT(*) FROM user_roles WHERE role_id = r.role_id) as user_count
     FROM roles r
     ORDER BY r.level DESC, r.name ASC`
  );
  return result.rows;
}

async function getRoleById(roleId) {
  const result = await pool.query(
    `SELECT r.*, 
      parent.name as parent_role_name
     FROM roles r
     LEFT JOIN roles parent ON r.parent_role_id = parent.role_id
     WHERE r.role_id = $1`,
    [roleId]
  );
  return result.rows[0] || null;
}

async function getRoleByName(name) {
  const result = await pool.query(
    'SELECT * FROM roles WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  return result.rows[0] || null;
}

async function createRole({ name, description, level, parent_role_id }) {
  const existing = await getRoleByName(name);
  if (existing) {
    throw new AppError('Role name already exists', 400);
  }

  if (parent_role_id) {
    const parent = await getRoleById(parent_role_id);
    if (!parent) {
      throw new AppError('Parent role not found', 404);
    }
  }

  const result = await pool.query(
    `INSERT INTO roles (name, description, level, parent_role_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, description || null, level ?? 0, parent_role_id || null]
  );
  return result.rows[0];
}

async function updateRole(roleId, { name, description, level, parent_role_id, is_system }) {
  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  if (role.is_system) {
    throw new AppError('Cannot modify system role', 403);
  }

  if (name && name !== role.name) {
    const existing = await getRoleByName(name);
    if (existing) {
      throw new AppError('Role name already exists', 400);
    }
  }

  if (parent_role_id !== undefined) {
    if (parent_role_id === roleId) {
      throw new AppError('Role cannot be its own parent', 400);
    }
    if (parent_role_id) {
      const parent = await getRoleById(parent_role_id);
      if (!parent) {
        throw new AppError('Parent role not found', 404);
      }
    }
  }

  const result = await pool.query(
    `UPDATE roles SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        level = COALESCE($3, level),
        parent_role_id = $4,
        updated_at = now()
     WHERE role_id = $5
     RETURNING *`,
    [name, description, level, parent_role_id !== undefined ? parent_role_id : null, roleId]
  );
  return result.rows[0];
}

async function deleteRole(roleId) {
  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  if (role.is_system) {
    throw new AppError('Cannot delete system role', 403);
  }

  const userCount = await pool.query(
    'SELECT COUNT(*) as count FROM user_roles WHERE role_id = $1',
    [roleId]
  );

  if (parseInt(userCount.rows[0].count) > 0) {
    throw new AppError('Cannot delete role with assigned users. Remove users first.', 400);
  }

  const childRoles = await pool.query(
    'SELECT COUNT(*) as count FROM roles WHERE parent_role_id = $1',
    [roleId]
  );

  if (parseInt(childRoles.rows[0].count) > 0) {
    throw new AppError('Cannot delete role with child roles. Reassign children first.', 400);
  }

  await pool.query('DELETE FROM roles WHERE role_id = $1', [roleId]);
  return { message: 'Role deleted successfully' };
}

async function getAllPermissions() {
  const result = await pool.query(
    `SELECT p.*, 
      (SELECT COUNT(*) FROM role_permissions WHERE permission_id = p.permission_id) as role_count
     FROM permissions p
     ORDER BY p.category ASC, p.name ASC`
  );
  return result.rows;
}

async function getPermissionById(permissionId) {
  const result = await pool.query(
    'SELECT * FROM permissions WHERE permission_id = $1',
    [permissionId]
  );
  return result.rows[0] || null;
}

async function getPermissionByName(name) {
  const result = await pool.query(
    'SELECT * FROM permissions WHERE LOWER(name) = LOWER($1)',
    [name]
  );
  return result.rows[0] || null;
}

async function createPermission({ name, description, category }) {
  const existing = await getPermissionByName(name);
  if (existing) {
    throw new AppError('Permission name already exists', 400);
  }

  const result = await pool.query(
    `INSERT INTO permissions (name, description, category)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [name, description || null, category || null]
  );
  return result.rows[0];
}

async function updatePermission(permissionId, { name, description, category }) {
  const permission = await getPermissionById(permissionId);
  if (!permission) {
    throw new AppError('Permission not found', 404);
  }

  if (name && name !== permission.name) {
    const existing = await getPermissionByName(name);
    if (existing) {
      throw new AppError('Permission name already exists', 400);
    }
  }

  const result = await pool.query(
    `UPDATE permissions SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        category = COALESCE($3, category)
     WHERE permission_id = $4
     RETURNING *`,
    [name, description, category, permissionId]
  );
  return result.rows[0];
}

async function deletePermission(permissionId) {
  const permission = await getPermissionById(permissionId);
  if (!permission) {
    throw new AppError('Permission not found', 404);
  }

  await pool.query('DELETE FROM permissions WHERE permission_id = $1', [permissionId]);
  return { message: 'Permission deleted successfully' };
}

async function assignPermissionToRole(roleId, permissionId) {
  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const permission = await getPermissionById(permissionId);
  if (!permission) {
    throw new AppError('Permission not found', 404);
  }

  const existing = await pool.query(
    'SELECT * FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
    [roleId, permissionId]
  );

  if (existing.rows.length > 0) {
    throw new AppError('Permission already assigned to role', 400);
  }

  await pool.query(
    'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
    [roleId, permissionId]
  );

  return { message: 'Permission assigned to role' };
}

async function removePermissionFromRole(roleId, permissionId) {
  const result = await pool.query(
    'DELETE FROM role_permissions WHERE role_id = $1 AND permission_id = $2 RETURNING *',
    [roleId, permissionId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Permission not assigned to role', 404);
  }

  return { message: 'Permission removed from role' };
}

async function getRolePermissions(roleId) {
  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const result = await pool.query(
    `SELECT p.* FROM permissions p
     JOIN role_permissions rp ON p.permission_id = rp.permission_id
     WHERE rp.role_id = $1
     ORDER BY p.category ASC, p.name ASC`,
    [roleId]
  );

  return result.rows;
}

async function setRolePermissions(roleId, permissionIds) {
  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    for (const permissionId of permissionIds) {
      const permission = await client.query(
        'SELECT permission_id FROM permissions WHERE permission_id = $1',
        [permissionId]
      );

      if (permission.rows.length > 0) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [roleId, permissionId]
        );
      }
    }

    await client.query('COMMIT');
    return { message: 'Role permissions updated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getUserRoles(userId, includeInactive = false) {
  let query = `
    SELECT r.*, ur.is_active, ur.assigned_at, ur.expires_at,
      CONCAT(u.first_name, ' ', COALESCE(u.middle_name, ''), ' ', u.last_name) as assigned_by_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.role_id
    LEFT JOIN users u ON ur.assigned_by = u.user_id
    WHERE ur.user_id = $1
  `;

  if (!includeInactive) {
    query += ` AND (ur.is_active = true OR ur.expires_at > now())`;
  }

  query += ` ORDER BY r.level DESC, r.name ASC`;

  const result = await pool.query(query, [userId]);
  return result.rows;
}

async function getUserPermissions(userId, useCache = true) {
  if (useCache) {
    const cached = permissionCache.get(`user_${userId}`);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.permissions;
    }
  }

  const result = await pool.query(
    `SELECT DISTINCT p.* 
     FROM permissions p
     JOIN role_permissions rp ON p.permission_id = rp.permission_id
     JOIN user_roles ur ON rp.role_id = ur.role_id
     WHERE ur.user_id = $1 AND (ur.is_active = true OR ur.expires_at > now())
     ORDER BY p.category ASC, p.name ASC`,
    [userId]
  );

  const permissions = result.rows.map(r => r.name);

  if (useCache) {
    permissionCache.set(`user_${userId}`, {
      permissions,
      timestamp: Date.now()
    });
  }

  return permissions;
}

async function checkUserPermission(userId, permission) {
  const permissions = await getUserPermissions(userId, true);
  return permissions.includes(permission);
}

async function assignRoleToUser(userId, roleId, assignedBy, expiresAt = null) {
  const userResult = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const existing = await pool.query(
    'SELECT * FROM user_roles WHERE user_id = $1 AND role_id = $2',
    [userId, roleId]
  );

  if (existing.rows.length > 0) {
    throw new AppError('User already has this role', 400);
  }

  const result = await pool.query(
    `INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, roleId, assignedBy, expiresAt]
  );

  await clearCache(userId);
  return result.rows[0];
}

async function removeRoleFromUser(userId, roleId) {
  const result = await pool.query(
    'DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2 RETURNING *',
    [userId, roleId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User does not have this role', 404);
  }

  await clearCache(userId);
  return { message: 'Role removed from user' };
}

async function setUserRoles(userId, roleIds, assignedBy) {
  const userResult = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [userId]);
  if (userResult.rows.length === 0) {
    throw new AppError('User not found', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);

    for (const roleId of roleIds) {
      const role = await client.query(
        'SELECT role_id FROM roles WHERE role_id = $1',
        [roleId]
      );

      if (role.rows.length > 0) {
        await client.query(
          'INSERT INTO user_roles (user_id, role_id, assigned_by) VALUES ($1, $2, $3)',
          [userId, roleId, assignedBy]
        );
      }
    }

    await client.query('COMMIT');
    await clearCache(userId);
    return { message: 'User roles updated' };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getRoleHierarchy(roleId) {
  const role = await getRoleById(roleId);
  if (!role) {
    throw new AppError('Role not found', 404);
  }

  const result = await pool.query(
    `WITH RECURSIVE role_tree AS (
      SELECT role_id, name, parent_role_id, level, 0 as depth
      FROM roles WHERE role_id = $1
      UNION ALL
      SELECT r.role_id, r.name, r.parent_role_id, r.level, rt.depth + 1
      FROM roles r
      JOIN role_tree rt ON r.parent_role_id = rt.role_id
    )
    SELECT * FROM role_tree ORDER BY depth ASC`,
    [roleId]
  );

  return result.rows;
}

async function getPermissionsByCategory() {
  const result = await pool.query(
    `SELECT category, array_agg(name) as permissions
     FROM permissions
     WHERE category IS NOT NULL
     GROUP BY category
     ORDER BY category ASC`
  );

  return result.rows.reduce((acc, row) => {
    acc[row.category] = row.permissions;
    return acc;
  }, {});
}

async function hasRole(userId, roleName) {
  const result = await pool.query(
    `SELECT r.name 
     FROM user_roles ur
     JOIN roles r ON ur.role_id = r.role_id
     WHERE ur.user_id = $1 AND r.name = $2 AND (ur.is_active = true OR ur.expires_at > now())`,
    [userId, roleName]
  );
  return result.rows.length > 0;
}

async function activateUserRole(userId, roleId) {
  const result = await pool.query(
    `UPDATE user_roles SET is_active = true, expires_at = NULL
     WHERE user_id = $1 AND role_id = $2
     RETURNING *`,
    [userId, roleId]
  );

  if (result.rows.length === 0) {
    throw new AppError('User role assignment not found', 404);
  }

  await clearCache(userId);
  return result.rows[0];
}

async function deactivateUserRole(userId, roleId, expiresAt = null) {
  const result = await pool.query(
    `UPDATE user_roles SET is_active = false, expires_at = $3
     WHERE user_id = $1 AND role_id = $2
     RETURNING *`,
    [userId, roleId, expiresAt]
  );

  if (result.rows.length === 0) {
    throw new AppError('User role assignment not found', 404);
  }

  await clearCache(userId);
  return result.rows[0];
}

async function cleanupExpiredRoles() {
  const result = await pool.query(
    `DELETE FROM user_roles 
     WHERE expires_at IS NOT NULL AND expires_at < now()
     RETURNING user_id`
  );

  const affectedUsers = [...new Set(result.rows.map(r => r.user_id))];
  for (const userId of affectedUsers) {
    await clearCache(userId);
  }

  return { deleted: result.rowCount };
}

module.exports = {
  getAllRoles,
  getRoleById,
  getRoleByName,
  createRole,
  updateRole,
  deleteRole,
  getAllPermissions,
  getPermissionById,
  getPermissionByName,
  createPermission,
  updatePermission,
  deletePermission,
  assignPermissionToRole,
  removePermissionFromRole,
  getRolePermissions,
  setRolePermissions,
  getUserRoles,
  getUserPermissions,
  checkUserPermission,
  assignRoleToUser,
  removeRoleFromUser,
  setUserRoles,
  getRoleHierarchy,
  getPermissionsByCategory,
  hasRole,
  activateUserRole,
  deactivateUserRole,
  cleanupExpiredRoles,
  clearCache,
};