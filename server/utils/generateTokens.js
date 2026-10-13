const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const rbacService = require('../services/rbacService');
const { AppError } = require('../middleware/errorHandler');

const generateAccessToken = async (userId, userRole = null) => {
  const roleSummary = userRole
    ? { role: userRole, roles: [userRole], permissions: [] }
    : await rbacService.getUserRoleSummary(userId, false);
  const permissions = roleSummary.permissions?.length
    ? roleSummary.permissions
    : await rbacService.getUserPermissions(userId, false);
  const resolvedRole = roleSummary.role || 'customer';

  const accessToken = jwt.sign(
    { id: userId, role: resolvedRole, roles: roleSummary.roles || [resolvedRole], permissions },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '15m' }
  );

  return accessToken;
};

const generateTokens = async (userId, userRole = null) => {
  try {
    const accessToken = await generateAccessToken(userId, userRole);
    const resolvedRole = jwt.decode(accessToken).role;

    // Add a random jti/nonce so tokens are unique even when issued within the same second
    const jti = crypto.randomBytes(16).toString('hex');
    let refreshToken = jwt.sign(
      { id: userId, role: resolvedRole, jti },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    // Save refreshToken string as token_hash. If a duplicate is encountered (very rare), retry a few times.
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await pool.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
          [userId, refreshToken, new Date(jwt.decode(refreshToken).exp * 1000)]
        );
        break;
      } catch (err) {
        // If duplicate key on token_hash, generate a fresh jti and token and retry
        if (err.code === '23505' && attempt < maxRetries - 1) {
          const newJti = crypto.randomBytes(16).toString('hex');
          attempt += 1;
          refreshToken = jwt.sign(
            { id: userId, role: resolvedRole, jti: newJti },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
          );
          continue;
        }
        throw err;
      }
    }

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
};

const verifyRefreshToken = async (token) => {
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    if (!['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) throw error;
    throw new AppError('Refresh session is invalid or expired. Please sign in again.', 401, [], 'SESSION_EXPIRED');
  }
  // Database failures must remain server errors, not masquerade as expired sessions.
  const res = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [token]);
  const storedToken = res.rows[0];
  if (!storedToken || storedToken.is_revoked || String(storedToken.user_id) !== String(decoded.id) ||
      new Date(storedToken.expires_at).getTime() <= Date.now()) {
    throw new AppError('Refresh session is invalid or expired. Please sign in again.', 401, [], 'SESSION_EXPIRED');
  }
  return decoded;
};

const revokeRefreshToken = async (token) => {
  await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1', [token]);
};

module.exports = { generateAccessToken, generateTokens, verifyRefreshToken, revokeRefreshToken };
