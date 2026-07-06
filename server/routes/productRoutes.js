const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/productController');

// ─── CATEGORIES ──────────────────────────────────────────────────────────────
router.get('/categories', ctrl.getCategories);
router.post('/categories', authenticateToken, authorize('admin', 'super_admin'), ctrl.createCategory);
router.put('/categories/:id', authenticateToken, authorize('admin', 'super_admin'), ctrl.updateCategory);
router.delete('/categories/:id', authenticateToken, authorize('admin', 'super_admin'), ctrl.deleteCategory);

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
router.get('/', ctrl.getProducts);
router.get('/:id', ctrl.getProduct);
router.post('/',    authenticateToken, authorize('admin', 'super_admin'), ctrl.createProduct);
router.put('/:id',  authenticateToken, authorize('admin', 'super_admin'), ctrl.updateProduct);
router.delete('/:id', authenticateToken, authorize('admin', 'super_admin'), ctrl.deleteProduct);

// ─── PRODUCT IMAGES ──────────────────────────────────────────────────────────
router.post('/:id/images',               authenticateToken, authorize('admin', 'super_admin'), ctrl.addImage);
router.delete('/:id/images/:imageId',    authenticateToken, authorize('admin', 'super_admin'), ctrl.deleteImage);

module.exports = router;
