const express = require('express');
const { validateZipForCity } = require('../controllers/addressController.js');
const { asyncHandler } = require('../middleware/errorHandler.js');

const router = express.Router();

// GET /api/address/validate-zip?cityCode=XXX&zipCode=YYY
// Validates a Philippine zip code against a selected city (PSGC code).
// Public endpoint — used during signup address entry (no auth required).
router.get(
  '/validate-zip',
  asyncHandler(validateZipForCity)
);

module.exports = router;
