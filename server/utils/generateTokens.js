const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const generateTokens = async (userId, userRole = 'user') => {
  try {
    const accessToken = jwt.sign(
      { id: userId, role: userRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save refreshToken string as token_hash
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [userId, refreshToken, expiresAt]
    );

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