const auditService = require('../services/auditService');
const { AppError } = require('../middleware/errorHandler');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const {
      entity_type,
      user_id,
      action,
      start_date,
      end_date,
      search,
      limit = 50,
      offset = 0,
    } = req.query;
    const result = await auditService.getAuditLogs({
      entity_type,
      user_id,
      action,
      start_date,
      end_date,
      search,
      limit,
      offset,
    });
    res.json({
      status: 'success',
      data: result.logs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        pages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (err) { next(err); }
};

// Distinct actions present in the trail, so the admin filter only offers values
// that can actually return results.
exports.getAuditActions = async (req, res, next) => {
  try {
    const actions = await auditService.getAuditActions();
    res.json({ status: 'success', data: actions.map((row) => row.action) });
  } catch (err) { next(err); }
};

exports.getAuditLog = async (req, res, next) => {
  try {
    const log = await auditService.getAuditLogById(req.params.id);
    if (!log) throw new AppError('Audit log not found', 404);
    res.json({ status: 'success', data: log });
  } catch (err) { next(err); }
};

exports.getAuditLogsByModule = async (req, res, next) => {
  try {
    const { entityType } = req.params;
    const { limit = 50, offset = 0, start_date, end_date } = req.query;
    const logs = await auditService.getAuditLogsByModule(entityType, { limit, offset, start_date, end_date });
    res.json({ status: 'success', data: logs });
  } catch (err) { next(err); }
};

exports.getAuditLogsByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 50, offset = 0, start_date, end_date, action } = req.query;
    const logs = await auditService.getAuditLogsByUser(userId, { limit, offset, start_date, end_date, action });
    res.json({ status: 'success', data: logs });
  } catch (err) { next(err); }
};

exports.getAuditLogsByEntity = async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const logs = await auditService.getAuditLogsByEntity(entityType, entityId);
    res.json({ status: 'success', data: logs });
  } catch (err) { next(err); }
};

exports.getActivitySummary = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const summary = await auditService.getActivitySummary({ start_date, end_date });
    res.json({ status: 'success', data: summary });
  } catch (err) { next(err); }
};

/**
 * Audit history is append-only: there is deliberately no update, edit or delete
 * endpoint. Exposing one would let an administrator rewrite the very trail used
 * to investigate them.
 */