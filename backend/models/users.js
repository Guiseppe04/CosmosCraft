const mongoose = require('mongoose');

// Address Schema (Embedded subdocument)
const addressSchema = new mongoose.Schema(
  {
    streetLine1: {
      type: String,
      required: [true, 'Street address line 1 is required'],
      trim: true,
      minlength: [5, 'Street address must be at least 5 characters'],
      maxlength: [100, 'Street address must not exceed 100 characters'],
    },
    streetLine2: {
      type: String,
      trim: true,
      maxlength: [100, 'Street address line 2 must not exceed 100 characters'],
      default: '',
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      minlength: [2, 'City must be at least 2 characters'],
      maxlength: [50, 'City must not exceed 50 characters'],
      match: [/^[a-zA-Z\s'-]+$/, 'City can only contain letters, spaces, hyphens, and apostrophes'],
    },
    stateProvince: {
      type: String,
      required: [true, 'State/Province is required'],
      trim: true,
      minlength: [2, 'State/Province must be at least 2 characters'],
      maxlength: [50, 'State/Province must not exceed 50 characters'],
      match: [/^[a-zA-Z\s'-]+$/, 'State/Province can only contain letters, spaces, hyphens, and apostrophes'],
    },
    postalZipCode: {
      type: String,
      required: [true, 'Postal/Zip code is required'],
      trim: true,
      minlength: [3, 'Postal code must be at least 3 characters'],
      maxlength: [20, 'Postal code must not exceed 20 characters'],
      match: [/^[a-zA-Z0-9\s-]+$/, 'Postal code can only contain letters, numbers, spaces, and hyphens'],
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      trim: true,
      minlength: [2, 'Country must be at least 2 characters'],
      maxlength: [50, 'Country must not exceed 50 characters'],
      match: [/^[a-zA-Z\s'-]+$/, 'Country can only contain letters, spaces, hyphens, and apostrophes'],
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Main User Schema
const userSchema = new mongoose.Schema(
  {
    // OAuth Identifiers (optional, only set if user authenticated via OAuth)
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    facebookId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },

    // Email/Password Authentication (optional, only set if user authenticated via email/password)
    password: {
      type: String,
      required: function () {
        // Password required only if NOT using OAuth
        return !this.googleId && !this.facebookId;
      },
      minlength: [8, 'Password must be at least 8 characters'],
    },

    // Name Structure
    name: {
      firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
        minlength: [2, 'First name must be at least 2 characters'],
        maxlength: [50, 'First name must not exceed 50 characters'],
        match: [/^[a-zA-Z\s'-]+$/, 'First name can only contain letters, spaces, hyphens, and apostrophes'],
      },
      middleName: {
        type: String,
        trim: true,
        maxlength: [50, 'Middle name must not exceed 50 characters'],
        match: [/^[a-zA-Z\s'-]*$/, 'Middle name can only contain letters, spaces, hyphens, and apostrophes'],
        default: '',
      },
      lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
        minlength: [2, 'Last name must be at least 2 characters'],
        maxlength: [50, 'Last name must not exceed 50 characters'],
        match: [/^[a-zA-Z\s'-]+$/, 'Last name can only contain letters, spaces, hyphens, and apostrophes'],
      },
    },

    // Email
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },

    // Phone Number (optional)
    phone: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: function (v) {
          return v === '' || /^[\d\s\-\+\(\)]{10,20}$/.test(v);
        },
        message: 'Phone number must be valid (10-20 digits with optional formatting)',
      },
    },

    // Addresses (Array with max 2 addresses)
    addresses: {
      type: [addressSchema],
      validate: {
        validator: function (v) {
          return v.length <= 2;
        },
        message: 'Maximum 2 addresses allowed',
      },
      default: [],
    },

    // OAuth Providers
    providers: {
      type: [String],
      enum: {
        values: ['google', 'facebook', 'email'],
        message: 'Provider must be one of: google, facebook, email',
      },
      default: [],
    },

    // User Role
    role: {
      type: String,
      enum: {
        values: ['user', 'admin', 'moderator'],
        message: 'Role must be one of: user, admin, moderator',
      },
      default: 'user',
    },

    // Profile Completion Status
    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    // Email & Account Status
    emailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // User Profile
    profile: {
      bio: {
        type: String,
        maxlength: [500, 'Bio must not exceed 500 characters'],
        trim: true,
        default: '',
      },
      avatar: {
        type: String,
        default: '',
        validate: {
          validator: function (v) {
            return v === '' || /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
          },
          message: 'Avatar must be a valid image URL',
        },
      },
      preferences: {
        notifications: { type: Boolean, default: true },
        emailUpdates: { type: Boolean, default: false },
        twoFactorEnabled: { type: Boolean, default: false },
      },
    },

    // Login Tracking
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      count: { type: Number, default: 0, min: 0 },
      lastAttempt: { type: Date, default: null },
      lockedUntil: { type: Date, default: null },
    },
  },
  { timestamps: true }
);



module.exports = mongoose.model('User', userSchema);