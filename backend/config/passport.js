const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/users.js');

// Helper function to parse display name into firstName, middleName, lastName
const parseDisplayName = (displayName) => {
  const nameParts = displayName.trim().split(/\s+/);

  if (nameParts.length === 0) {
    return { firstName: 'User', middleName: '', lastName: '' };
  }

  if (nameParts.length === 1) {
    return { firstName: nameParts[0], middleName: '', lastName: '' };
  }

  if (nameParts.length === 2) {
    return { firstName: nameParts[0], middleName: '', lastName: nameParts[1] };
  }

  // For 3+ parts: first is firstName, last is lastName, middle parts are middleName
  return {
    firstName: nameParts[0],
    middleName: nameParts.slice(1, -1).join(' '),
    lastName: nameParts[nameParts.length - 1],
  };
};

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists by email
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // User does not exist - return done(null, false) to force signup
          // Store OAuth info in session for signup completion
          return done(null, false, {
            message: 'User not found. Please complete signup.',
            oauthData: {
              provider: 'google',
              googleId: profile.id,
              email: profile.emails[0].value,
              ...parseDisplayName(profile.displayName),
            },
          });
        }

        // User exists - add Google provider if not already added
        if (!user.providers.includes('google')) {
          user.providers.push('google');
          user.googleId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'displayName', 'emails'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists by email
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {
          // User does not exist - return done(null, false) to force signup
          return done(null, false, {
            message: 'User not found. Please complete signup.',
            oauthData: {
              provider: 'facebook',
              facebookId: profile.id,
              email: profile.emails[0].value,
              ...parseDisplayName(profile.displayName),
            },
          });
        }

        // User exists - add Facebook provider if not already added
        if (!user.providers.includes('facebook')) {
          user.providers.push('facebook');
          user.facebookId = profile.id;
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
