-- Existing inspection history remains unknown; do not infer a claim outcome.
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS claim_verified BOOLEAN;
