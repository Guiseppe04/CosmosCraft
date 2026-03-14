const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth.js');
const { validate, updateProfileSchema, addAddressSchema, updateAddressSchema, changePasswordSchema } = require('../utils/validation.js');
const userController = require('../controllers/userController.js');

const router = express.Router();

// User profile endpoints
router.get('/profile', authenticateToken, userController.getCurrentUser);
router.put('/profile', authenticateToken, validate(updateProfileSchema), userController.updateProfile);

// Address management endpoints
router.post('/addresses', authenticateToken, validate(addAddressSchema), userController.addAddress);
router.put('/addresses/:id', authenticateToken, validate(updateAddressSchema), userController.updateAddress);
router.delete('/addresses/:id', authenticateToken, userController.removeAddress);

// Password management
router.post('/change-password', authenticateToken, validate(changePasswordSchema), userController.changePassword);

// Account management
router.post('/deactivate', authenticateToken, userController.deactivateAccount);
router.post('/reactivate', authenticateToken, userController.reactivateAccount);

// Admin endpoints
router.get('/all', authenticateToken, authorize('admin'), userController.getAllUsers);
router.put('/:id/role', authenticateToken, authorize('admin'), userController.updateUserRole);

module.exports = router;