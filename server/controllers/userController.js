const { asyncHandler, AppError } = require('../middleware/errorHandler');
const userService = require('../services/userService');
const { addAddressSchema, updateAddressSchema, updateProfileSchema } = require('../utils/validation');

/**
 * Get Current User Profile
 */
exports.getCurrentUser = asyncHandler(async (req, res, next) => {
  const user = await userService.getUserById(req.user.id);

  res.status(200).json({
    status: 'success',
    data: {
      user: {
        id: user.user_id,
        name: { firstName: user.first_name, lastName: user.last_name },
        email: user.email,
        phone: user.phone,
        role: user.role,
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
    updateData.name = {
      firstName: value.firstName || undefined,
      middleName: value.middleName || undefined,
      lastName: value.lastName || undefined,
    };
  }

  if (value.phone) updateData.phone = value.phone;
  if (value.bio !== undefined) updateData['profile.bio'] = value.bio;

  const user = await userService.updateProfile(req.user.id, updateData);

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: { user },
  });
});

/**
 * Add Address (max 2)
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
 * Update User Role (Admin Only)
 */
exports.updateUserRole = asyncHandler(async (req, res, next) => {
  const { userId } = req.params;
  const { role } = req.body;

  if (!['user', 'admin', 'moderator'].includes(role)) {
    throw new AppError('Invalid role. Must be user, admin, or moderator', 400);
  }

  const user = await userService.updateProfile(userId, { role });

  res.status(200).json({
    status: 'success',
    message: 'User role updated successfully',
    data: { user },
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
 * Change Password (Email/Password users only)
 */
exports.changePassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmPassword) {
    throw new AppError('All password fields are required', 400);
  }

  if (newPassword !== confirmPassword) {
    throw new AppError('New passwords do not match', 400);
  }

  if (newPassword.length < 8) {
    throw new AppError('New password must be at least 8 characters', 400);
  }

  await userService.updatePassword(req.user.id, oldPassword, newPassword);

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully',
  });
});
