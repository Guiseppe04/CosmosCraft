const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../config/database');
const rbacService = require('../services/rbacService');

const generateTokens = async (userId, userRole = null) => {
  try {
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
      { expiresIn: process.env.JWT_EXPIRE || '30d' }
    );

    // Add a random jti/nonce so tokens are unique even when issued within the same second
    const jti = crypto.randomBytes(16).toString('hex');
    let refreshToken = jwt.sign(
      { id: userId, role: resolvedRole, jti },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save refreshToken string as token_hash. If a duplicate is encountered (very rare), retry a few times.
    const maxRetries = 3;
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        await pool.query(
          `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
          [userId, refreshToken, expiresAt]
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
  try {
    const res = await pool.query('SELECT * FROM refresh_tokens WHERE token_hash = $1', [token]);
    const storedToken = res.rows[0];

    if (!storedToken || storedToken.is_revoked) {
      throw new Error('Token is revoked or not found');
    }
    if (new Date(storedToken.expires_at) < new Date()) {
      throw new Error('Token has expired');
    }
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

const revokeRefreshToken = async (token) => {
  await pool.query('UPDATE refresh_tokens SET is_revoked = true WHERE token_hash = $1', [token]);
};

module.exports = { generateTokens, verifyRefreshToken, revokeRefreshToken };