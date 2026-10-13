const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const versions = require('../../shared/termsVersions.json');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateAgreement(agreement, types) {
  if (agreement?.agreed !== true || !types.length ||
      types.some(type => !versions[type] || agreement.versions?.[type] !== versions[type])) {
    throw new AppError('Please review and explicitly accept the current Terms and Conditions.', 400, [], 'TERMS_REQUIRED');
  }
}

async function hasAccountAcceptance(userId, db = pool) {
  const result = await db.query(
    "SELECT 1 FROM terms_acknowledgments WHERE user_id = $1 AND terms_type = 'account' AND terms_version = $2 LIMIT 1",
    [userId, versions.account]);
  return result.rows.length > 0;
}

async function recordAccount(userId, agreement, context, db = pool) {
  validateAgreement(agreement, ['account']);
  if (!['registration', 'login'].includes(context)) throw new AppError('Invalid agreement context', 400);
  await db.query(
    `INSERT INTO terms_acknowledgments (user_id, terms_type, terms_version, context)
     VALUES ($1, 'account', $2, $3) ON CONFLICT DO NOTHING`,
    [userId, versions.account, context]);
}

async function recordCheckout(userId, agreement) {
  const types = agreement?.types;
  if (!uuid.test(agreement?.checkoutId || '') || !Array.isArray(types) ||
      !types.length || types.length > 2 || new Set(types).size !== types.length ||
      types.some(type => !['orders', 'customization'].includes(type))) {
    throw new AppError('Invalid checkout agreement', 400);
  }
  validateAgreement(agreement, types);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const type of types) {
      await client.query(
        `INSERT INTO terms_acknowledgments (user_id, terms_type, terms_version, context, checkout_id)
         VALUES ($1, $2, $3, 'checkout', $4) ON CONFLICT DO NOTHING`,
        [userId, type, versions[type], agreement.checkoutId]);
    }
    const { rows } = await client.query(
      `SELECT terms_type, terms_version, order_id FROM terms_acknowledgments
       WHERE user_id = $1 AND checkout_id = $2 AND context = 'checkout'`,
      [userId, agreement.checkoutId]);
    if (rows.some(row => row.order_id) || types.some(type => !rows.some(row => row.terms_type === type && row.terms_version === versions[type] && !row.order_id))) {
      throw new AppError('This checkout agreement has already been used.', 409);
    }
    await client.query('COMMIT');
    return agreement.checkoutId;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

// Called inside the order transaction after cart items have been resolved on the server.
async function attachCheckout(db, userId, checkoutId, items, orderId) {
  if (!uuid.test(checkoutId || '')) throw new AppError('Checkout acknowledgment is required.', 400, [], 'TERMS_REQUIRED');
  const isCustom = item => Boolean(item.customization || item.customization_id || ['customization', 'custom_build'].includes(item.type));
  const types = [];
  if (items.some(item => !isCustom(item))) types.push('orders');
  if (items.some(isCustom)) types.push('customization');
  const { rows } = await db.query(
    `SELECT * FROM terms_acknowledgments WHERE user_id = $1 AND checkout_id = $2 AND context = 'checkout' FOR UPDATE`,
    [userId, checkoutId]);
  if (!types.length || types.some(type => !rows.some(row => row.terms_type === type && row.terms_version === versions[type] && !row.order_id))) {
    throw new AppError('Review and accept the current terms for this checkout before payment.', 400, [], 'TERMS_REQUIRED');
  }
  if (rows.some(row => row.order_id)) throw new AppError('This checkout agreement has already been used.', 409);
  await db.query('UPDATE terms_acknowledgments SET order_id = $3 WHERE user_id = $1 AND checkout_id = $2', [userId, checkoutId, orderId]);
}

module.exports = { versions, validateAgreement, hasAccountAcceptance, recordAccount, recordCheckout, attachCheckout };
