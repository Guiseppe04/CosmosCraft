const rbacService = require('../services/rbacService');

const checkPermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.user_id) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required',
        });
      }

      const userPermissions = await rbacService.getUserPermissions(req.user.user_id, true);
      
      const hasPermission = requiredPermissions.some(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions',
          required: requiredPermissions,
          user_permissions: userPermissions,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

const checkRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.user_id) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required',
        });
      }

      const userRoles = await rbacService.getUserRoles(req.user.user_id, true);
      const roleNames = userRoles.map(r => r.name.toLowerCase());
      
      const hasRole = allowedRoles.some(role => 
        roleNames.includes(role.toLowerCase())
      );

      if (!hasRole) {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient role privileges',
          required: allowedRoles,
          user_roles: roleNames,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

const checkAnyPermission = (...permissions) => {
  return checkPermission(...permissions);
};

const checkAllPermissions = (...permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.user.user_id) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required',
        });
      }

      const userPermissions = await rbacService.getUserPermissions(req.user.user_id, true);
      
      const missingPermissions = permissions.filter(permission => 
        !userPermissions.includes(permission)
      );

      if (missingPermissions.length > 0) {
        return res.status(403).json({
          status: 'error',
          message: 'Missing required permissions',
          missing: missingPermissions,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

const requireAdmin = checkRole('admin', 'super_admin');
const requireStaff = checkRole('staff', 'admin', 'super_admin');
const requireCustomer = checkRole('customer', 'staff', 'admin', 'super_admin');

const getUserPermissions = async (req, res, next) => {
  try {
    if (!req.user || !req.user.user_id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required',
      });
    }

    const permissions = await rbacService.getUserPermissions(req.user.user_id, false);
    req.userPermissions = permissions;
    next();
  } catch (err) {
    next(err);
  }
};

const canManageEntity = (entityType, action) => {
  const permissionMap = {
    users: {
      create: 'manage_users',
      read: 'view_users',
      update: 'manage_users',
      delete: 'manage_users',
    },
    products: {
      create: 'manage_products',
      read: 'view_products',
      update: 'manage_products',
      delete: 'manage_products',
    },
    orders: {
      create: 'manage_orders',
      read: 'view_orders',
      update: 'manage_orders',
      delete: 'cancel_orders',
    },
    services: {
      create: 'manage_services',
      read: 'view_services',
      update: 'manage_services',
      delete: 'manage_services',
    },
    appointments: {
      create: 'manage_appointments',
      read: 'view_appointments',
      update: 'manage_appointments',
      delete: 'manage_appointments',
    },
    payments: {
      create: 'manage_payments',
      read: 'manage_payments',
      update: 'manage_payments',
      delete: 'refund_payments',
    },
    customizations: {
      create: 'manage_customizations',
      read: 'view_customizations',
      update: 'manage_customizations',
      delete: 'manage_customizations',
    },
    cart: {
      create: 'manage_cart',
      read: 'manage_cart',
      update: 'manage_cart',
      delete: 'manage_cart',
    },
  };

  const requiredPermission = permissionMap[entityType]?.[action];
  
  if (!requiredPermission) {
    return (req, res, next) => next();
  }

  return checkPermission(requiredPermission);
};

module.exports = {
  checkPermission,
  checkRole,
  checkAnyPermission,
  checkAllPermissions,
  requireAdmin,
  requireStaff,
  requireCustomer,
  getUserPermissions,
  canManageEntity,
};