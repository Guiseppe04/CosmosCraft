const auditService = require('../services/auditService');
const { AppError } = require('../middleware/errorHandler');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { module, user_id, action, table_name, start_date, end_date, limit = 50, offset = 0 } = req.query;
    const result = await auditService.getAuditLogs({
      module, user_id, action, table_name, start_date, end_date, limit, offset
    });
    res.json({
      status: 'success',
      data: result.logs,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        pages: Math.ceil(result.total / result.limit),
      }
    });
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
    const { module } = req.params;
    const { limit = 50, offset = 0, start_date, end_date } = req.query;
    const logs = await auditService.getAuditLogsByModule(module, { limit, offset, start_date, end_date });
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
    const { tableName, recordId } = req.params;
    const logs = await auditService.getAuditLogsByEntity(tableName, recordId);
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

exports.cleanupOldLogs = async (req, res, next) => {
  try {
    if (!['admin', 'super_admin'].includes(req.user.role)) {
      throw new AppError('Admin access required', 403);
    }
    const { days = 90 } = req.query;
    const result = await auditService.cleanupOldLogs(parseInt(days));
    res.json({ status: 'success', ...result });
  } catch (err) { next(err); }
};