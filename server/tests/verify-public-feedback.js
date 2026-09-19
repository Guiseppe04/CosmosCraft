require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');
const reviewService = require('../services/reviewService');
const productService = require('../services/productService');

async function verifyPublicFeedback() {
  console.log('=== VERIFYING PUBLIC FEEDBACK & RATING AGGREGATIONS ===\n');

  // 1. Test getPublicTestimonials
  console.log('[1] Testing reviewService.getPublicTestimonials()...');
  const testimonials = await reviewService.getPublicTestimonials({ limit: 10 });
  console.log(`Found ${testimonials.length} approved testimonials.`);
  if (testimonials.length > 0) {
    const sample = testimonials[0];
    console.log('Sample testimonial:', {
      feedback_type: sample.feedback_type,
      customer_name: sample.customer_name,
      rating: sample.rating,
      target_name: sample.target_name,
      comment: sample.comment?.slice(0, 50) + '...',
      has_email: 'user_email' in sample || 'email' in sample,
      has_order_id: 'order_id' in sample,
      has_admin_notes: 'admin_notes' in sample,
    });
    if ('user_email' in sample || 'email' in sample || 'admin_notes' in sample) {
      throw new Error('SECURITY VIOLATION: Sensitive data exposed in public testimonials!');
    }
  }

  // 2. Test productService.getAllProducts rating aggregation
  console.log('\n[2] Testing productService.getAllProducts() SQL rating aggregation...');
  const { items: products } = await productService.getAllProducts({ pageSize: 10, is_active: 'true' });
  console.log(`Retrieved ${products.length} products.`);
  if (products.length > 0) {
    const p = products[0];
    console.log('Sample product rating aggregates:', {
      name: p.name,
      average_rating: p.average_rating,
      review_count: p.review_count,
    });
    if (typeof p.average_rating !== 'number' || typeof p.review_count !== 'number') {
      throw new Error('average_rating or review_count is not a number!');
    }
  }

  // 3. Test getProductById rating aggregation
  if (products.length > 0) {
    console.log('\n[3] Testing productService.getProductById() with rating aggregation...');
    const singleProduct = await productService.getProductById(products[0].product_id);
    console.log('Single product rating check:', {
      name: singleProduct.name,
      average_rating: singleProduct.average_rating,
      review_count: singleProduct.review_count,
    });
  }

  // 4. Test getPublicProductReviews with public customer_name formatting
  if (products.length > 0) {
    console.log('\n[4] Testing reviewService.getPublicProductReviews()...');
    const pubReviews = await reviewService.getPublicProductReviews(products[0].product_id);
    console.log(`Product reviews count: ${pubReviews.reviews.length}, summary:`, pubReviews.summary);
    if (pubReviews.reviews.length > 0) {
      const r = pubReviews.reviews[0];
      console.log('Sample review customer name:', r.customer_name);
      if ('email' in r || 'admin_notes' in r) {
        throw new Error('SECURITY VIOLATION: Sensitive data in public product reviews!');
      }
    }
  }

  console.log('\n=== ALL BACKEND FEEDBACK VERIFICATIONS PASSED SUCCESSFULLY ===');
  await pool.end();
}

verifyPublicFeedback().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
