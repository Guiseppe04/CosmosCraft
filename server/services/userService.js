const bcrypt = require('bcryptjs');
const User = require('../models/users');

/**
 * Create a new user via OAuth signup
 * @param {Object} userData - User data from OAuth provider
 * @returns {Promise<Object>} Created user object
 */
exports.createOAuthUser = async (userData) => {
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    // Create new user
    const user = new User({
      googleId: userData.googleId || undefined,
      facebookId: userData.facebookId || undefined,
      name: {
        firstName: userData.firstName,
        middleName: userData.middleName || '',
        lastName: userData.lastName,
      },
      email: userData.email,
      providers: [userData.provider],
      emailVerified: true, // OAuth emails are verified by provider
    });

    await user.save();
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Create a new user via email/password signup
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Created user object
 */
exports.createEmailUser = async (userData) => {
  // Validate required fields
  if (!userData.email || !userData.password || !userData.firstName || !userData.lastName) {
    throw new Error('Missing required fields: email, password, firstName, lastName');
  }

  // Check if user already exists by email (case-insensitive)
  const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
  if (existingUser) {
    throw new Error(`User with email '${userData.email}' already exists`);
  }

  try {
    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Create new user
    const user = new User({
      name: {
        firstName: userData.firstName.trim(),
        middleName: userData.middleName?.trim() || '',
        lastName: userData.lastName.trim(),
      },
      email: userData.email.toLowerCase().trim(),
      phone: userData.phone?.trim() || '',
      password: hashedPassword,
      addresses: userData.address ? [userData.address] : [],
      providers: ['email'],
      emailVerified: false, // Email verification required for email/password
      isActive: true, // New users are active by default
    });

    // Save user to database
    const savedUser = await user.save();

    // Return user object without password
    const userObj = savedUser.toObject();
    delete userObj.password;
    return userObj;
  } catch (error) {
    // Re-throw mongoose validation or save errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message).join(', ');
      throw new Error(`Validation error: ${messages}`);
    }
    throw error;
  }
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object
 */
exports.getUserById = async (userId) => {
  try {
    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {Promise<Object|null>} User object or null if not found
 */
exports.getUserByEmail = async (email) => {
  try {
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    return user; // Return null if not found, not throw error
  } catch (error) {
    throw error;
  }
};

/**
 * Update user profile (name, phone, bio)
 * @param {string} userId - User ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user
 */
exports.updateProfile = async (userId, updates) => {
  try {
    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    }).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Add address to user (max 2 addresses)
 * @param {string} userId - User ID
 * @param {Object} addressData - Address information
 * @returns {Promise<Object>} Updated user with new address
 */
exports.addAddress = async (userId, addressData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check max addresses limit
    if (user.addresses.length >= 2) {
      throw new Error('Maximum 2 addresses allowed. Please update an existing address or remove one first.');
    }

    // If this is the first address or marked as default, set it as default
    if (user.addresses.length === 0 || addressData.isDefault) {
      user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      addressData.isDefault = true;
    }

    user.addresses.push(addressData);
    user.isProfileComplete = true;
    await user.save();

    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Update specific address
 * @param {string} userId - User ID
 * @param {string} addressId - Address ID (MongoDB _id)
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Updated user
 */
exports.updateAddress = async (userId, addressId, updates) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const address = user.addresses.id(addressId);
    if (!address) {
      throw new Error('Address not found');
    }

    // Update address fields
    Object.assign(address, updates);

    // If marking as default, unmark others
    if (updates.isDefault) {
      user.addresses.forEach((addr) => {
        if (addr._id.toString() !== addressId) {
          addr.isDefault = false;
        }
      });
    }

    await user.save();
    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Remove address
 * @param {string} userId - User ID
 * @param {string} addressId - Address ID
 * @returns {Promise<Object>} Updated user
 */
exports.removeAddress = async (userId, addressId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $pull: { addresses: { _id: addressId } } },
      { new: true }
    );

    if (!user) {
      throw new Error('User not found');
    }

    // If no addresses left, mark profile as incomplete
    if (user.addresses.length === 0) {
      user.isProfileComplete = false;
      await user.save();
    }

    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Verify password for email/password users
 * @param {string} userId - User ID
 * @param {string} password - Plain text password
 * @returns {Promise<boolean>} True if password matches
 */
exports.verifyPassword = async (userId, password) => {
  try {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.password) {
      throw new Error('This account does not use password authentication');
    }

    // Compare provided password with stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch;
  } catch (error) {
    throw error;
  }
};

/**
 * Update password for email/password users
 * @param {string} userId - User ID
 * @param {string} oldPassword - Current password
 * @param {string} newPassword - New password
 * @returns {Promise<Object>} Updated user
 */
exports.updatePassword = async (userId, oldPassword, newPassword) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.password) {
      throw new Error('This account does not use password authentication');
    }

    // Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();

    return { message: 'Password updated successfully' };
  } catch (error) {
    throw error;
  }
};

/**
 * Deactivate user account
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
exports.deactivateAccount = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * Reactivate user account
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Updated user
 */
exports.reactivateAccount = async (userId) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: true },
      { new: true }
    ).select('-password');

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw error;
  }
};

/**
 * List all users (admin only)
 * @param {Object} filters - Filter options (role, name, email)
 * @param {number} limit - Number of results
 * @param {number} skip - Number of results to skip
 * @returns {Promise<Array>} Array of users
 */
exports.listUsers = async (filters = {}, limit = 10, skip = 0) => {
  try {
    const query = {};

    if (filters.role) {
      query.role = filters.role;
    }

    if (filters.name) {
      query.$or = [
        { 'name.firstName': new RegExp(filters.name, 'i') },
        { 'name.lastName': new RegExp(filters.name, 'i') },
      ];
    }

    if (filters.email) {
      query.email = new RegExp(filters.email, 'i');
    }

    const users = await User.find(query)
      .select('-password')
      .limit(limit)
      .skip(skip)
      .sort({ createdAt: -1 });

    const total = await User.countDocuments(query);

    return { users, total, limit, skip };
  } catch (error) {
    throw error;
  }
};
