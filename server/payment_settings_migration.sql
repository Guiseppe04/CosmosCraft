-- Payment Settings table for Admin-managed payment receiver details
CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  bank_name VARCHAR(255) DEFAULT '',
  account_name VARCHAR(255) DEFAULT '',
  account_number VARCHAR(255) DEFAULT '',
  gcash_number VARCHAR(255) DEFAULT '',
  maya_number VARCHAR(255) DEFAULT '',
  qr_image_url TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO payment_settings (id, bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes)
VALUES (1, '', '', '', '', '', '', '')
ON CONFLICT (id) DO NOTHING;