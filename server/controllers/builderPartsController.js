const builderPartsService = require('../services/builderPartsService');
const { AppError } = require('../middleware/errorHandler');

exports.getAllParts = async (req, res, next) => {
  try {
    const parts = await builderPartsService.getAllParts(req.query);
    res.json({ status: 'success', data: { parts } });
  } catch (err) { next(err); }
};

exports.getPart = async (req, res, next) => {
  try {
    const part = await builderPartsService.getPartById(req.params.id);
    if (!part) throw new AppError('Part not found', 404);
    res.json({ status: 'success', data: { part } });
  } catch (err) { next(err); }
};

exports.createPart = async (req, res, next) => {
  try {
    const part = await builderPartsService.createPart(req.body);
    res.status(201).json({ status: 'success', data: { part } });
  } catch (err) { next(err); }
};

exports.updatePart = async (req, res, next) => {
  try {
    const part = await builderPartsService.updatePart(req.params.id, req.body);
    if (!part) throw new AppError('Part not found', 404);
    res.json({ status: 'success', data: { part } });
  } catch (err) { next(err); }
};

exports.deletePart = async (req, res, next) => {
  try {
    const part = await builderPartsService.deletePart(req.params.id);
    if (!part) throw new AppError('Part not found', 404);
    res.json({ status: 'success', message: 'Part deactivated', data: { part } });
  } catch (err) { next(err); }
};
