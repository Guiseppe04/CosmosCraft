const { pool } = require('../config/database');

/**
 * Review & Feedback Service
 * Handles eligibility verification, customer submissions, edits, and admin moderation.
 */
class ReviewService {
  /**
   * Get product review eligibility for a customer
   * @param {string} userId - Authenticated user UUID
   */
  async getProductReviewEligibility(userId) {
    const query = `
      SELECT 
        oi.order_item_id,
        oi.order_id,
        oi.product_id,
        oi.product_name,
        oi.quantity,
        oi.unit_price,
        o.order_number,
        o.status AS order_status,
        o.payment_status AS order_payment_status,
        o.created_at AS order_created_at,
        o.received_at,
        o.delivered_at,
        p.name AS catalog_product_name,
        p.sku AS product_sku,
        (
          SELECT image_url 
          FROM product_images pi 
          WHERE pi.product_id = oi.product_id AND pi.deleted_at IS NULL 
          ORDER BY pi.is_primary DESC, pi.created_at ASC 
          LIMIT 1
        ) AS product_image,
        pr.review_id,
        pr.rating AS review_rating,
        pr.title AS review_title,
        pr.comment AS review_comment,
        pr.images AS review_images,
        pr.status AS review_status,
        pr.created_at AS review_created_at,
        pr.updated_at AS review_updated_at,
        -- Check if item has an approved refund
        EXISTS (
          SELECT 1 
          FROM refund_requests rr
          JOIN refund_request_items rri ON rri.refund_request_id = rr.refund_request_id
          WHERE rri.order_item_id = oi.order_item_id 
            AND rr.status IN ('approved', 'refunded', 'processing')
        ) AS is_item_refunded
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      LEFT JOIN products p ON p.product_id = oi.product_id
      LEFT JOIN product_reviews pr ON pr.order_item_id = oi.order_item_id AND pr.deleted_at IS NULL
      WHERE o.user_id = $1
        AND oi.product_id IS NOT NULL
        AND oi.deleted_at IS NULL
        AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC, oi.order_item_id DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    const items = rows.map(row => {
      const isFulfilled = ['received', 'delivered', 'completed'].includes(String(row.order_status).toLowerCase());
      const isOrderRefunded = String(row.order_payment_status).toLowerCase() === 'refunded' || row.is_item_refunded;
      const hasReview = Boolean(row.review_id);

      let eligibilityStatus = 'ineligible';
      let ineligibleReason = null;

      if (hasReview) {
        eligibilityStatus = 'reviewed';
      } else if (!isFulfilled) {
        eligibilityStatus = 'ineligible';
        ineligibleReason = 'Your order must be delivered and received before you can leave a review.';
      } else if (isOrderRefunded) {
        eligibilityStatus = 'ineligible';
        ineligibleReason = 'This order or item was refunded and is not eligible for review.';
      } else {
        eligibilityStatus = 'eligible';
      }

      return {
        order_item_id: row.order_item_id,
        order_id: row.order_id,
        product_id: row.product_id,
        product_name: row.product_name || row.catalog_product_name || 'Product',
        product_sku: row.product_sku || '',
        product_image: row.product_image || null,
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        order_number: row.order_number,
        order_status: row.order_status,
        order_created_at: row.order_created_at,
        purchased_date: row.order_created_at,
        fulfilled_date: row.received_at || row.delivered_at || null,
        eligibility_status: eligibilityStatus,
        ineligible_reason: ineligibleReason,
        review: hasReview ? {
          review_id: row.review_id,
          rating: Number(row.review_rating),
          title: row.review_title,
          comment: row.review_comment,
          images: row.review_images || [],
          status: row.review_status,
          created_at: row.review_created_at,
          updated_at: row.review_updated_at,
        } : null,
      };
    });

    // Priority sort: eligible first, then reviewed, then ineligible
    const priority = { eligible: 0, reviewed: 1, ineligible: 2 };
    items.sort((a, b) => {
      const pDiff = priority[a.eligibility_status] - priority[b.eligibility_status];
      if (pDiff !== 0) return pDiff;
      return new Date(b.order_created_at) - new Date(a.order_created_at);
    });

    return items;
  }

  /**
   * Get customization feedback eligibility for a customer
   * @param {string} userId - Authenticated user UUID
   */
  async getCustomizationFeedbackEligibility(userId) {
    const query = `
      SELECT 
        o.order_id,
        o.order_number,
        o.order_type,
        o.status AS order_status,
        o.payment_status AS order_payment_status,
        o.customization_status,
        o.created_at AS order_created_at,
        o.received_at,
        o.delivered_at,
        p.project_id,
        p.title AS project_title,
        p.status AS project_status,
        p.fulfillment_status AS project_fulfillment_status,
        p.ready_for_pickup_at,
        p.picked_up_at,
        p.shipped_at,
        cf.feedback_id,
        cf.overall_rating,
        cf.build_quality_rating,
        cf.communication_rating,
        cf.accuracy_rating,
        cf.comment AS feedback_comment,
        cf.images AS feedback_images,
        cf.status AS feedback_status,
        cf.created_at AS feedback_created_at,
        cf.updated_at AS feedback_updated_at
      FROM orders o
      LEFT JOIN projects p ON p.order_id = o.order_id AND p.deleted_at IS NULL
      LEFT JOIN customization_feedback cf ON cf.order_id = o.order_id AND cf.deleted_at IS NULL
      WHERE o.user_id = $1
        AND (o.order_type = 'customization' OR p.project_id IS NOT NULL)
        AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC;
    `;

    const { rows } = await pool.query(query, [userId]);

    const items = rows.map(row => {
      const isCompleted = row.project_status === 'completed' || row.customization_status === 'fulfilled';
      const isFulfilled = ['received', 'delivered', 'picked_up'].includes(String(row.project_fulfillment_status).toLowerCase())
        || row.customization_status === 'fulfilled'
        || ['received', 'delivered', 'completed'].includes(String(row.order_status).toLowerCase());
      const isCancelledOrRefunded = row.order_status === 'cancelled'
        || row.customization_status === 'cancelled'
        || row.order_payment_status === 'refunded';
      const hasFeedback = Boolean(row.feedback_id);

      let eligibilityStatus = 'ineligible';
      let ineligibleReason = null;

      if (hasFeedback) {
        eligibilityStatus = 'reviewed';
      } else if (isCancelledOrRefunded) {
        eligibilityStatus = 'ineligible';
        ineligibleReason = 'This customization order was cancelled or refunded.';
      } else if (!isCompleted || !isFulfilled) {
        eligibilityStatus = 'ineligible';
        ineligibleReason = 'Your customization must be completed and fulfilled before you can leave feedback.';
      } else {
        eligibilityStatus = 'eligible';
      }

      const fulfilledDate = row.picked_up_at || row.received_at || row.delivered_at || row.shipped_at || null;

      return {
        order_id: row.order_id,
        order_number: row.order_number,
        project_id: row.project_id || null,
        title: row.project_title || 'Custom Guitar Build',
        order_created_at: row.order_created_at,
        fulfilled_date: fulfilledDate,
        eligibility_status: eligibilityStatus,
        ineligible_reason: ineligibleReason,
        feedback: hasFeedback ? {
          feedback_id: row.feedback_id,
          overall_rating: Number(row.overall_rating),
          build_quality_rating: Number(row.build_quality_rating),
          communication_rating: Number(row.communication_rating),
          accuracy_rating: Number(row.accuracy_rating),
          comment: row.feedback_comment,
          images: row.feedback_images || [],
          status: row.feedback_status,
          created_at: row.feedback_created_at,
          updated_at: row.feedback_updated_at,
        } : null,
      };
    });

    const priority = { eligible: 0, reviewed: 1, ineligible: 2 };
    items.sort((a, b) => {
      const pDiff = priority[a.eligibility_status] - priority[b.eligibility_status];
      if (pDiff !== 0) return pDiff;
      return new Date(b.order_created_at) - new Date(a.order_created_at);
    });

    return items;
  }

  /**
   * Submit a new product review
   */
  async createProductReview(userId, { order_id, order_item_id, rating, title, comment, images = [] }) {
    // 1. Verify item and order ownership
    const itemQuery = `
      SELECT 
        oi.order_item_id,
        oi.order_id,
        oi.product_id,
        o.user_id,
        o.status AS order_status,
        o.payment_status AS order_payment_status,
        (
          SELECT COUNT(*) 
          FROM refund_requests rr
          JOIN refund_request_items rri ON rri.refund_request_id = rr.refund_request_id
          WHERE rri.order_item_id = oi.order_item_id 
            AND rr.status IN ('approved', 'refunded', 'processing')
        ) AS refund_count
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      WHERE oi.order_item_id = $1 AND o.order_id = $2
        AND oi.deleted_at IS NULL AND o.deleted_at IS NULL;
    `;
    const { rows: itemRows } = await pool.query(itemQuery, [order_item_id, order_id]);
    if (itemRows.length === 0) {
      const err = new Error('Purchased item not found in your orders.');
      err.statusCode = 404;
      throw err;
    }

    const item = itemRows[0];
    if (item.user_id !== userId) {
      const err = new Error('You can only review items that you have purchased.');
      err.statusCode = 403;
      throw err;
    }

    if (!item.product_id) {
      const err = new Error('Only catalog products can receive a product review.');
      err.statusCode = 400;
      throw err;
    }

    const isFulfilled = ['received', 'delivered', 'completed'].includes(String(item.order_status).toLowerCase());
    if (!isFulfilled) {
      const err = new Error('Your order must be delivered and received before you can leave a review.');
      err.statusCode = 400;
      throw err;
    }

    if (item.order_payment_status === 'refunded' || Number(item.refund_count) > 0) {
      const err = new Error('This item was refunded and cannot be reviewed.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Check if review already exists
    const existingCheck = await pool.query(
      'SELECT review_id FROM product_reviews WHERE order_item_id = $1 AND deleted_at IS NULL',
      [order_item_id]
    );
    if (existingCheck.rows.length > 0) {
      const err = new Error('You have already submitted a review for this item.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Insert review
    const insertQuery = `
      INSERT INTO product_reviews (
        order_id,
        order_item_id,
        product_id,
        user_id,
        rating,
        title,
        comment,
        images,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'approved')
      RETURNING *;
    `;
    const { rows: inserted } = await pool.query(insertQuery, [
      order_id,
      order_item_id,
      item.product_id,
      userId,
      rating,
      title || null,
      comment,
      JSON.stringify(images || []),
    ]);

    return inserted[0];
  }

  /**
   * Update an existing product review
   */
  async updateProductReview(userId, reviewId, { rating, title, comment, images }) {
    const existing = await pool.query(
      'SELECT * FROM product_reviews WHERE review_id = $1 AND deleted_at IS NULL',
      [reviewId]
    );
    if (existing.rows.length === 0) {
      const err = new Error('Review not found.');
      err.statusCode = 404;
      throw err;
    }

    const current = existing.rows[0];
    if (current.user_id !== userId) {
      const err = new Error('You can only edit your own reviews.');
      err.statusCode = 403;
      throw err;
    }

    const newRating = rating !== undefined ? rating : current.rating;
    const newTitle = title !== undefined ? title : current.title;
    const newComment = comment !== undefined ? comment : current.comment;
    const newImages = images !== undefined
      ? JSON.stringify(images || [])
      : (typeof current.images === 'string' ? current.images : JSON.stringify(current.images || []));

    const updateQuery = `
      UPDATE product_reviews
      SET 
        rating = $1,
        title = $2,
        comment = $3,
        images = $4,
        updated_at = now()
      WHERE review_id = $5
      RETURNING *;
    `;
    const { rows } = await pool.query(updateQuery, [newRating, newTitle, newComment, newImages, reviewId]);
    return rows[0];
  }

  /**
   * Submit customization feedback
   */
  async createCustomizationFeedback(userId, {
    order_id,
    overall_rating,
    build_quality_rating,
    communication_rating,
    accuracy_rating,
    comment,
    images = []
  }) {
    // 1. Verify customization order ownership
    const orderQuery = `
      SELECT 
        o.order_id,
        o.user_id,
        o.order_type,
        o.status AS order_status,
        o.payment_status AS order_payment_status,
        o.customization_status,
        p.project_id,
        p.status AS project_status,
        p.fulfillment_status AS project_fulfillment_status
      FROM orders o
      LEFT JOIN projects p ON p.order_id = o.order_id AND p.deleted_at IS NULL
      WHERE o.order_id = $1 AND o.deleted_at IS NULL;
    `;
    const { rows: orderRows } = await pool.query(orderQuery, [order_id]);
    if (orderRows.length === 0) {
      const err = new Error('Customization order not found.');
      err.statusCode = 404;
      throw err;
    }

    const order = orderRows[0];
    if (order.user_id !== userId) {
      const err = new Error('You can only leave feedback on your own customization orders.');
      err.statusCode = 403;
      throw err;
    }

    const isCompleted = order.project_status === 'completed' || order.customization_status === 'fulfilled';
    const isFulfilled = ['received', 'delivered', 'picked_up'].includes(String(order.project_fulfillment_status).toLowerCase())
      || order.customization_status === 'fulfilled'
      || ['received', 'delivered', 'completed'].includes(String(order.order_status).toLowerCase());
    const isCancelledOrRefunded = order.order_status === 'cancelled'
      || order.customization_status === 'cancelled'
      || order.order_payment_status === 'refunded';

    if (isCancelledOrRefunded) {
      const err = new Error('This customization order was cancelled or refunded and cannot receive feedback.');
      err.statusCode = 400;
      throw err;
    }

    if (!isCompleted || !isFulfilled) {
      const err = new Error('Your customization must be completed and fulfilled before you can leave feedback.');
      err.statusCode = 400;
      throw err;
    }

    // 2. Check if feedback already exists
    const existingCheck = await pool.query(
      'SELECT feedback_id FROM customization_feedback WHERE order_id = $1 AND deleted_at IS NULL',
      [order_id]
    );
    if (existingCheck.rows.length > 0) {
      const err = new Error('You have already submitted feedback for this customization order.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Insert feedback
    const insertQuery = `
      INSERT INTO customization_feedback (
        order_id,
        project_id,
        user_id,
        overall_rating,
        build_quality_rating,
        communication_rating,
        accuracy_rating,
        comment,
        images,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'approved')
      RETURNING *;
    `;
    const { rows: inserted } = await pool.query(insertQuery, [
      order_id,
      order.project_id || null,
      userId,
      overall_rating,
      build_quality_rating,
      communication_rating,
      accuracy_rating,
      comment,
      JSON.stringify(images || []),
    ]);

    return inserted[0];
  }

  /**
   * Update existing customization feedback
   */
  async updateCustomizationFeedback(userId, feedbackId, {
    overall_rating,
    build_quality_rating,
    communication_rating,
    accuracy_rating,
    comment,
    images
  }) {
    const existing = await pool.query(
      'SELECT * FROM customization_feedback WHERE feedback_id = $1 AND deleted_at IS NULL',
      [feedbackId]
    );
    if (existing.rows.length === 0) {
      const err = new Error('Feedback not found.');
      err.statusCode = 404;
      throw err;
    }

    const current = existing.rows[0];
    if (current.user_id !== userId) {
      const err = new Error('You can only edit your own feedback.');
      err.statusCode = 403;
      throw err;
    }

    const newOverall = overall_rating !== undefined ? overall_rating : current.overall_rating;
    const newBuildQuality = build_quality_rating !== undefined ? build_quality_rating : current.build_quality_rating;
    const newCommunication = communication_rating !== undefined ? communication_rating : current.communication_rating;
    const newAccuracy = accuracy_rating !== undefined ? accuracy_rating : current.accuracy_rating;
    const newComment = comment !== undefined ? comment : current.comment;
    const newImages = images !== undefined
      ? JSON.stringify(images || [])
      : (typeof current.images === 'string' ? current.images : JSON.stringify(current.images || []));

    const updateQuery = `
      UPDATE customization_feedback
      SET 
        overall_rating = $1,
        build_quality_rating = $2,
        communication_rating = $3,
        accuracy_rating = $4,
        comment = $5,
        images = $6,
        updated_at = now()
      WHERE feedback_id = $7
      RETURNING *;
    `;
    const { rows } = await pool.query(updateQuery, [
      newOverall,
      newBuildQuality,
      newCommunication,
      newAccuracy,
      newComment,
      newImages,
      feedbackId,
    ]);
    return rows[0];
  }

  /**
   * Public: Get approved reviews for a specific product
   */
  async getPublicProductReviews(productId) {
    const query = `
      SELECT 
        pr.review_id,
        pr.rating,
        pr.title,
        pr.comment,
        pr.images,
        pr.created_at,
        COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS user_name,
        u.avatar_url AS user_avatar
      FROM product_reviews pr
      JOIN users u ON u.user_id = pr.user_id
      WHERE pr.product_id = $1
        AND pr.status = 'approved'
        AND pr.deleted_at IS NULL
      ORDER BY pr.created_at DESC;
    `;
    const { rows } = await pool.query(query, [productId]);

    const totalReviews = rows.length;
    const avgRating = totalReviews > 0
      ? rows.reduce((acc, r) => acc + Number(r.rating), 0) / totalReviews
      : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach(r => {
      const star = Number(r.rating);
      if (distribution[star] !== undefined) distribution[star]++;
    });

    return {
      reviews: rows,
      summary: {
        totalReviews,
        averageRating: Number(avgRating.toFixed(1)),
        distribution,
      },
    };
  }

  /**
   * Admin: List all product reviews & customization feedback with filtering
   */
  async getAdminReviews({ type = 'all', status, search, page = 1, pageSize = 20 }) {
    const offset = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    let productReviews = [];
    let customizationFeedback = [];

    // Fetch product reviews if requested
    if (type === 'all' || type === 'product') {
      let pQuery = `
        SELECT 
          'product' AS feedback_type,
          pr.review_id AS id,
          pr.order_id,
          pr.order_item_id,
          pr.product_id,
          pr.user_id,
          pr.rating,
          NULL::smallint AS build_quality_rating,
          NULL::smallint AS communication_rating,
          NULL::smallint AS accuracy_rating,
          pr.title,
          pr.comment,
          pr.images,
          pr.status,
          pr.admin_notes,
          pr.moderated_at,
          pr.created_at,
          pr.updated_at,
          o.order_number,
          p.name AS target_name,
          p.sku AS target_sku,
          u.email AS user_email,
          COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS user_full_name
        FROM product_reviews pr
        JOIN orders o ON o.order_id = pr.order_id
        LEFT JOIN products p ON p.product_id = pr.product_id
        LEFT JOIN users u ON u.user_id = pr.user_id
        WHERE pr.deleted_at IS NULL
      `;
      const pParams = [];

      if (status && status !== 'all') {
        pParams.push(status);
        pQuery += ` AND pr.status = $${pParams.length}`;
      }
      if (search && search.trim() && search.trim() !== 'undefined') {
        pParams.push(`%${search.trim()}%`);
        pQuery += ` AND (o.order_number ILIKE $${pParams.length} OR p.name ILIKE $${pParams.length} OR pr.comment ILIKE $${pParams.length} OR u.email ILIKE $${pParams.length})`;
      }
      pQuery += ' ORDER BY pr.created_at DESC';

      const res = await pool.query(pQuery, pParams);
      productReviews = res.rows;
    }

    // Fetch customization feedback if requested
    if (type === 'all' || type === 'customization') {
      let cQuery = `
        SELECT 
          'customization' AS feedback_type,
          cf.feedback_id AS id,
          cf.order_id,
          NULL::bigint AS order_item_id,
          NULL::uuid AS product_id,
          cf.user_id,
          cf.overall_rating AS rating,
          cf.build_quality_rating,
          cf.communication_rating,
          cf.accuracy_rating,
          'Custom Guitar Build' AS title,
          cf.comment,
          cf.images,
          cf.status,
          cf.admin_notes,
          cf.moderated_at,
          cf.created_at,
          cf.updated_at,
          o.order_number,
          COALESCE(proj.title, 'Custom Guitar Build') AS target_name,
          '' AS target_sku,
          u.email AS user_email,
          COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '') AS user_full_name
        FROM customization_feedback cf
        JOIN orders o ON o.order_id = cf.order_id
        LEFT JOIN projects proj ON proj.project_id = cf.project_id
        LEFT JOIN users u ON u.user_id = cf.user_id
        WHERE cf.deleted_at IS NULL
      `;
      const cParams = [];

      if (status && status !== 'all') {
        cParams.push(status);
        cQuery += ` AND cf.status = $${cParams.length}`;
      }
      if (search && search.trim() && search.trim() !== 'undefined') {
        cParams.push(`%${search.trim()}%`);
        cQuery += ` AND (o.order_number ILIKE $${cParams.length} OR proj.title ILIKE $${cParams.length} OR cf.comment ILIKE $${cParams.length} OR u.email ILIKE $${cParams.length})`;
      }
      cQuery += ' ORDER BY cf.created_at DESC';

      const res = await pool.query(cQuery, cParams);
      customizationFeedback = res.rows;
    }

    const combined = [...productReviews, ...customizationFeedback];
    combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const total = combined.length;
    const paginated = combined.slice(offset, offset + limit);

    return {
      data: paginated,
      pagination: {
        page: Number(page),
        pageSize: limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin: Update product review moderation status
   */
  async updateProductReviewStatus(reviewId, status, adminNotes, adminUserId) {
    const query = `
      UPDATE product_reviews
      SET 
        status = $1,
        admin_notes = COALESCE($2, admin_notes),
        moderated_by = $3,
        moderated_at = now(),
        updated_at = now()
      WHERE review_id = $4 AND deleted_at IS NULL
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [status, adminNotes, adminUserId, reviewId]);
    if (rows.length === 0) {
      const err = new Error('Review not found.');
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  /**
   * Admin: Update customization feedback moderation status
   */
  async updateCustomizationFeedbackStatus(feedbackId, status, adminNotes, adminUserId) {
    const query = `
      UPDATE customization_feedback
      SET 
        status = $1,
        admin_notes = COALESCE($2, admin_notes),
        moderated_by = $3,
        moderated_at = now(),
        updated_at = now()
      WHERE feedback_id = $4 AND deleted_at IS NULL
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [status, adminNotes, adminUserId, feedbackId]);
    if (rows.length === 0) {
      const err = new Error('Feedback not found.');
      err.statusCode = 404;
      throw err;
    }
    return rows[0];
  }

  /**
   * Admin: Soft delete product review
   */
  async deleteProductReview(reviewId) {
    const query = `
      UPDATE product_reviews
      SET deleted_at = now()
      WHERE review_id = $1 AND deleted_at IS NULL
      RETURNING review_id;
    `;
    const { rows } = await pool.query(query, [reviewId]);
    if (rows.length === 0) {
      const err = new Error('Review not found.');
      err.statusCode = 404;
      throw err;
    }
    return { success: true };
  }

  /**
   * Admin: Soft delete customization feedback
   */
  async deleteCustomizationFeedback(feedbackId) {
    const query = `
      UPDATE customization_feedback
      SET deleted_at = now()
      WHERE feedback_id = $1 AND deleted_at IS NULL
      RETURNING feedback_id;
    `;
    const { rows } = await pool.query(query, [feedbackId]);
    if (rows.length === 0) {
      const err = new Error('Feedback not found.');
      err.statusCode = 404;
      throw err;
    }
    return { success: true };
  }
}

module.exports = new ReviewService();
