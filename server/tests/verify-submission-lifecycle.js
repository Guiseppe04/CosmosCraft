require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/database');
const reviewService = require('../services/reviewService');

async function testLifecycle() {
  console.log('--- Testing Review Submission & Moderation Lifecycle ---');

  const userRes = await pool.query("SELECT user_id, email FROM users WHERE role = 'customer' LIMIT 1");
  const adminRes = await pool.query("SELECT user_id, email FROM users WHERE role IN ('admin', 'super_admin') LIMIT 1");
  const testCustomer = userRes.rows[0];
  const testAdmin = adminRes.rows[0];

  // 1. Get eligible product item
  const eligibleItems = await reviewService.getProductReviewEligibility(testCustomer.user_id);
  const eligibleItem = eligibleItems.find(i => i.eligibility_status === 'eligible');

  if (!eligibleItem) {
    console.log('No eligible item to submit review for. All items already reviewed or none found.');
    await pool.end();
    return;
  }

  console.log(`Submitting review for item ${eligibleItem.product_name} (${eligibleItem.order_item_id})...`);
  const createdReview = await reviewService.createProductReview(testCustomer.user_id, {
    order_id: eligibleItem.order_id,
    order_item_id: eligibleItem.order_item_id,
    rating: 5,
    title: 'Outstanding quality and precision',
    comment: 'The craftsmanship exceeded my expectations. High quality materials, fast fulfillment!',
    images: ['https://res.cloudinary.com/test/image/upload/v1/review_sample.jpg'],
  });
  console.log('Review created successfully! Review ID:', createdReview.review_id);

  // 2. Check updated eligibility - should now be 'reviewed'
  const updatedElig = await reviewService.getProductReviewEligibility(testCustomer.user_id);
  const reviewedItem = updatedElig.find(i => i.order_item_id === eligibleItem.order_item_id);
  console.log('Updated item status:', reviewedItem.eligibility_status);
  if (reviewedItem.eligibility_status !== 'reviewed') {
    throw new Error('Expected eligibility_status to be reviewed');
  }
  console.log('Reviewed data attached:', {
    rating: reviewedItem.review.rating,
    title: reviewedItem.review.title,
    comment: reviewedItem.review.comment,
  });

  // 3. Test edit review
  console.log('\nEditing review...');
  const updatedReview = await reviewService.updateProductReview(testCustomer.user_id, createdReview.review_id, {
    rating: 5,
    title: 'Outstanding quality and precision (Updated)',
    comment: 'The craftsmanship exceeded my expectations. High quality materials, fast fulfillment! Highly recommended.',
  });
  console.log('Review edited successfully:', updatedReview.title);

  // 4. Test admin moderation list & status update
  console.log('\nTesting Admin Moderation...');
  const adminList = await reviewService.getAdminReviews({ type: 'product', page: 1, pageSize: 5 });
  console.log(`Admin found ${adminList.data.length} reviews.`);

  console.log('Updating review status to approved with admin note...');
  const moderated = await reviewService.updateProductReviewStatus(
    createdReview.review_id,
    'approved',
    'Verified verified buyer purchase.',
    testAdmin.user_id
  );
  console.log('Moderated review status:', moderated.status, 'Admin notes:', moderated.admin_notes);

  // 5. Clean up test review
  console.log('\nCleaning up test review...');
  await reviewService.deleteProductReview(createdReview.review_id);
  console.log('Test review cleaned up successfully.');

  console.log('\n--- Lifecycle Test Passed Completely! ---');
  await pool.end();
}

testLifecycle().catch(err => {
  console.error('Lifecycle test failed:', err);
  process.exit(1);
});
