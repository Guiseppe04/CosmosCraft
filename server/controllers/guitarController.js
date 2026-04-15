const guitarService = require('../services/guitarService');
const { AppError } = require('../middleware/errorHandler');

// ─── CUSTOMIZATIONS ──────────────────────────────────────────────────────────

exports.getCustomizations = async (req, res, next) => {
  try {
    const data = await guitarService.getAllCustomizations(req.query);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.getCustomization = async (req, res, next) => {
  try {
    const data = await guitarService.getCustomizationById(req.params.id);
    if (!data) throw new AppError('Customization not found', 404);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.updateCustomization = async (req, res, next) => {
  try {
    const data = await guitarService.updateCustomization(req.params.id, req.body);
    if (!data) throw new AppError('Customization not found', 404);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.deleteCustomization = async (req, res, next) => {
  try {
    await guitarService.deleteCustomization(req.params.id);
    res.json({ status: 'success', message: 'Customization deleted' });
  } catch (err) { next(err); }
};

exports.getMyCustomizations = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.user_id;
    const data = await guitarService.getMyCustomizations(userId);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.createMyCustomization = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.user_id;
    const data = await guitarService.createMyCustomization(userId, req.body);
    res.status(201).json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.updateMyCustomization = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.user?.user_id;
    const data = await guitarService.updateMyCustomization(req.params.id, userId, req.body);
    if (!data) throw new AppError('Customization not found', 404);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

// ─── GUITAR PARTS ────────────────────────────────────────────────────────────

exports.getParts = async (req, res, next) => {
  try {
    const data = await guitarService.getAllParts(req.query);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.createPart = async (req, res, next) => {
  try {
    const data = await guitarService.createPart(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.updatePart = async (req, res, next) => {
  try {
    const data = await guitarService.updatePart(req.params.id, req.body);
    if (!data) throw new AppError('Part not found', 404);
    res.json({ status: 'success', data });
  } catch (err) { next(err); }
};

exports.deletePart = async (req, res, next) => {
  try {
    await guitarService.deletePart(req.params.id);
    res.json({ status: 'success', message: 'Part deleted' });
  } catch (err) { next(err); }
};
