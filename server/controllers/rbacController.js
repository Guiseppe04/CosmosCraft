const rbacService = require('../services/rbacService');
const { AppError } = require('../middleware/errorHandler');
const Joi = require('joi');

const validate = (data, schema) => {
  const { error, value } = schema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map(detail => detail.message).join('; ');
    throw new AppError(messages, 400);
  }
  return value;
};

const roleSchema = Joi.object({
  name: Joi.string().min(2).max(50).required(),
  description: Joi.string().max(500).optional(),
  level: Joi.number().integer().min(0).max(100).default(0),
  parent_role_id: Joi.string().uuid().optional(),
});

const permissionSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(500).optional(),
  category: Joi.string().max(50).optional(),
});

const assignRoleSchema = Joi.object({
  role_id: Joi.string().uuid().required(),
  expires_at: Joi.date().iso().optional(),
});

const roleIdParam = Joi.object({
  id: Joi.string().uuid().required(),
});

const permissionIdParam = Joi.object({
  id: Joi.string().uuid().required(),
});

exports.getRoles = async (req, res, next) => {
  try {
    const roles = await rbacService.getAllRoles();
    res.json({ status: 'success', data: roles });
  } catch (err) { next(err); }
};

exports.getRole = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, roleIdParam);
    const role = await rbacService.getRoleById(req.params.id);
    if (!role) throw new AppError('Role not found', 404);
    res.json({ status: 'success', data: role });
  } catch (err) { next(err); }
};

exports.createRole = async (req, res, next) => {
  try {
    const validated = validate(req.body, roleSchema);
    const role = await rbacService.createRole(validated);
    res.status(201).json({ status: 'success', data: role });
  } catch (err) { next(err); }
};

exports.updateRole = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, roleIdParam);
    const role = await rbacService.updateRole(req.params.id, req.body);
    res.json({ status: 'success', data: role });
  } catch (err) { next(err); }
};

exports.deleteRole = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, roleIdParam);
    const result = await rbacService.deleteRole(req.params.id);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.getRolePermissions = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, roleIdParam);
    const permissions = await rbacService.getRolePermissions(req.params.id);
    res.json({ status: 'success', data: permissions });
  } catch (err) { next(err); }
};

exports.setRolePermissions = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, roleIdParam);
    const { permission_ids } = req.body;
    if (!Array.isArray(permission_ids)) {
      throw new AppError('permission_ids must be an array', 400);
    }
    const result = await rbacService.setRolePermissions(req.params.id, permission_ids);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.assignPermissionToRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permission_id } = req.body;
    validate({ id }, roleIdParam);
    if (!permission_id) throw new AppError('permission_id is required', 400);
    const result = await rbacService.assignPermissionToRole(id, permission_id);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.removePermissionFromRole = async (req, res, next) => {
  try {
    const { id, permissionId } = req.params;
    validate({ id }, roleIdParam);
    validate({ id: permissionId }, permissionIdParam);
    const result = await rbacService.removePermissionFromRole(id, permissionId);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.getPermissions = async (req, res, next) => {
  try {
    const permissions = await rbacService.getAllPermissions();
    res.json({ status: 'success', data: permissions });
  } catch (err) { next(err); }
};

exports.getPermission = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, permissionIdParam);
    const permission = await rbacService.getPermissionById(req.params.id);
    if (!permission) throw new AppError('Permission not found', 404);
    res.json({ status: 'success', data: permission });
  } catch (err) { next(err); }
};

exports.createPermission = async (req, res, next) => {
  try {
    const validated = validate(req.body, permissionSchema);
    const permission = await rbacService.createPermission(validated);
    res.status(201).json({ status: 'success', data: permission });
  } catch (err) { next(err); }
};

exports.updatePermission = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, permissionIdParam);
    const permission = await rbacService.updatePermission(req.params.id, req.body);
    res.json({ status: 'success', data: permission });
  } catch (err) { next(err); }
};

exports.deletePermission = async (req, res, next) => {
  try {
    validate({ id: req.params.id }, permissionIdParam);
    const result = await rbacService.deletePermission(req.params.id);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.getPermissionsByCategory = async (req, res, next) => {
  try {
    const permissions = await rbacService.getPermissionsByCategory();
    res.json({ status: 'success', data: permissions });
  } catch (err) { next(err); }
};

exports.getUserRoles = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { include_inactive } = req.query;
    const roles = await rbacService.getUserRoles(userId, include_inactive === 'true');
    res.json({ status: 'success', data: roles });
  } catch (err) { next(err); }
};

exports.getUserPermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const permissions = await rbacService.getUserPermissions(userId, false);
    res.json({ status: 'success', data: { permissions } });
  } catch (err) { next(err); }
};

exports.assignRoleToUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const validated = validate(req.body, assignRoleSchema);
    const result = await rbacService.assignRoleToUser(userId, validated.role_id, req.user.user_id, validated.expires_at);
    res.status(201).json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.removeRoleFromUser = async (req, res, next) => {
  try {
    const { userId, roleId } = req.params;
    const result = await rbacService.removeRoleFromUser(userId, roleId);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.setUserRoles = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { role_ids } = req.body;
    if (!Array.isArray(role_ids)) throw new AppError('role_ids must be an array', 400);
    const result = await rbacService.setUserRoles(userId, role_ids, req.user.user_id);
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};

exports.activateUserRole = async (req, res, next) => {
  try {
    const { userId, roleId } = req.params;
    const result = await rbacService.activateUserRole(userId, roleId);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.deactivateUserRole = async (req, res, next) => {
  try {
    const { userId, roleId } = req.params;
    const { expires_at } = req.body;
    const result = await rbacService.deactivateUserRole(userId, roleId, expires_at || null);
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.checkMyPermissions = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const permissions = await rbacService.getUserPermissions(userId, false);
    const roles = await rbacService.getUserRoles(userId, false);
    res.json({ status: 'success', data: { permissions, roles } });
  } catch (err) { next(err); }
};