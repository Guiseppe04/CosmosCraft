const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const rbacService = require('./rbacService');
const { lockAppointmentCapacity } = require('../middleware/appointmentCapacityLock');

const normalizeAddressValue = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const getAddressSignature = (address = {}) => ([
  address.line1 ?? address.streetLine1 ?? address.street,
  address.line2 ?? address.streetLine2 ?? address.street2,
  address.city,
  address.barangay ?? '',
  address.province ?? address.stateProvince,
  address.postal_code ?? address.postalZipCode ?? address.postalCode,
  address.country,
].map(normalizeAddressValue).join('|'));

const updateAccountActiveStatus = async (userId, isActive) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockAppointmentCapacity(client);
    const result = await client.query(
      'UPDATE users SET is_active = $1, updated_at = now() WHERE user_id = $2 RETURNING user_id',
      [isActive, userId]
    );
    if (result.rows.length === 0) throw new Error('User not found');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return exports.getUserById(userId);
};

exports.createOAuthUser = async (userData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user exists by email
    const existRes = await client.query('SELECT user_id FROM users WHERE email = $1', [userData.email]);
    if (existRes.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Determine if email is verified by provider
    // Google and Facebook both return email_verified in profile when email scope is granted
    const isVerified = userData.emailVerified === true;

    // Insert user
    const userRes = await client.query(
      `INSERT INTO users (email, first_name, middle_name, last_name, is_verified) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userData.email, userData.firstName, userData.middleName || null, userData.lastName, isVerified]
    );
    const user = userRes.rows[0];

    // Insert identity
    await client.query(
      `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email)
       VALUES ($1, $2, $3, $4)`,
      [
        user.user_id, 
        userData.provider, 
        userData.provider === 'google' ? userData.googleId : userData.facebookId,
        userData.email
      ]
    );

    const defaultRole = await rbacService.getRoleByName('customer');
    if (defaultRole) {
      await rbacService.assignRoleToUser(user.user_id, defaultRole.role_id, user.user_id, null, client);
    }

    await client.query('COMMIT');
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.createEmailUser = async (userData) => {
  if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
    throw new Error('Missing required fields');
  }

  const client = await pool.connect();
  try {
    const existRes = await client.query('SELECT user_id FROM users WHERE email = $1', [userData.email.toLowerCase()]);
    if (existRes.rows.length > 0) {
      throw new Error(`User with email '${userData.email}' already exists`);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    await client.query('BEGIN');
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, first_name, middle_name, last_name, phone, is_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, false, true) RETURNING *`,
      [
        userData.email.toLowerCase().trim(),
        hashedPassword,
        userData.firstName.trim(),
        userData.middleName?.trim() || null,
        userData.lastName.trim(),
        userData.phone?.trim() || null
      ]
    );
    const user = userRes.rows[0];

    if (userData.address) {
      await client.query(
        `INSERT INTO addresses (user_id, line1, line2, city, barangay, province, postal_code, country, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        [
          user.user_id,
          userData.address.streetLine1,
          userData.address.streetLine2 || null,
          userData.address.city,
          userData.address.barangay || null,
          userData.address.stateProvince,
          userData.address.postalZipCode,
          userData.address.country,
        ]
      );
    }

    const defaultRole = await rbacService.getRoleByName('customer');
    if (defaultRole) {
      await rbacService.assignRoleToUser(user.user_id, defaultRole.role_id, user.user_id, null, client);
    }

    await client.query('COMMIT');
    delete user.password_hash;
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Create a staff/admin account (admin action).
 * Accounts are created verified & active so the appointee can sign in
 * immediately with the password chosen by the admin. Staff members affect
 * appointment capacity, so the whole transaction is guarded by the capacity lock.
 */
exports.createStaffUser = async (userData, assignedByUserId) => {
  const roleName = userData.role === 'admin' ? 'admin' : 'staff';

  if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
    throw new Error('Missing required fields');
  }

  const client = await pool.connect();
  try {
    const existRes = await client.query('SELECT user_id FROM users WHERE email = $1', [userData.email.toLowerCase().trim()]);
    if (existRes.rows.length > 0) {
      throw new Error(`User with email '${userData.email}' already exists`);
    }

    const hashedPassword = await bcrypt.hash(userData.password, 12);

    await client.query('BEGIN');
    await lockAppointmentCapacity(client);

    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, first_name, middle_name, last_name, phone, role, is_verified, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true) RETURNING *`,
      [
        userData.email.toLowerCase().trim(),
        hashedPassword,
        userData.firstName.trim(),
        userData.middleName?.trim() || null,
        userData.lastName.trim(),
        userData.phone?.trim() || null,
        roleName,
      ]
    );
    const user = userRes.rows[0];

    const roleRecord = await rbacService.getRoleByName(roleName);
    if (roleRecord) {
      await rbacService.assignRoleToUser(user.user_id, roleRecord.role_id, assignedByUserId || user.user_id, null, client);
    }

    await client.query('COMMIT');
    delete user.password_hash;
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.getUserById = async (userId) => {
  const res = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) throw new Error('User not found');
  const user = res.rows[0];
  delete user.password_hash;
  const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
  return { ...user, role: roleSummary.role || user.role };
};

exports.getUserAuthInfo = async (userId) => {
  const userRes = await pool.query(
    'SELECT user_id, email, password_hash FROM users WHERE user_id = $1',
    [userId]
  );

  if (userRes.rows.length === 0) {
    throw new Error('User not found');
  }

  const identitiesRes = await pool.query(
    'SELECT provider FROM user_identities WHERE user_id = $1',
    [userId]
  );

  const identityProviders = identitiesRes.rows
    .map((row) => String(row.provider || '').toLowerCase())
    .filter(Boolean);

  const hasLocalPassword = Boolean(userRes.rows[0].password_hash);
  const primaryProvider = hasLocalPassword
    ? 'local'
    : (identityProviders.includes('google')
      ? 'google'
      : identityProviders.includes('facebook')
        ? 'facebook'
        : 'local');

  return {
    ...userRes.rows[0],
    has_local_password: hasLocalPassword,
    provider: primaryProvider,
    identity_providers: identityProviders,
  };
};

exports.getUserByEmail = async (email) => {
  const res = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return res.rows[0] || null;
};

exports.updateProfile = async (userId, updates) => {
  const fields = [];
  const values = [];
  let idx = 1;
  const validUpdates = ['first_name', 'middle_name', 'last_name', 'phone', 'avatar_url'];
  
  for (const key in updates) {
    if (validUpdates.includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }
  }

  if (fields.length === 0) return await exports.getUserById(userId);

  values.push(userId);
  const res = await pool.query(
    `UPDATE users SET ${fields.join(', ')}, updated_at = now() WHERE user_id = $${idx} RETURNING *`,
    values
  );

  if (res.rows.length === 0) throw new Error('User not found');
  const user = res.rows[0];
  delete user.password_hash;
  return user;
};

exports.addAddress = async (userId, addressData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      'SELECT address_id, line1, line2, city, barangay, province, postal_code, country, is_default FROM addresses WHERE user_id = $1',
      [userId]
    );
    const duplicateAddress = existing.rows.find(
      (address) => getAddressSignature(address) === getAddressSignature(addressData)
    );

    if (duplicateAddress) {
      if (addressData.isDefault && !duplicateAddress.is_default) {
        await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
        await client.query(
          'UPDATE addresses SET is_default = true WHERE address_id = $1 AND user_id = $2',
          [duplicateAddress.address_id, userId]
        );
      }

      await client.query('COMMIT');
      return exports.getUserById(userId);
    }

    const isFirst = existing.rows.length === 0;
    const isDefault = isFirst || addressData.isDefault;

    if (isDefault) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }

    const res = await client.query(
      `INSERT INTO addresses (user_id, label, line1, line2, city, barangay, province, postal_code, country, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        userId,
        addressData.label || null,
        addressData.streetLine1,
        addressData.streetLine2 || null,
        addressData.city,
        addressData.barangay || null,
        addressData.stateProvince,
        addressData.postalZipCode,
        addressData.country,
        isDefault
      ]
    );

    await client.query('COMMIT');
    return exports.getUserById(userId); // Simplified return
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateAddress = async (userId, addressId, updates) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (updates.isDefault) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }

    const fields = [];
    const values = [];
    let idx = 1;
    // Map frontend fields (e.g. streetLine1) to db columns if necessary
    const map = { label: 'label', streetLine1: 'line1', streetLine2: 'line2', city: 'city', barangay: 'barangay', stateProvince: 'province', postalZipCode: 'postal_code', country: 'country', isDefault: 'is_default' };
    
    for (const key in updates) {
      if (map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        values.push(updates[key]);
        idx++;
      }
    }
    
    if (fields.length > 0) {
      values.push(addressId, userId);
      const paramCount = idx - 1;
      await client.query(
        `UPDATE addresses SET ${fields.join(', ')} WHERE address_id = $${paramCount + 1} AND user_id = $${paramCount + 2}`,
        values
      );
    }
    
    await client.query('COMMIT');
    return exports.getUserById(userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.removeAddress = async (userId, addressId) => {
  await pool.query('DELETE FROM addresses WHERE user_id = $1 AND address_id = $2', [userId, addressId]);
  return exports.getUserById(userId);
};

exports.verifyPassword = async (userId, password) => {
  const res = await pool.query('SELECT password_hash FROM users WHERE user_id = $1', [userId]);
  if (res.rows.length === 0) throw new Error('User not found');
  const user = res.rows[0];
  if (!user.password_hash) throw new Error('This account does not use password authentication');
  return bcrypt.compare(password, user.password_hash);
};

exports.updatePassword = async (userId, oldPassword, newPassword) => {
  const isMatch = await exports.verifyPassword(userId, oldPassword);
  if (!isMatch) throw new Error('Current password is incorrect');
  
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2', [hashedPassword, userId]);
  return { message: 'Password updated successfully' };
};

exports.setPassword = async (userId, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2',
    [hashedPassword, userId]
  );
  return { message: 'Password updated successfully' };
};

exports.updateUserPhone = async (userId, phone) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'UPDATE users SET phone = $1, updated_at = now() WHERE user_id = $2 RETURNING *',
      [phone || null, userId]
    );
    await client.query('COMMIT');
    if (result.rows.length === 0) throw new Error('User not found');
    const user = result.rows[0];
    delete user.password_hash;
    return user;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.deactivateAccount = async (userId) => {
  return updateAccountActiveStatus(userId, false);
};

exports.reactivateAccount = async (userId) => {
  return updateAccountActiveStatus(userId, true);
};

exports.listUsers = async (filters = {}, limit = 10, skip = 0) => {
  let queryStr = 'SELECT user_id, email, first_name, last_name, role, is_active, is_verified, created_at FROM users WHERE is_verified = true AND 1=1';
  const values = [];
  let idx = 1;

  if (filters.role) {
    queryStr += ` AND role = $${idx}`;
    values.push(filters.role);
    idx++;
  }
  if (filters.email) {
    queryStr += ` AND email ILIKE $${idx}`;
    values.push(`%${filters.email}%`);
    idx++;
  }
  if (filters.name) {
    queryStr += ` AND (first_name ILIKE $${idx} OR last_name ILIKE $${idx} OR CONCAT(first_name, ' ', last_name) ILIKE $${idx})`;
    values.push(`%${filters.name}%`);
    idx++;
  }
  if (filters.search && String(filters.search).trim()) {
    queryStr += ` AND (
      email ILIKE $${idx} OR 
      first_name ILIKE $${idx} OR 
      last_name ILIKE $${idx} OR 
      CONCAT(first_name, ' ', last_name) ILIKE $${idx} OR 
      role::text ILIKE $${idx}
    )`;
    values.push(`%${String(filters.search).trim()}%`);
    idx++;
  }
  
  const paginatedQuery = queryStr + ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`;
  
  const [usersRes, countRes] = await Promise.all([
    pool.query(paginatedQuery, [...values, limit, skip]),
    pool.query(`SELECT count(*) FROM (${queryStr}) as t`, values)
  ]);

  const users = await Promise.all(usersRes.rows.map(async (user) => {
    const roleSummary = await rbacService.getUserRoleSummary(user.user_id, false);
    return { ...user, role: roleSummary.role || user.role };
  }));
  
  return { users, total: parseInt(countRes.rows[0].count), limit, skip };
};

