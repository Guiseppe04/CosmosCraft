const { pool } = require('../config/database');
// Ensure the payment_settings table exists with a default row
let paymentSettingsTableReady = false;

const initializePaymentSettingsTable = async () => {
  if (paymentSettingsTableReady) return;
  try {
    const checkRes = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'payment_settings'
         AND table_schema = current_schema()`
    );
    if (checkRes.rows.length === 0) {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS payment_settings (
          id INTEGER PRIMARY KEY DEFAULT 1,
          bank_name VARCHAR(255) NOT NULL DEFAULT '',
          account_name VARCHAR(255) NOT NULL DEFAULT '',
          account_number VARCHAR(255) NOT NULL DEFAULT '',
          gcash_number VARCHAR(255) NOT NULL DEFAULT '',
          maya_number VARCHAR(255) NOT NULL DEFAULT '',
          qr_image_url TEXT NOT NULL DEFAULT '',
          bank_transfer_qr_image_url TEXT NOT NULL DEFAULT '',
          bank_transfer_display_mode VARCHAR(20) NOT NULL DEFAULT 'details',
          notes TEXT NOT NULL DEFAULT '',
          pickup_storage_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(
        `INSERT INTO payment_settings (id, bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes)
         VALUES (1, '', '', '', '', '', '', '')
         ON CONFLICT (id) DO NOTHING`
      );
    }
    await pool.query(
      'ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS pickup_storage_fee NUMERIC(12, 2) NOT NULL DEFAULT 0'
    );
    await pool.query(
      "ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS bank_transfer_qr_image_url TEXT NOT NULL DEFAULT ''"
    );
    await pool.query(
      "ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS bank_transfer_display_mode VARCHAR(20) NOT NULL DEFAULT 'details'"
    );
    await pool.query('ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS no_show_grace_minutes INTEGER NOT NULL DEFAULT 30 CHECK (no_show_grace_minutes BETWEEN 0 AND 1440)');
    await pool.query(
      `INSERT INTO payment_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
    );
    paymentSettingsTableReady = true;
  } catch (err) {
    console.warn('Could not create payment_settings table (may already exist):', err.message);
    throw err;
  }
};

let initialization = null;
const ensurePaymentSettingsTable = async () => {
  if (paymentSettingsTableReady) return;
  if (!initialization) {
    initialization = initializePaymentSettingsTable().finally(() => { initialization = null; });
  }
  return initialization;
};
module.exports = { ensurePaymentSettingsTable };
