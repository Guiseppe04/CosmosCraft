const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const { validate, createProductSchema, updateProductSchema, createCategorySchema, updateCategorySchema, createProductImageSchema } = require('../utils/validation');
const ctrl = require('../controllers/productController');

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
router.get('/categories', ctrl.getCategories);
router.post('/categories', authenticateToken, authorize('admin', 'super_admin'), validate(createCategorySchema), ctrl.createCategory);
router.put('/categories/:id', authenticateToken, authorize('admin', 'super_admin'), validate(updateCategorySchema), ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, authorize('admin', 'super_admin'), ctrl.deleteCategory);

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
router.get('/', ctrl.getProducts);
router.get('/:id', ctrl.getProduct);
router.post('/',    authenticateToken, authorize('admin', 'super_admin'), validate(createProductSchema), ctrl.createProduct);
router.put('/:id',  authenticateToken, authorize('admin', 'super_admin'), validate(updateProductSchema), ctrl.updateProduct);
router.delete('/:id', authenticateToken, authorize('admin', 'super_admin'), ctrl.deleteProduct);

// ─── PRODUCT IMAGES ──────────────────────────────────────────────────────────
router.post('/:id/images',               authenticateToken, authorize('admin', 'super_admin'), validate(createProductImageSchema), ctrl.addImage);
router.delete('/:id/images/:imageId',    authenticateToken, authorize('admin', 'super_admin'), ctrl.deleteImage);

module.exports = router;
