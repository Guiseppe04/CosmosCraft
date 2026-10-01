ALTER TABLE customizations
  ADD COLUMN IF NOT EXISTS body_model VARCHAR(80);

CREATE INDEX IF NOT EXISTS idx_customizations_body_model
  ON customizations(body_model)
  WHERE body_model IS NOT NULL;