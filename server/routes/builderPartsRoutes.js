const express = require('express');
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate, validateParams, uuidParamSchema, createBuilderPartSchema, updateBuilderPartSchema, guitarTypeRequestSchema, guitarTypeParamSchema, upsertModelImageSchema } = require('../utils/validation');
const builderPartsController = require('../controllers/builderPartsController');

const router = express.Router();

// Allow public to fetch active generic parts for the builder
router.get('/', builderPartsController.getAllParts);
router.get('/assets', builderPartsController.listBuilderAssets);
router.get('/model-images', builderPartsController.getModelImages);
router.get('/:id', validateParams(uuidParamSchema), builderPartsController.getPart);

// Admin / Staff specific CRUD actions
router.post('/', authenticateToken, authorize('staff', 'admin', 'super_admin'), validate(createBuilderPartSchema), builderPartsController.createPart);
router.post('/import-models', authenticateToken, authorize('admin', 'super_admin'), validate(guitarTypeRequestSchema), builderPartsController.importPartsFromModels);
router.post('/seed-customize-parts', authenticateToken, authorize('admin', 'super_admin'), validate(guitarTypeRequestSchema), builderPartsController.seedCustomizeParts);
router.put('/model-images/:guitarType/:modelKey', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(guitarTypeParamSchema), validate(upsertModelImageSchema), builderPartsController.upsertModelImage);
router.put('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), validate(updateBuilderPartSchema), builderPartsController.updatePart);
router.delete('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), builderPartsController.deletePart);

module.exports = router;
