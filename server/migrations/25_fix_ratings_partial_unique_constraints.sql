-- ============================================================================
-- MIGRATION 25: Fix Ratings & Feedback Partial Unique Constraints
-- Convert strict unique constraints to partial unique indexes (WHERE deleted_at IS NULL)
-- to allow re-reviewing or re-testing after soft deletion.
-- ============================================================================

ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS uq_product_reviews_order_item;
DROP INDEX IF EXISTS uq_product_reviews_order_item;
CREATE UNIQUE INDEX IF NOT EXISTS uq_product_reviews_order_item ON product_reviews(order_item_id) WHERE deleted_at IS NULL;

ALTER TABLE customization_feedback DROP CONSTRAINT IF EXISTS uq_customization_feedback_order;
DROP INDEX IF EXISTS uq_customization_feedback_order;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customization_feedback_order ON customization_feedback(order_id) WHERE deleted_at IS NULL;
