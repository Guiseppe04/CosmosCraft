const crypto = require('crypto');

/**
 * OTP Service - Generate and validate one-time passwords
 */

/**
 * Generate a 6-digit OTP
 * @returns {string} OTP code
 */
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate OTP with expiry time
 * @param {number} expiryMinutes - Minutes until OTP expires (default 15)
 * @returns {Object} { code, expiresAt }
 */
exports.generateOTPWithExpiry = (expiryMinutes = 15) => {
  const code = exports.generateOTP();
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  
  return {
    code,
    expiresAt,
  };
};

/**
 * Verify OTP against stored OTP and check expiry
 * @param {string} providedOTP - OTP provided by user
 * @param {string} storedOTP - OTP stored in database
 * @param {Date} expiresAt - Expiry time of OTP
 * @returns {boolean} true if valid
 */
exports.verifyOTP = (providedOTP, storedOTP, expiresAt) => {
  if (!providedOTP || !storedOTP) {
    return false;
  }

  // Check if OTP matches
  if (providedOTP.toString() !== storedOTP.toString()) {
    return false;
  }

  // Check if OTP has expired
  if (new Date() > new Date(expiresAt)) {
    return false;
  }

  return true;
};

/**
 * Generate secure token for email verification
 * @returns {string} Token
 */
exports.generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

module.exports = exports;
