const productService = require('../services/productService');
const { AppError } = require('../middleware/errorHandler');

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await productService.getAllCategories();
    res.json({ status: 'success', data: categories });
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    const category = await productService.createCategory(req.validatedData || req.body);
    res.status(201).json({ status: 'success', data: category });
  } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await productService.updateCategory(req.params.id, req.validatedData || req.body);
    if (!category) throw new AppError('Category not found', 404);
    res.json({ status: 'success', data: category });
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    await productService.deleteCategory(req.params.id);
    res.json({ status: 'success', message: 'Category deleted' });
  } catch (err) { next(err); }
};

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

exports.getProducts = async (req, res, next) => {
  try {
    const products = await productService.getAllProducts(req.query);
    res.json({ status: 'success', data: products });
  } catch (err) { next(err); }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json({ status: 'success', data: product });
  } catch (err) { next(err); }
};

exports.createProduct = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.validatedData || req.body);
    res.status(201).json({ status: 'success', data: product });
  } catch (err) { next(err); }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.validatedData || req.body);
    if (!product) throw new AppError('Product not found', 404);
    res.json({ status: 'success', data: product });
  } catch (err) { next(err); }
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await productService.deleteProduct(req.params.id);
    if (!product) throw new AppError('Product not found', 404);
    res.json({ status: 'success', message: 'Product deactivated', data: product });
  } catch (err) { next(err); }
};

// ─── PRODUCT IMAGES ──────────────────────────────────────────────────────────

exports.addImage = async (req, res, next) => {
  try {
    const image = await productService.addProductImage(req.params.id, req.body);
    res.status(201).json({ status: 'success', data: image });
  } catch (err) { next(err); }
};

exports.deleteImage = async (req, res, next) => {
  try {
    await productService.deleteProductImage(req.params.imageId);
    res.json({ status: 'success', message: 'Image deleted' });
  } catch (err) { next(err); }
};
