const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbacMiddleware');
const ctrl = require('../controllers/rbacController');

router.use(authenticateToken);

router.get('/my-permissions', ctrl.checkMyPermissions);

router.get('/roles', ctrl.getRoles);
router.post('/roles', checkPermission('manage_roles'), ctrl.createRole);
router.get('/roles/:id', ctrl.getRole);
router.patch('/roles/:id', checkPermission('manage_roles'), ctrl.updateRole);
router.delete('/roles/:id', checkPermission('manage_roles'), ctrl.deleteRole);

router.get('/roles/:id/permissions', ctrl.getRolePermissions);
router.put('/roles/:id/permissions', checkPermission('manage_roles'), ctrl.setRolePermissions);
router.post('/roles/:id/permissions', checkPermission('manage_roles'), ctrl.assignPermissionToRole);
router.delete('/roles/:id/permissions/:permissionId', checkPermission('manage_roles'), ctrl.removePermissionFromRole);

router.get('/permissions', ctrl.getPermissions);
router.get('/permissions/categories', ctrl.getPermissionsByCategory);
router.post('/permissions', checkPermission('manage_permissions'), ctrl.createPermission);
router.get('/permissions/:id', ctrl.getPermission);
router.patch('/permissions/:id', checkPermission('manage_permissions'), ctrl.updatePermission);
router.delete('/permissions/:id', checkPermission('manage_permissions'), ctrl.deletePermission);

router.get('/users/:userId/roles', ctrl.getUserRoles);
router.get('/users/:userId/permissions', ctrl.getUserPermissions);
router.post('/users/:userId/roles', checkPermission('assign_roles'), ctrl.assignRoleToUser);
router.put('/users/:userId/roles', checkPermission('assign_roles'), ctrl.setUserRoles);
router.delete('/users/:userId/roles/:roleId', checkPermission('assign_roles'), ctrl.removeRoleFromUser);
router.patch('/users/:userId/roles/:roleId/activate', ctrl.activateUserRole);
router.patch('/users/:userId/roles/:roleId/deactivate', ctrl.deactivateUserRole);

module.exports = router;