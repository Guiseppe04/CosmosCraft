const express = require('express')
const router = express.Router()
const orderController = require('../controllers/orderController.js')
const { authenticateToken, authorize } = require('../middleware/auth.js')
const {
  validate,
  validateParams,
  validateQuery,
  createOrderSchema,
  cancelMyOrderSchema,
  updatePaymentStatusSchema,
  updateShipmentSchema,
  updateOutForDeliverySchema,
  updateOrderSchema,
  listOrdersSchema,
  orderIdParamSchema,
  uuidParamSchema,
  namedUuidParamSchema,
  markAsReceivedSchema,
  createRefundRequestSchema,
  listRefundRequestsSchema,
  updateRefundStatusSchema,
} = require('../utils/validation.js')

// --- SPECIFIC ROUTES FIRST (before /:id wildcard) ---
// Get user's orders (requires authentication)
router.get('/my-orders', authenticateToken, orderController.getUserOrders)

// --- REFUND ROUTES ---
router.get('/dispatch-photos/:photoId', authenticateToken, authorize('staff','admin','super_admin'), validateParams(namedUuidParamSchema('photoId')), orderController.getDispatchPhoto)
router.get('/:orderId/dispatch-photos', authenticateToken, authorize('staff','admin','super_admin'), validateParams(orderIdParamSchema), orderController.getDispatchPhotos)
router.post('/:orderId/dispatch-photos', authenticateToken, authorize('staff','admin','super_admin'), validateParams(orderIdParamSchema), validate(require('../utils/dispatchPhotoValidation').appendSchema), orderController.appendDispatchPhotos)
router.patch('/refund-requests/:refundId/review', authenticateToken, authorize('admin','super_admin'), validateParams(namedUuidParamSchema('refundId')), validate(require('../utils/refundReviewValidation').reviewSchema), orderController.updateRefundReview)
router.post('/refund-requests/:refundId/repair-offer', authenticateToken, authorize('admin','super_admin'), validateParams(namedUuidParamSchema('refundId')), validate(require('../utils/refundReviewValidation').offerSchema), orderController.offerRefundRepair)
router.post('/refund-requests/:refundId/repair-response', authenticateToken, validateParams(namedUuidParamSchema('refundId')), validate(require('../utils/refundReviewValidation').responseSchema), orderController.respondRefundRepair)
router.get('/refund-requests/:refundId/tracking', authenticateToken, validateParams(namedUuidParamSchema('refundId')), orderController.getCustomerRefundTracking)
router.get('/refund-requests/:refundId/evidence/:kind', authenticateToken, validateParams(namedUuidParamSchema('refundId').keys({kind:require('joi').string().pattern(/^(evidence|return)_?[0-4]$/).required()})), orderController.getCustomerRefundEvidence)
router.post('/refund-requests/:refundId/return-evidence', authenticateToken, validateParams(namedUuidParamSchema('refundId')), validate(require('../utils/validation').customerReturnEvidenceSchema), orderController.submitCustomerReturn)

router.get('/refund-requests/:refundId/files/:kind', authenticateToken, validateParams(namedUuidParamSchema('refundId').keys({ kind: require('joi').string().pattern(/^(qr|proof|inspection|(evidence|return)_?[0-4])$/).required() })), orderController.getRefundFile)
router.post('/refund-requests/:refundId/confirm', authenticateToken, validateParams(namedUuidParamSchema('refundId')), orderController.confirmRefund)
router.get('/refund-requests', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateQuery(listRefundRequestsSchema), orderController.getRefundRequests)
router.get('/refund-requests/:refundId', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(namedUuidParamSchema('refundId')), orderController.getRefundRequest)
router.put('/refund-requests/:refundId/status', authenticateToken, authorize('admin', 'super_admin'), validateParams(namedUuidParamSchema('refundId')), validate(updateRefundStatusSchema), orderController.updateRefundStatus)
router.post('/refund-requests/:refundId/withdraw', authenticateToken, validateParams(namedUuidParamSchema('refundId')), orderController.withdrawRefund)
router.patch('/refund-requests/:refundId/adjust', authenticateToken, authorize('admin', 'super_admin'), validateParams(namedUuidParamSchema('refundId')), orderController.adjustRefundAmount)

// --- ADMIN ROUTES ---
router.get('/', authenticateToken, authorize('staff', 'admin', 'super_admin'), validate(listOrdersSchema, 'query'), orderController.getAllOrders)

// --- ID-BASED ROUTES (after specific routes) ---
router.get('/:orderId', authenticateToken, validateParams(orderIdParamSchema), orderController.getOrder)
router.put('/:id/payment-status', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), validate(updatePaymentStatusSchema), orderController.updatePaymentStatus)
router.put('/:id', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), validate(updateOrderSchema), orderController.updateOrder)
router.post('/:id/cancel', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), orderController.cancelOrder)
router.post('/:id/approve-payment', authenticateToken, authorize('staff', 'admin', 'super_admin'), validateParams(uuidParamSchema), orderController.approvePayment)
router.post('/:id/cancel-my-order', authenticateToken, validateParams(uuidParamSchema), validate(cancelMyOrderSchema), orderController.cancelMyOrder)
router.post('/:id/received', authenticateToken, validateParams(uuidParamSchema), validate(markAsReceivedSchema), orderController.markAsReceived)
router.post('/:id/refund-request', authenticateToken, validateParams(uuidParamSchema), validate(createRefundRequestSchema), orderController.createRefundRequest)

// Create new order (requires authentication)
router.post('/', authenticateToken, validate(createOrderSchema), orderController.createOrder)

module.exports = router
