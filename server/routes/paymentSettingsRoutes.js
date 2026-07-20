const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

// Ensure the payment_settings table exists with a default row
async function ensurePaymentSettingsTable() {
  await pool.query(`
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
    )
  `);
  await pool.query(`
    INSERT INTO payment_settings (id, bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes)
    VALUES (1, '', '', '', '', '', '', '')
    ON CONFLICT (id) DO NOTHING
  `);
}

// GET /api/payment-settings - Public route to fetch payment settings for checkout
router.get('/', async (req, res) => {
  try {
    await ensurePaymentSettingsTable();
    const result = await pool.query(
      'SELECT id, bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes, updated_at FROM payment_settings WHERE id = 1'
    );
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          bank_name: '',
          account_name: '',
          account_number: '',
          gcash_number: '',
          maya_number: '',
          qr_image_url: '',
          notes: '',
        }
      });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch payment settings' });
  }
});

// PUT /api/payment-settings - Admin-only route to update payment settings
router.put('/', authenticateToken, authorize('admin', 'super_admin'), async (req, res) => {
  try {
    const { bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes } = req.body;
    
    // Ensure table and default row exist
    await ensurePaymentSettingsTable();

    const result = await pool.query(
      `UPDATE payment_settings SET
        bank_name = COALESCE($1, bank_name),
        account_name = COALESCE($2, account_name),
        account_number = COALESCE($3, account_number),
        gcash_number = COALESCE($4, gcash_number),
        maya_number = COALESCE($5, maya_number),
        qr_image_url = COALESCE($6, qr_image_url),
        notes = COALESCE($7, notes),
        updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment settings' });
  }
});

module.exports = router;