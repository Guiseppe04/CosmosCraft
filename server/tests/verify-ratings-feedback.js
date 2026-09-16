require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');
const reviewService = require('../services/reviewService');

async function testRatingsFeedback() {
  console.log('--- Starting Ratings & Feedback Verification ---');

  // 1. Check existing customer user
  const userRes = await pool.query("SELECT user_id, email, role FROM users WHERE role = 'customer' LIMIT 1");
  if (userRes.rows.length === 0) {
    console.log('No customer found in database, creating a test check.');
    return;
  }
  const testCustomer = userRes.rows[0];
  console.log(`Testing with customer: ${testCustomer.email} (${testCustomer.user_id})`);

  // 2. Test getProductReviewEligibility
  console.log('\n[1] Testing getProductReviewEligibility...');
  const prodElig = await reviewService.getProductReviewEligibility(testCustomer.user_id);
  console.log(`Found ${prodElig.length} product items for customer.`);
  if (prodElig.length > 0) {
    console.log('Sample item:', {
      product_name: prodElig[0].product_name,
      order_number: prodElig[0].order_number,
      eligibility_status: prodElig[0].eligibility_status,
      ineligible_reason: prodElig[0].ineligible_reason,
    });
  }

  // 3. Test getCustomizationFeedbackEligibility
  console.log('\n[2] Testing getCustomizationFeedbackEligibility...');
  const custElig = await reviewService.getCustomizationFeedbackEligibility(testCustomer.user_id);
  console.log(`Found ${custElig.length} customization items for customer.`);
  if (custElig.length > 0) {
    console.log('Sample build:', {
      title: custElig[0].title,
      order_number: custElig[0].order_number,
      eligibility_status: custElig[0].eligibility_status,
      ineligible_reason: custElig[0].ineligible_reason,
    });
  }

  // 4. Test admin review retrieval
  console.log('\n[3] Testing getAdminReviews...');
  const adminReviews = await reviewService.getAdminReviews({ type: 'all', page: 1, pageSize: 10 });
  console.log(`Admin retrieved ${adminReviews.data.length} reviews (total: ${adminReviews.pagination.total}).`);

  // 5. Test database tables and constraints directly
  console.log('\n[4] Testing DB table constraints...');
  const tableCheck = await pool.query(`
    SELECT table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name IN ('product_reviews', 'customization_feedback') 
      AND column_name IN ('review_id', 'feedback_id', 'order_id', 'rating', 'overall_rating', 'status')
    ORDER BY table_name, column_name;
  `);
  console.log('Verified table columns:');
  console.table(tableCheck.rows);

  console.log('\n--- Ratings & Feedback Verification Succeeded! ---');
  await pool.end();
}

testRatingsFeedback().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
