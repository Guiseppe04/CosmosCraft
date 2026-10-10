const { asyncHandler } = require('../middleware/errorHandler');
const terms = require('../services/termsService');
const { pool } = require('../config/database');
exports.status = asyncHandler(async (req, res) => {
  const required = req.user.role === 'customer' && !await terms.hasAccountAcceptance(req.user.id);
  res.json({ status: 'success', data: { required, versions: terms.versions } });
});
exports.acceptAccount = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT terms_registration_pending FROM users WHERE user_id = $1 FOR UPDATE', [req.user.id]);
    await terms.recordAccount(req.user.id, req.body, rows[0]?.terms_registration_pending ? 'registration' : 'login', client);
    await client.query('UPDATE users SET terms_registration_pending = false WHERE user_id = $1', [req.user.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  res.json({ status: 'success' });
});
exports.acceptCheckout = asyncHandler(async (req, res) => {
  const checkoutId = await terms.recordCheckout(req.user.id, req.body);
  res.json({ status: 'success', data: { checkoutId } });
});
