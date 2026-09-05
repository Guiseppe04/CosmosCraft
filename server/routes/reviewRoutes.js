const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticateToken, authorize } = require('../middleware/auth');
const {
  validate,
  validateParams,
  namedUuidParamSchema,
  createProductReviewSchema,
  updateProductReviewSchema,
  createCustomizationFeedbackSchema,
  updateCustomizationFeedbackSchema,
  updateReviewStatusSchema,
} = require('../utils/validation');

// --- CUSTOMER ELIGIBILITY & SUBMISSIONS ---
router.get(
  '/product-eligibility',
  authenticateToken,
  reviewController.getProductReviewEligibility
);

router.get(
  '/customization-eligibility',
  authenticateToken,
  reviewController.getCustomizationFeedbackEligibility
);

router.post(
  '/products',
  authenticateToken,
  validate(createProductReviewSchema),
  reviewController.createProductReview
);

router.put(
  '/products/:reviewId',
  authenticateToken,
  validateParams(namedUuidParamSchema('reviewId')),
  validate(updateProductReviewSchema),
  reviewController.updateProductReview
);

router.post(
  '/customizations',
  authenticateToken,
  validate(createCustomizationFeedbackSchema),
  reviewController.createCustomizationFeedback
);

router.put(
  '/customizations/:feedbackId',
  authenticateToken,
  validateParams(namedUuidParamSchema('feedbackId')),
  validate(updateCustomizationFeedbackSchema),
  reviewController.updateCustomizationFeedback
);

// --- PUBLIC PRODUCT REVIEWS ---
router.get(
  '/products/:productId/public',
  validateParams(namedUuidParamSchema('productId')),
  reviewController.getPublicProductReviews
);

// --- ADMIN MODERATION ROUTES ---
router.get(
  '/admin',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  reviewController.getAdminReviews
);

router.put(
  '/admin/product/:reviewId/status',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  validateParams(namedUuidParamSchema('reviewId')),
  validate(updateReviewStatusSchema),
  reviewController.updateProductReviewStatus
);

router.put(
  '/admin/customization/:feedbackId/status',
  authenticateToken,
  authorize('staff', 'admin', 'super_admin'),
  validateParams(namedUuidParamSchema('feedbackId')),
  validate(updateReviewStatusSchema),
  reviewController.updateCustomizationFeedbackStatus
);

router.delete(
  '/admin/product/:reviewId',
  authenticateToken,
  authorize('admin', 'super_admin'),
  validateParams(namedUuidParamSchema('reviewId')),
  reviewController.deleteProductReview
);

router.delete(
  '/admin/customization/:feedbackId',
  authenticateToken,
  authorize('admin', 'super_admin'),
  validateParams(namedUuidParamSchema('feedbackId')),
  reviewController.deleteCustomizationFeedback
);

module.exports = router;
