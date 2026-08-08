require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const passport = require('passport');

const { connectDB } = require('./config/database.js');
const passportConfig = require('./config/passport.js');
const mailService = require('./services/mailService.js');
const authRoutes = require('./routes/authRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const productRoutes = require('./routes/productRoutes.js');
const guitarRoutes = require('./routes/guitarRoutes.js');
const serviceRoutes = require('./routes/serviceRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const rbacRoutes = require('./routes/rbacRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const posRoutes = require('./routes/posRoutes');
const projectRoutes = require('./routes/projectRoutes');
const builderPartsRoutes = require('./routes/builderPartsRoutes');
const cloudinaryRoutes = require('./routes/cloudinaryRoutes');
const paymentSettingsRoutes = require('./routes/paymentSettingsRoutes');
const installmentRoutes = require('./routes/installmentRoutes');
const addressRoutes = require('./routes/addressRoutes.js');
const { errorHandler, notFound } = require('./middleware/errorHandler.js');
const { createRateLimiter } = require('./middleware/rateLimitMiddleware.js');

const app = express();

// Configure `trust proxy` when running behind a reverse proxy (e.g. Render, Heroku).
// If `TRUST_PROXY` is set it will be used verbatim, otherwise enable in production.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : process.env.TRUST_PROXY);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
});

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many authentication attempts, please try again later.',
  },
});

app.use(generalLimiter);
const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000', process.env.FRONTEND_URL, process.env.FRONTEND_URL_PROD].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cookieParser());
app.use(passport.initialize());

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authLimiter, authRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/guitars', guitarRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/rbac', rbacRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/builder-parts', builderPartsRoutes);
// Legacy alias for older client code or asset path requests that omit /api
app.use('/builder-parts', builderPartsRoutes);
app.use('/api/cloudinary', cloudinaryRoutes);
app.use('/api/payment-settings', paymentSettingsRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/address', addressRoutes);
// Legacy route alias kept for backwards-compat
app.use('/user', userRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  await connectDB();

  server = app.listen(PORT, async () => {
    console.log(`Backend Running`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);

    // Log OAuth config (mask secrets) to verify env vars are injected correctly in production
    console.log('--- OAuth Configuration ---');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || '(not set)'}`);
    console.log(`FRONTEND_URL_PROD: ${process.env.FRONTEND_URL_PROD || '(not set)'}`);
    console.log(`FACEBOOK_APP_ID: ${process.env.FACEBOOK_APP_ID ? '***' : '(not set)'}`);
    console.log(`FACEBOOK_APP_SECRET: ${process.env.FACEBOOK_APP_SECRET ? '(set, masked)' : '(not set)'}`);
    console.log(`FACEBOOK_CALLBACK_URL: ${process.env.FACEBOOK_CALLBACK_URL || '(not set)'}`);
    console.log(`FACEBOOK_CALLBACK_URL_PROD: ${process.env.FACEBOOK_CALLBACK_URL_PROD || '(not set)'}`);
    console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '***' : '(not set)'}`);
    console.log(`GOOGLE_CALLBACK_URL: ${process.env.GOOGLE_CALLBACK_URL || '(not set)'}`);
    console.log(`GOOGLE_CALLBACK_URL_PROD: ${process.env.GOOGLE_CALLBACK_URL_PROD || '(not set)'}`);

    // Verify email service connection
    await mailService.verifyConnection();
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

process.on('SIGTERM', () => {
  if (!server) {
    process.exit(0);
  }

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
