-- Neutral review records only. No eligibility, refund amount, or status changes.
ALTER TABLE refund_requests ADD COLUMN IF NOT EXISTS review_data JSONB NOT NULL DEFAULT '{}'::jsonb;
CREATE TABLE IF NOT EXISTS refund_policy_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  draft JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(user_id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO refund_policy_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
REVOKE ALL ON refund_policy_settings FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON refund_policy_settings FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON refund_policy_settings FROM authenticated;
  END IF;
END $$;
