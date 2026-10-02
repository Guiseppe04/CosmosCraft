ALTER TABLE payment_settings
  ADD COLUMN IF NOT EXISTS bank_transfer_display_mode VARCHAR(20) NOT NULL DEFAULT 'details';