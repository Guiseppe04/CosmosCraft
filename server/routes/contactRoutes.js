const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/database');
const { authenticateToken, authorize } = require('../middleware/auth');
const mailService = require('../services/mailService');
const { normalizePhMobile } = require('../utils/phone');
const { emitBroadcast } = require('../services/socketService');

const router = express.Router();
const DEFAULT_EMAIL = process.env.CONTACT_EMAIL || 'cosmosguitars@gmail.com';
const DEFAULT_PHONE = '+095213121581';

let settingsReady;
const ensureContactSettings = () => {
  if (!settingsReady) {
    settingsReady = pool.query(`
      CREATE TABLE IF NOT EXISTS contact_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        email VARCHAR(254) NOT NULL DEFAULT 'cosmosguitars@gmail.com',
        phone VARCHAR(64) NOT NULL DEFAULT '+095213121581',
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `).then(() => pool.query(
      `INSERT INTO contact_settings (id, email, phone)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_EMAIL, DEFAULT_PHONE]
    )).catch((error) => {
      settingsReady = null;
      throw error;
    });
  }
  return settingsReady;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const contactSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages. Please try again later.' },
});

router.get('/settings', async (req, res) => {
  try {
    await ensureContactSettings();
    const result = await pool.query('SELECT email, phone FROM contact_settings WHERE id = 1');
    res.json({ success: true, data: result.rows[0] || { email: DEFAULT_EMAIL, phone: DEFAULT_PHONE } });
  } catch (error) {
    console.error('Error fetching contact settings:', error);
    res.status(500).json({ success: false, message: 'Failed to load contact settings' });
  }
});

router.put('/settings', authenticateToken, authorize('admin', 'super_admin'), async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const phone = normalizePhMobile(req.body.phone);
  if (!isValidEmail(email) || email.length > 254) {
    return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  }
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Please enter 10 digits starting with 9 after +63.' });
  }

  try {
    await ensureContactSettings();
    const result = await pool.query(
      `UPDATE contact_settings SET email = $1, phone = $2, updated_at = NOW()
       WHERE id = 1 RETURNING email, phone`,
      [email, phone]
    );
    emitBroadcast('site-contact:updated', result.rows[0]);
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error saving contact settings:', error);
    res.status(500).json({ success: false, message: 'Failed to save contact settings' });
  }
});

router.post('/', contactSubmissionLimiter, async (req, res) => {
  const firstName = typeof req.body.firstName === 'string' ? req.body.firstName.trim() : '';
  const lastName = typeof req.body.lastName === 'string' ? req.body.lastName.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';

  if (!firstName || firstName.length > 100 || !lastName || lastName.length > 100 ||
      !isValidEmail(email) || email.length > 254 || !message || message.length > 5000) {
    return res.status(400).json({ success: false, message: 'Please provide your name, a valid email, and a message under 5,000 characters.' });
  }

  try {
    await ensureContactSettings();
    const settings = await pool.query('SELECT email FROM contact_settings WHERE id = 1');
    const recipient = settings.rows[0]?.email || DEFAULT_EMAIL;
    const fullName = `${firstName} ${lastName}`;

    await mailService.sendContactMessageEmail({
      to: recipient,
      replyTo: email,
      name: fullName,
      message,
    });

    res.status(200).json({ success: true, message: 'Your message has been sent.' });
  } catch (error) {
    console.error('Error sending contact message:', error);
    res.status(502).json({ success: false, message: 'We could not send your message right now. Please try again later.' });
  }
});

module.exports = router;
