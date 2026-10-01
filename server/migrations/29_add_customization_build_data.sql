ALTER TABLE customizations
  ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stickers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS preview_image TEXT;
