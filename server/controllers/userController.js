const { asyncHandler, AppError } = require('../middleware/errorHandler');
const userService = require('../services/userService');
const rbacService = require('../services/rbacService');
const { addAddressSchema, updateAddressSchema, updateProfileSchema } = require('../utils/validation');
const { hasRole } = require('../utils/roles');

/**
 * Get Current User Profile
 */
exports.getCurrentUser = asyncHandler(async (req, res, next) => {
  const user = await userService.getUserById(req.user.id);
  const authInfo = await userService.getUserAuthInfo(req.user.id);
  
  const { pool } = require('../config/database');
  const addressesRes = await pool.query('SELECT * FROM addresses WHERE user_id = $1', [user.user_id]);
  const addresses = addressesRes.rows.map(addr => ({
    address_id: addr.address_id,
    street_line1: addr.line1,
    street_line2: addr.line2,
    city: addr.city,
    province: addr.province,
    postal_code: addr.postal_code,
    country: addr.country,
    is_default: addr.is_default,
    label: addr.label,
  }));

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.user_id,
        name: { firstName: user.first_name, middleName: user.middle_name, lastName: user.last_name },
        email: user.email,
        avatar: user.avatar_url || null,
        avatarUrl: user.avatar_url || null,
        avatar_url: user.avatar_url || null,
        phone: user.phone,
        birthDate: null,
        addresses,
        role: user.role,
        provider: authInfo.provider,
        identityProviders: authInfo.identity_providers || [],
        hasLocalPassword: authInfo.has_local_password,
        isProfileComplete: !!user.first_name, // fallback
      },
    },
  });
});

/**
 * Update User Profile (name, phone, bio)
 */
exports.updateProfile = asyncHandler(async (req, res, next) => {
  // Validate input
  const { error, value } = updateProfileSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new AppError('Validation failed', 400, errors);
  }

  const updateData = {};

  if (value.firstName || value.lastName) {
    if (value.firstName) updateData.first_name = value.firstName;
    if (value.middleName !== undefined) updateData.middle_name = value.middleName;
    if (value.lastName) updateData.last_name = value.lastName;
  }

  if (value.phone) updateData.phone = value.phone;
  if (value.avatarUrl !== undefined) updateData.avatar_url = value.avatarUrl;

  const user = await userService.updateProfile(req.user.id, updateData);

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: { user },
  });
});

/**
 * Add Address
 */
exports.addAddress = asyncHandler(async (req, res, next) => {
  // Validate input
  const { error, value } = addAddressSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new AppError('Validation failed', 400, errors);
  }

  const user = await userService.addAddress(req.user.id, value);

  res.status(201).json({
    status: 'success',
    message: 'Address added successfully',
    data: { user },
  });
});

/**
 * Update Address
 */
exports.updateAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  // Validate input
  const { error, value } = updateAddressSchema.validate(req.body, { abortEarly: false });
  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));
    throw new AppError('Validation failed', 400, errors);
  }

  const user = await userService.updateAddress(req.user.id, addressId, value);

  res.status(200).json({
    status: 'success',
    message: 'Address updated successfully',
    data: { user },
  });
});

/**
 * Remove Address
 */
exports.removeAddress = asyncHandler(async (req, res, next) => {
  const { addressId } = req.params;

  const user = await userService.removeAddress(req.user.id, addressId);

  res.status(200).json({
    status: 'success',
    message: 'Address removed successfully',
    data: { user },
  });
});

/**
 * Get All Users (Admin Only)
 */
exports.getAllUsers = asyncHandler(async (req, res, next) => {
  const { role, name, email, limit = 10, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const filters = {};
  if (role) filters.role = role;
  if (name) filters.name = name;
  if (email) filters.email = email;

  const result = await userService.listUsers(filters, parseInt(limit), skip);

  res.status(200).json({
    status: 'success',
    data: result,
  });
});

/**
 * Update User Role (admin access)
 */
exports.updateUserRole = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { role } = req.body;

  const VALID_ROLES = ['customer', 'staff', 'admin', 'super_admin'];
  if (!VALID_ROLES.includes(role)) {
    throw new AppError(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`, 400);
  }

  if (!hasRole(req.user.role, 'admin')) {
    throw new AppError('Only admins can update user roles', 403);
  }

  const roleRecord = await rbacService.getRoleByName(role);
  if (!roleRecord) throw new AppError('Role not found', 404);

  await rbacService.setUserRoles(userId, [roleRecord.role_id], req.user.user_id);

  const { pool } = require('../config/database');
  const res2 = await pool.query(
    `UPDATE users SET role = $1, updated_at = now() WHERE user_id = $2 RETURNING user_id, email, role, is_active`,
    [roleRecord.name, userId]
  );
  if (!res2.rows[0]) throw new AppError('User not found', 404);

  res.status(200).json({
    status: 'success',
    message: 'User role updated successfully',
    data: { user: res2.rows[0] },
  });
});

/**
 * Update User Active Status (admin+)
 */
exports.updateUserStatus = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { is_active } = req.body;

  if (typeof is_active !== 'boolean') {
    throw new AppError('is_active must be a boolean', 400);
  }

  const { pool } = require('../config/database');
  const result = await pool.query(
    `UPDATE users SET is_active = $1, updated_at = now() WHERE user_id = $2 RETURNING user_id, email, role, is_active`,
    [is_active, userId]
  );
  if (!result.rows[0]) throw new AppError('User not found', 404);

  res.status(200).json({
    status: 'success',
    message: `User ${is_active ? 'activated' : 'deactivated'} successfully`,
    data: { user: result.rows[0] },
  });
});


/**
 * Deactivate Account
 */
exports.deactivateAccount = asyncHandler(async (req, res, next) => {
  const user = await userService.deactivateAccount(req.user.id);

  res.status(200).json({
    status: 'success',
    message: 'Account deactivated successfully',
    data: { user },
  });
});

/**
 * Reactivate Account
 */
exports.reactivateAccount = asyncHandler(async (req, res, next) => {
  const user = await userService.reactivateAccount(req.user.id);

  res.status(200).json({
    status: 'success',
    message: 'Account reactivated successfully',
    data: { user },
  });
});

/**
 * Change Password
 * For local accounts, current password is required.
 * For social-only accounts without local password, allows setting a local password.
 */
exports.requestPasswordChange = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    throw new AppError('New passwords do not match', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[@$!%*?&]/.test(newPassword)) {
    throw new AppError('Password must contain uppercase, lowercase, number, and special character', 400);
  }

  const authInfo = await userService.getUserAuthInfo(req.user.id);
  const hasLocalPassword = Boolean(authInfo.has_local_password);

  if (hasLocalPassword) {
    if (!oldPassword) {
      throw new AppError('Current password is required', 400);
    }

    const isCurrentPasswordValid = await userService.verifyPassword(req.user.id, oldPassword);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    const isSameAsCurrent = await userService.verifyPassword(req.user.id, newPassword);
    if (isSameAsCurrent) {
      throw new AppError('New password must be different from current password', 400);
    }

    await userService.setPassword(req.user.id, newPassword);
  } else {
    await userService.setPassword(req.user.id, newPassword);
  }

  res.status(200).json({
    status: 'success',
    message: hasLocalPassword
      ? 'Password changed successfully.'
      : 'Local password set successfully.',
    data: {
      provider: authInfo.provider,
      hasLocalPassword: true,
    },
  });
});

