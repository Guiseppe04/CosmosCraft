const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const builderPartsController = require('../controllers/builderPartsController');

const router = express.Router();

// Allow public to fetch active generic parts for the builder
router.get('/', builderPartsController.getAllParts);
router.get('/:id', builderPartsController.getPart);

// Admin / Staff specific CRUD actions
router.post('/', authenticateToken, authorize('staff', 'admin', 'super_admin'), builderPartsController.createPart);
router.post('/import-models', authenticateToken, authorize('admin', 'super_admin'), builderPartsController.importPartsFromModels);
router.put('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), builderPartsController.updatePart);
router.delete('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), builderPartsController.deletePart);

module.exports = router;
