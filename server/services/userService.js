const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');

exports.createOAuthUser = async (userData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user exists by email
    const existRes = await client.query('SELECT user_id FROM users WHERE email = $1', [userData.email]);
    if (existRes.rows.length > 0) {
      throw new Error('User already exists with this email');
    }

    // Insert user
    const userRes = await client.query(
      `INSERT INTO users (email, first_name, middle_name, last_name, is_verified) 
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [userData.email, userData.firstName, userData.middleName || null, userData.lastName]
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
        `INSERT INTO addresses (user_id, line1, line2, city, province, postal_code, country, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [
          user.user_id,
          userData.address.streetLine1,
          userData.address.streetLine2 || null,
          userData.address.city,
          userData.address.stateProvince,
          userData.address.postalZipCode,
          userData.address.country
        ]
      );
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
  return user;
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
  const validUpdates = ['first_name', 'middle_name', 'last_name', 'phone', 'avatar_url', 'birth_date'];
  
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
    const existing = await client.query('SELECT count(*) FROM addresses WHERE user_id = $1', [userId]);
    if (parseInt(existing.rows[0].count) >= 2) {
      throw new Error('Maximum 2 addresses allowed.');
    }

    const isFirst = existing.rows[0].count === '0';
    const isDefault = isFirst || addressData.isDefault;

    if (isDefault) {
      await client.query('UPDATE addresses SET is_default = false WHERE user_id = $1', [userId]);
    }

    const res = await client.query(
      `INSERT INTO addresses (user_id, label, line1, line2, city, province, postal_code, country, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        userId,
        addressData.label || null,
        addressData.streetLine1,
        addressData.streetLine2 || null,
        addressData.city,
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
    const map = { label: 'label', streetLine1: 'line1', streetLine2: 'line2', city: 'city', stateProvince: 'province', postalZipCode: 'postal_code', country: 'country', isDefault: 'is_default' };
    
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

const crypto = require('crypto');

exports.createPasswordResetToken = async (userId, newPassword) => {
  const isMatch = await exports.verifyPassword(userId, newPassword);
  if (isMatch) throw new Error('New password must be different from current password');
  
  const existingRes = await pool.query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1 OR expires_at < now()',
    [userId]
  );
  
  const token = crypto.randomBytes(32).toString('hex');
  const newPasswordHash = await bcrypt.hash(newPassword, 12);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token, new_password_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, token, newPasswordHash, expiresAt]
  );
  
  return { token, expiresAt };
};

exports.verifyPasswordResetToken = async (userId, token) => {
  const res = await pool.query(
    `SELECT * FROM password_reset_tokens 
     WHERE user_id = $1 AND token = $2 AND is_used = false AND expires_at > now()`,
    [userId, token]
  );
  
  if (res.rows.length === 0) {
    throw new Error('Invalid or expired token');
  }
  
  const tokenRecord = res.rows[0];
  
  await pool.query(
    'UPDATE password_reset_tokens SET is_used = true WHERE token_id = $1',
    [tokenRecord.token_id]
  );
  
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE user_id = $2',
    [tokenRecord.new_password_hash, userId]
  );
  
  await pool.query(
    'DELETE FROM password_reset_tokens WHERE user_id = $1',
    [userId]
  );
  
  return { message: 'Password updated successfully' };
};

exports.requestPasswordChange = async (userId, oldPassword, newPassword) => {
  const isMatch = await exports.verifyPassword(userId, oldPassword);
  if (!isMatch) throw new Error('Current password is incorrect');
  
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    throw new Error('Password must be at least 8 characters with uppercase and numbers');
  }
  
  const isSameAsOld = await exports.verifyPassword(userId, newPassword);
  if (isSameAsOld) throw new Error('New password must be different from current password');
  
  return exports.createPasswordResetToken(userId, newPassword);
};

exports.deactivateAccount = async (userId) => {
  await pool.query('UPDATE users SET is_active = false, updated_at = now() WHERE user_id = $1', [userId]);
  return exports.getUserById(userId);
};

exports.reactivateAccount = async (userId) => {
  await pool.query('UPDATE users SET is_active = true, updated_at = now() WHERE user_id = $1', [userId]);
  return exports.getUserById(userId);
};

exports.listUsers = async (filters = {}, limit = 10, skip = 0) => {
  let queryStr = 'SELECT user_id, email, first_name, last_name, role, is_active FROM users WHERE 1=1';
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
  
  
  const paginatedQuery = queryStr + ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx+1}`;
  
  const [usersRes, countRes] = await Promise.all([
    pool.query(paginatedQuery, [...values, limit, skip]),
    pool.query(`SELECT count(*) FROM (${queryStr}) as t`, values)
  ]);
  
  return { users: usersRes.rows, total: parseInt(countRes.rows[0].count), limit, skip };
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

exports.markEmailVerified = async (userId) => {
  await pool.query('UPDATE users SET is_verified = true, updated_at = now() WHERE user_id = $1', [userId]);
};

