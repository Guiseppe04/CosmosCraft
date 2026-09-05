const reviewService = require('../services/reviewService');

class ReviewController {
  // Customer: Get product review eligibility
  async getProductReviewEligibility(req, res, next) {
    try {
      const items = await reviewService.getProductReviewEligibility(req.user.user_id);
      res.status(200).json({
        status: 'success',
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Get customization feedback eligibility
  async getCustomizationFeedbackEligibility(req, res, next) {
    try {
      const items = await reviewService.getCustomizationFeedbackEligibility(req.user.user_id);
      res.status(200).json({
        status: 'success',
        data: { items },
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Create product review
  async createProductReview(req, res, next) {
    try {
      const review = await reviewService.createProductReview(req.user.user_id, req.body);
      res.status(201).json({
        status: 'success',
        message: 'Review submitted successfully.',
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Update product review
  async updateProductReview(req, res, next) {
    try {
      const review = await reviewService.updateProductReview(req.user.user_id, req.params.reviewId, req.body);
      res.status(200).json({
        status: 'success',
        message: 'Review updated successfully.',
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Create customization feedback
  async createCustomizationFeedback(req, res, next) {
    try {
      const feedback = await reviewService.createCustomizationFeedback(req.user.user_id, req.body);
      res.status(201).json({
        status: 'success',
        message: 'Feedback submitted successfully.',
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  }

  // Customer: Update customization feedback
  async updateCustomizationFeedback(req, res, next) {
    try {
      const feedback = await reviewService.updateCustomizationFeedback(req.user.user_id, req.params.feedbackId, req.body);
      res.status(200).json({
        status: 'success',
        message: 'Feedback updated successfully.',
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  }

  // Public: Get product reviews
  async getPublicProductReviews(req, res, next) {
    try {
      const result = await reviewService.getPublicProductReviews(req.params.productId);
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: List all reviews and feedback
  async getAdminReviews(req, res, next) {
    try {
      const result = await reviewService.getAdminReviews({
        type: req.query.type,
        status: req.query.status,
        search: req.query.search,
        page: req.query.page,
        pageSize: req.query.pageSize,
      });
      res.status(200).json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Moderate product review
  async updateProductReviewStatus(req, res, next) {
    try {
      const review = await reviewService.updateProductReviewStatus(
        req.params.reviewId,
        req.body.status,
        req.body.admin_notes,
        req.user.user_id
      );
      res.status(200).json({
        status: 'success',
        message: 'Review status updated.',
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Moderate customization feedback
  async updateCustomizationFeedbackStatus(req, res, next) {
    try {
      const feedback = await reviewService.updateCustomizationFeedbackStatus(
        req.params.feedbackId,
        req.body.status,
        req.body.admin_notes,
        req.user.user_id
      );
      res.status(200).json({
        status: 'success',
        message: 'Feedback status updated.',
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Delete product review
  async deleteProductReview(req, res, next) {
    try {
      await reviewService.deleteProductReview(req.params.reviewId);
      res.status(200).json({
        status: 'success',
        message: 'Review deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  // Admin: Delete customization feedback
  async deleteCustomizationFeedback(req, res, next) {
    try {
      await reviewService.deleteCustomizationFeedback(req.params.feedbackId);
      res.status(200).json({
        status: 'success',
        message: 'Feedback deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();
