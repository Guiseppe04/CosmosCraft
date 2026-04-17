const reportService = require('../services/reportService');
const { AppError } = require('../middleware/errorHandler');

exports.getOrderReport = async (req, res, next) => {
  try {
    const { start_date, end_date, status, group_by } = req.query;
    const result = await reportService.getOrderReport({ start_date, end_date, status, group_by });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getPaymentReport = async (req, res, next) => {
  try {
    const { start_date, end_date, status, method } = req.query;
    const result = await reportService.getPaymentReport({ start_date, end_date, status, method });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getAppointmentReport = async (req, res, next) => {
  try {
    const { start_date, end_date, status, service_id } = req.query;
    const result = await reportService.getAppointmentReport({ start_date, end_date, status, service_id });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getServiceReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await reportService.getServiceReport({ start_date, end_date });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getProductReport = async (req, res, next) => {
  try {
    const { start_date, end_date, category_id, limit } = req.query;
    const result = await reportService.getProductReport({ start_date, end_date, category_id, limit });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getCartReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await reportService.getCartReport({ start_date, end_date });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getUserReport = async (req, res, next) => {
  try {
    const { start_date, end_date, role } = req.query;
    const result = await reportService.getUserReport({ start_date, end_date, role });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getDashboardSummary = async (req, res, next) => {
  try {
    const result = await reportService.getDashboardSummary();
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getSalesReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await reportService.getSalesReport({ start_date, end_date });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getRevenueReport = async (req, res, next) => {
  try {
    const { start_date, end_date, group_by } = req.query;
    const result = await reportService.getRevenueReport({ start_date, end_date, group_by });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.getCustomizationReport = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await reportService.getCustomizationReport({ start_date, end_date });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};

exports.exportReport = async (req, res, next) => {
  try {
    const { type, start_date, end_date } = req.query;
    if (!type) throw new AppError('Report type is required', 400);
    const result = await reportService.exportReport(type, { start_date, end_date });
    res.json({ status: 'success', data: result });
  } catch (err) { next(err); }
};
