const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const { pool } = require('./database');
const userService = require('../services/userService');

const parseDisplayName = (displayName) => {
  const nameParts = displayName.trim().split(/\s+/);
  if (nameParts.length === 0) return { firstName: 'User', middleName: '', lastName: '' };
  if (nameParts.length === 1) return { firstName: nameParts[0], middleName: '', lastName: '' };
  if (nameParts.length === 2) return { firstName: nameParts[0], middleName: '', lastName: nameParts[1] };
  return {
    firstName: nameParts[0],
    middleName: nameParts.slice(1, -1).join(' '),
    lastName: nameParts[nameParts.length - 1],
  };
};

const handleOAuthLogin = async (provider, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const { firstName, middleName, lastName } = parseDisplayName(profile.displayName);

    let user = await userService.getUserByEmail(email);

    if (!user) {
      user = await userService.createOAuthUser({
        provider,
        googleId: provider === 'google' ? profile.id : undefined,
        facebookId: provider === 'facebook' ? profile.id : undefined,
        email,
        firstName,
        middleName: middleName || '',
        lastName,
      });
    } else {
      // Check if identity linked
      const identityRes = await pool.query(
        'SELECT * FROM user_identities WHERE user_id = $1 AND provider = $2',
        [user.user_id, provider]
      );
      if (identityRes.rows.length === 0) {
        await pool.query(
          `INSERT INTO user_identities (user_id, provider, provider_user_id, provider_email)
           VALUES ($1, $2, $3, $4)`,
          [user.user_id, provider, profile.id, email]
        );
      }
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => handleOAuthLogin('google', profile, done)
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ['id', 'displayName', 'emails'],
    },
    async (accessToken, refreshToken, profile, done) => handleOAuthLogin('facebook', profile, done)
  )
);

passport.serializeUser((user, done) => done(null, user.user_id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await userService.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