exports.saveOTP = async (userId, otpCode, expiresAt, purpose = 'signup') => {
  await pool.query(
    `INSERT INTO otp_codes (user_id, code, purpose, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, otpCode, purpose, expiresAt]
  );
};

exports.verifyAndConsumeOTP = async (userId, otpCode, purpose = 'signup') => {
  const res = await pool.query(
    `UPDATE otp_codes SET is_used = true 
     WHERE user_id = $1 AND code = $2 AND purpose = $3 AND is_used = false AND expires_at > now() 
     RETURNING *`,
    [userId, otpCode, purpose]
  );
  return res.rows.length > 0;
};

exports.verifyAndConsumeOTPWithAttempts = async (userId, otpCode, purpose = 'signup') => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const otpRes = await client.query(
      `SELECT * FROM otp_codes 
       WHERE user_id = $1 AND code = $2 AND purpose = $3 AND is_used = false AND expires_at > now()
       FOR UPDATE`,
      [userId, otpCode, purpose]
    );

    if (otpRes.rows.length === 0) {
      await client.query('COMMIT');
      return { valid: false, maxAttemptsReached: false };
    }

    const otpRecord = otpRes.rows[0];

    const attemptRes = await client.query(
      `SELECT COUNT(*) as attempt_count FROM otp_attempts WHERE otp_id = $1 AND success = false`,
      [otpRecord.otp_id]
    );
    const failedAttempts = parseInt(attemptRes.rows[0].attempt_count, 10);

    if (failedAttempts >= 5) {
      await client.query('UPDATE otp_codes SET is_used = true WHERE otp_id = $1', [otpRecord.otp_id]);
      await client.query('COMMIT');
      return { valid: false, maxAttemptsReached: true };
    }

    await client.query(
      `INSERT INTO otp_attempts (otp_id, success) VALUES ($1, $2)`,
      [otpRecord.otp_id, true]
    );

    await client.query(
      `UPDATE otp_codes SET is_used = true WHERE otp_id = $1`,
      [otpRecord.otp_id]
    );

    await client.query('COMMIT');
    return { valid: true, maxAttemptsReached: false };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.markEmailVerified = async (userId) => {
  await pool.query('UPDATE users SET is_verified = true, updated_at = now() WHERE user_id = $1', [userId]);
};

exports.checkResendOTPRateLimit = async (email) => {
  const user = await pool.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (user.rows.length === 0) {
    return { allowed: true, retryAfter: null };
  }

  const userId = user.rows[0].user_id;

  const recentResend = await pool.query(
    `SELECT created_at FROM otp_codes 
     WHERE user_id = $1 AND purpose = 'signup' AND created_at > now() - interval '60 seconds'
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (recentResend.rows.length > 0) {
    const secondsAgo = Math.floor((Date.now() - new Date(recentResend.rows[0].created_at).getTime()) / 1000);
    return { allowed: false, retryAfter: Math.max(60 - secondsAgo, 1) };
  }

  const hourlyCount = await pool.query(
    `SELECT COUNT(*) as count FROM otp_codes 
     WHERE user_id = $1 AND purpose = 'signup' AND created_at > now() - interval '1 hour'`,
    [userId]
  );
  if (parseInt(hourlyCount.rows[0].count, 10) >= 5) {
    const oldestInWindow = await pool.query(
      `SELECT created_at FROM otp_codes 
       WHERE user_id = $1 AND purpose = 'signup' AND created_at > now() - interval '1 hour'
       ORDER BY created_at ASC LIMIT 1`,
      [userId]
    );
    if (oldestInWindow.rows.length > 0) {
      const msUntilWindowEnds = new Date(oldestInWindow.rows[0].created_at).getTime() + 60 * 60 * 1000 - Date.now();
      return { allowed: false, retryAfter: Math.ceil(msUntilWindowEnds / 1000) };
    }
    return { allowed: false, retryAfter: 3600 };
  }

  return { allowed: true, retryAfter: null };
};

exports.recordResendOTPAttempt = async (email) => {
  const user = await pool.query('SELECT user_id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (user.rows.length > 0) {
    const markerCode = `RL${Date.now().toString(36).slice(-4)}`;
    await pool.query(
      `INSERT INTO otp_codes (user_id, code, purpose, expires_at, is_used) 
       VALUES ($1, $2, 'signup', now() + interval '1 minute', true)
       ON CONFLICT (user_id, purpose, code) DO NOTHING`,
      [user.rows[0].user_id, markerCode]
    );
  }
};

