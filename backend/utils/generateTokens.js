const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/refreshToken.js');

const generateTokens = async (userId, userRole = 'user') => {
  try {
    const accessToken = jwt.sign(
      { id: userId, role: userRole },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );

    const refreshToken = jwt.sign(
      { id: userId },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await RefreshToken.create({
      userId,
      token: refreshToken,
      expiresAt,
    });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error(`Token generation failed: ${error.message}`);
  }
};

const verifyRefreshToken = async (token) => {
  try {
    const storedToken = await RefreshToken.findOne({ token });
    if (!storedToken || storedToken.isRevoked) {
      throw new Error('Token is revoked or not found');
    }
    if (storedToken.expiresAt < new Date()) {
      throw new Error('Token has expired');
    }
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error(`Token verification failed: ${error.message}`);
  }
};

const revokeRefreshToken = async (token) => {
  await RefreshToken.updateOne({ token }, { isRevoked: true, revokedAt: new Date() });
};

module.exports = { generateTokens, verifyRefreshToken, revokeRefreshToken };