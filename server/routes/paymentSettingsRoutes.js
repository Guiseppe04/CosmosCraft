const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');

const { ensurePaymentSettingsTable } = require('../services/paymentSettingsService');

// GET /api/payment-settings - Public route to fetch payment settings for checkout
router.get('/', async (req, res) => {
  try {
    await ensurePaymentSettingsTable();
    const result = await pool.query(
      'SELECT id, bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, bank_transfer_qr_image_url, bank_transfer_display_mode, notes, pickup_storage_fee, no_show_grace_minutes, updated_at FROM payment_settings WHERE id = 1'
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
          bank_transfer_qr_image_url: '',
          bank_transfer_display_mode: 'details',
          notes: '',
          pickup_storage_fee: 0,
          no_show_grace_minutes: 30,
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
    const { bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, bank_transfer_qr_image_url, bank_transfer_display_mode, notes } = req.body;
    if (bank_transfer_display_mode !== undefined && !['details', 'qr'].includes(bank_transfer_display_mode)) {
      return res.status(400).json({ success: false, message: 'Bank transfer display mode must be QR or bank details.' });
    }
    let pickupStorageFee = null;
    if (req.body.pickup_storage_fee !== undefined) {
      pickupStorageFee = Number(req.body.pickup_storage_fee);
      if (!Number.isFinite(pickupStorageFee) || pickupStorageFee < 0) {
        return res.status(400).json({ success: false, message: 'Pickup storage fee must be a non-negative amount.' });
      }
    }
    
    let graceMinutes = null;
    if (req.body.no_show_grace_minutes !== undefined) {
      graceMinutes = Number(req.body.no_show_grace_minutes);
      if (req.body.no_show_grace_minutes === '' || !Number.isInteger(graceMinutes) || graceMinutes < 0 || graceMinutes > 1440) {
        return res.status(400).json({ success: false, message: 'No-show grace period must be a whole number from 0 to 1440 minutes.' });
      }
    }
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
        pickup_storage_fee = COALESCE($8, pickup_storage_fee),
        bank_transfer_qr_image_url = COALESCE($9, bank_transfer_qr_image_url),
        bank_transfer_display_mode = COALESCE($10, bank_transfer_display_mode),
        no_show_grace_minutes = COALESCE($11, no_show_grace_minutes),
        updated_at = NOW()
       WHERE id = 1
       RETURNING *`,
      [bank_name, account_name, account_number, gcash_number, maya_number, qr_image_url, notes, pickupStorageFee, bank_transfer_qr_image_url, bank_transfer_display_mode, graceMinutes]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating payment settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update payment settings' });
  }
});

module.exports = router;