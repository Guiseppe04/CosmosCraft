ALTER TABLE appointment_refunds
  ADD COLUMN IF NOT EXISTS destination_type TEXT NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS qr_code_url TEXT,
  ALTER COLUMN account_holder DROP NOT NULL,
  ALTER COLUMN account_number DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'appointment_refunds'::regclass AND conname = 'appointment_refunds_destination_check') THEN
    ALTER TABLE appointment_refunds ADD CONSTRAINT appointment_refunds_destination_check CHECK (
      (destination_type = 'account' AND NULLIF(BTRIM(account_holder), '') IS NOT NULL AND NULLIF(BTRIM(account_number), '') IS NOT NULL AND qr_code_url IS NULL)
      OR
      (destination_type = 'qr' AND qr_code_url IS NOT NULL AND qr_code_url LIKE 'https://%' AND account_holder IS NULL AND account_number IS NULL)
    );
  END IF;
END;
$$;
