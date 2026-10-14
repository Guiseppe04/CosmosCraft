require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const contactRoutes = require('./routes/contactRoutes.js');

const http = require('http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const passport = require('passport');

const { connectDB } = require('./config/database.js');
const socketService = require('./services/socketService.js');
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
const branchRoutes = require('./routes/branchRoutes.js');
const fulfillmentRoutes = require('./routes/fulfillmentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler.js');
const { createRateLimiter, isAuthPath, isSessionAuthPath, getGeneralRateLimitKey, rateLimitSetting } = require('./middleware/rateLimitMiddleware.js');
const { getRedisClient, closeRedis } = require('./config/redis');

const app = express();
app.disable('x-powered-by');
app.use(require('./middleware/securityHeaders').securityHeaders);
app.use(require('./services/auditRequestContext').auditRequestContext);

// Coolify puts its reverse proxy one hop in front of Git-based applications.
// Keep the explicit override for other deployments; trusting every hop would
// let clients choose their own rate-limit IP through forwarded headers.
if (process.env.TRUST_PROXY) {
  const proxy = process.env.TRUST_PROXY;
  app.set('trust proxy', proxy === 'false' ? false : /^\d+$/.test(proxy) ? Number(proxy) : proxy);
} else if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', process.env.COOLIFY_RESOURCE_UUID ? 1 : 'loopback');
}

const generalRates = {
  guestBurst: rateLimitSetting('RATE_LIMIT_GUEST_BURST', 80, 1, 10000),
  guestRefillMs: rateLimitSetting('RATE_LIMIT_GUEST_REFILL_MS', 500, 100, 3600000),
  userBurst: rateLimitSetting('RATE_LIMIT_USER_BURST', 120, 1, 10000),
  userRefillMs: rateLimitSetting('RATE_LIMIT_USER_REFILL_MS', 250, 100, 3600000),
};

const generalLimiter = createRateLimiter({
  scope: 'general',
  skip: req => (req.method === 'GET' && req.path === '/health') || isAuthPath(req.path),
  policy: req => {
    const key = getGeneralRateLimitKey(req);
    return key.startsWith('user:')
      ? { key, capacity: generalRates.userBurst, refillMs: generalRates.userRefillMs }
      : { key, capacity: generalRates.guestBurst, refillMs: generalRates.guestRefillMs };
  },
  message: { status: 429, error: 'Too many requests. Please wait briefly and retry.' },
});

const authLimiter = createRateLimiter({
  scope: 'auth',
  skip: req => isSessionAuthPath(req.path),
  capacity: rateLimitSetting('RATE_LIMIT_AUTH_BURST', 8, 1, 10000),
  refillMs: rateLimitSetting('RATE_LIMIT_AUTH_REFILL_MS', 60000, 100, 3600000),
  message: {
    status: 429,
    error: 'Too many authentication attempts, please try again later.',
  },
});

const authSessionLimiter = createRateLimiter({
  scope: 'auth-session',
  skip: req => !isSessionAuthPath(req.path),
  capacity: rateLimitSetting('RATE_LIMIT_SESSION_BURST', 40, 1, 10000),
  refillMs: rateLimitSetting('RATE_LIMIT_SESSION_REFILL_MS', 1500, 100, 3600000),
  message: { status: 429, error: 'Too many session requests, please try again later.' },
});

const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_PROD
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // In development, allow access from local network devices (e.g. phones/tablets on the same Wi-Fi)
      if (process.env.NODE_ENV !== 'production') {
        const isLan = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin);
        if (isLan) {
          callback(null, true);
          return;
        }
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token', 'X-Refresh-Token', 'Accept', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires'],
    exposedHeaders: ['Set-Cookie', 'X-New-Access-Token', 'Retry-After', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  })
);

app.use(generalLimiter);
app.use('/auth', authSessionLimiter, authLimiter);
app.use('/api/auth', authSessionLimiter, authLimiter);

// Small public forms should not consume the large upload limits used elsewhere.
app.use(/^\/(?:api\/)?auth(?:\/|$)/, express.json({ limit: '64kb' }), express.urlencoded({ limit: '64kb', extended: true }));
app.use('/api/contact', express.json({ limit: '16kb' }), express.urlencoded({ limit: '16kb', extended: true }));

// Five 5 MB images encoded as JSON require up to 36 MB on these customer routes.
app.use(/^\/api\/orders\/(?:[^/]+\/refund-request|refund-requests\/[^/]+\/return-evidence)$/, express.json({ limit: '36mb' }));
app.use(/^\/api\/(?:orders\/(?:[^/]+(?:\/dispatch-photos)?)|fulfillment\/requests\/[^/]+\/status|projects\/[^/]+\/build-claim\/status)$/, express.json({limit:'72mb'}));
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

app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
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
app.use('/api/contact', contactRoutes);
app.use('/api/installments', installmentRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/branch', branchRoutes);
app.use('/api/fulfillment', fulfillmentRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/user', userRoutes);

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;

async function startServer() {
  getRedisClient();
  await connectDB();

  server = http.createServer(app);
  const io = socketService.init(server, allowedOrigins);
  app.set('io', io);
  app.set('socketService', socketService);

  // Keep no-show status current even when no appointment list is being viewed.
  const appointmentService = require('./services/appointmentService');
  let noShowSweepRunning = false;
  const sweepNoShows = async () => {
    if (noShowSweepRunning) return;
    noShowSweepRunning = true;
    try {
      await appointmentService.autoMarkNoShows();
    } catch (error) {
      console.error('Appointment no-show sweep failed:', error.message);
    } finally {
      noShowSweepRunning = false;
    }
  };
  const noShowTimer = setInterval(sweepNoShows, 15000);
  noShowTimer.unref();
  server.on('close', () => clearInterval(noShowTimer));
  void sweepNoShows();

  server.listen(PORT, process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'), async () => {
    console.log(`Backend Running`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);

    // // Log OAuth config (mask secrets) to verify env vars are injected correctly in production
    // console.log('--- OAuth Configuration ---');
    // console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    // console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL || '(not set)'}`);
    // console.log(`FRONTEND_URL_PROD: ${process.env.FRONTEND_URL_PROD || '(not set)'}`);
    // console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? '***' : '(not set)'}`);
    // console.log(`GOOGLE_CALLBACK_URL: ${process.env.GOOGLE_CALLBACK_URL || '(not set)'}`);
    // console.log(`GOOGLE_CALLBACK_URL_PROD: ${process.env.GOOGLE_CALLBACK_URL_PROD || '(not set)'}`);

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
    closeRedis();
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
