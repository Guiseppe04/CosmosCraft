require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const passport = require('passport');

const connectDB = require('./config/database.js');
const passportConfig = require('./config/passport.js');
const mailService = require('./services/mailService.js');
const authRoutes = require('./routes/authRoutes.js');
const userRoutes = require('./routes/userRoutes.js');
const { errorHandler, notFound } = require('./middleware/errorHandler.js');

const app = express();

// Helper function to get the correct frontend URL based on environment
const getFrontendUrl = () => {
  const prodUrl = process.env.FRONTEND_URL_PROD;
  const devUrl = process.env.FRONTEND_URL;

  if (prodUrl) {
    return prodUrl;
  }
  if (devUrl) {
    return devUrl;
  }
  throw new Error('Frontend URL not configured. Set FRONTEND_URL for development or FRONTEND_URL_PROD for production.');
};

connectDB();

app.use(
  cors({
    origin: getFrontendUrl(),
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

app.use('/auth', authRoutes);
app.use('/user', userRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {

  console.log(`Backend Running`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);


  // Verify email service connection
  await mailService.verifyConnection();
});

process.on('SIGTERM', () => {
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;