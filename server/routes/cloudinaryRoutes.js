const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const cloudinaryController = require('../controllers/cloudinaryController');

const router = express.Router();

// Browsing Cloudinary asset folders requires admin/staff privileges
// because the Admin API exposes the full asset library.
router.get(
  '/browse',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  cloudinaryController.browse
);

module.exports = router;
