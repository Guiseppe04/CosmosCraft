ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS bank_transfer_qr_image_url TEXT NOT NULL DEFAULT '';