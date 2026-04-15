const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth.js');
const { validate, updateProfileSchema, addAddressSchema, updateAddressSchema, changePasswordSchema } = require('../utils/validation.js');
const userController = require('../controllers/userController.js');

const router = express.Router();

// ── Self (authenticated user) ─────────────────────────────────────────────────
router.get('/me', authenticateToken, userController.getCurrentUser);
router.get('/profile', authenticateToken, userController.getCurrentUser);
router.put('/me', authenticateToken, validate(updateProfileSchema), userController.updateProfile);
router.put('/profile', authenticateToken, validate(updateProfileSchema), userController.updateProfile);

// Address management
router.post('/me/addresses', authenticateToken, validate(addAddressSchema), userController.addAddress);
router.put('/me/addresses/:addressId', authenticateToken, validate(updateAddressSchema), userController.updateAddress);
router.delete('/me/addresses/:addressId', authenticateToken, userController.removeAddress);
router.post('/addresses', authenticateToken, validate(addAddressSchema), userController.addAddress);
router.put('/addresses/:addressId', authenticateToken, validate(updateAddressSchema), userController.updateAddress);
router.delete('/addresses/:addressId', authenticateToken, userController.removeAddress);

// Password management
router.put('/me/password', authenticateToken, validate(changePasswordSchema), userController.requestPasswordChange);
router.post('/me/change-password', authenticateToken, validate(changePasswordSchema), userController.requestPasswordChange);
router.post('/change-password', authenticateToken, validate(changePasswordSchema), userController.requestPasswordChange);
router.post('/verify-password-reset-token', userController.verifyPasswordResetToken);

// Account management
router.post('/me/deactivate', authenticateToken, userController.deactivateAccount);
router.post('/me/reactivate', authenticateToken, userController.reactivateAccount);
router.post('/deactivate', authenticateToken, userController.deactivateAccount);
router.post('/reactivate', authenticateToken, userController.reactivateAccount);

// ── Admin: User CRUD ──────────────────────────────────────────────────────────
router.get('/', authenticateToken, authorize('admin', 'super_admin'), userController.getAllUsers);
router.put('/:userId/role',   authenticateToken, authorize('super_admin'), userController.updateUserRole);
router.put('/:userId/status', authenticateToken, authorize('admin', 'super_admin'), userController.updateUserStatus);

module.exports = router;