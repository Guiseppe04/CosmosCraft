const builderPartsService = require('../services/builderPartsService');
const { AppError } = require('../middleware/errorHandler');
const auditService = require('../services/auditService');

exports.getAllParts = async (req, res, next) => {
  try {
    const { items, pagination } = await builderPartsService.getAllParts(req.query);
    res.json({ status: 'success', data: items, pagination });
  } catch (err) { next(err); }
};

exports.getModelImages = async (req, res, next) => {
  try {
    const items = await builderPartsService.getModelImages(req.query);
    res.json({ status: 'success', data: items });
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
    await auditService.logCreate(
      req.user?.user_id || null,
      auditService.MODULES.CUSTOMIZATIONS,
      'guitar_builder_parts',
      part.part_id,
      part,
      req.ip
    );
    res.status(201).json({ status: 'success', data: { part } });
  } catch (err) { next(err); }
};

exports.updatePart = async (req, res, next) => {
  try {
    const existing = await builderPartsService.getPartById(req.params.id);
    if (!existing) throw new AppError('Part not found', 404);

    const part = await builderPartsService.updatePart(req.params.id, req.body);
    if (!part) throw new AppError('Part not found', 404);
    await auditService.logUpdate(
      req.user?.user_id || null,
      auditService.MODULES.CUSTOMIZATIONS,
      'guitar_builder_parts',
      part.part_id,
      existing,
      part,
      req.ip
    );
    res.json({ status: 'success', data: { part } });
  } catch (err) { next(err); }
};

exports.deletePart = async (req, res, next) => {
  try {
    const existing = await builderPartsService.getPartById(req.params.id);
    if (!existing) throw new AppError('Part not found', 404);

    const part = await builderPartsService.deletePart(req.params.id);
    if (!part) throw new AppError('Part not found', 404);
    await auditService.logDelete(
      req.user?.user_id || null,
      auditService.MODULES.CUSTOMIZATIONS,
      'guitar_builder_parts',
      part.part_id,
      existing,
      req.ip
    );
    res.json({ status: 'success', message: 'Part deactivated', data: { part } });
  } catch (err) { next(err); }
};

exports.importPartsFromModels = async (req, res, next) => {
  try {
    const guitarType = String(req.body?.guitarType || '').trim().toLowerCase();
    const result = await builderPartsService.importPartsFromModelFolder({ guitarType });
    res.json({
      status: 'success',
      message: `Imported ${result.imported.created + result.imported.updated} ${guitarType} parts`,
      data: result,
    });
  } catch (err) { next(err); }
};

exports.seedCustomizeParts = async (req, res, next) => {
  try {
    const guitarType = String(req.body?.guitarType || '').trim().toLowerCase();
    const result = await builderPartsService.seedCustomizeParts({ guitarType });
    res.json({
      status: 'success',
      message: `Seeded ${result.seeded.created + result.seeded.updated} ${guitarType} customize parts`,
      data: result,
    });
  } catch (err) { next(err); }
};

exports.upsertModelImage = async (req, res, next) => {
  try {
    const item = await builderPartsService.upsertModelImage({
      guitar_type: req.params.guitarType,
      model_key: req.params.modelKey,
      display_name: req.body?.display_name,
      image_url: req.body?.image_url ?? null,
    });
    if (!item) throw new AppError('Model image could not be saved', 500);
    res.json({ status: 'success', data: item });
  } catch (err) { next(err); }
};
