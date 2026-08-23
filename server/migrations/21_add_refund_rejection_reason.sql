-- =============================================
-- MIGRATION 21: Add rejection_reason to refund_requests
-- Fixes missing column referenced by refundService.js
-- and orderService.js getUserOrders
-- =============================================

ALTER TABLE refund_requests
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
