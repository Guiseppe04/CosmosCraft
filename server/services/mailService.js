const nodemailer = require('nodemailer');

/**
 * Email Service - Send emails using Nodemailer
 * Supports both Gmail and custom SMTP configurations
 */

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: process.env.MAIL_PORT || 587,
  secure: process.env.MAIL_SECURE === 'true' || false, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
});

/**
 * Send a single email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body (HTML)
 * @param {string} options.text - Email body (Plain text fallback)
 * @returns {Promise<Object>} Transporter response
 */
exports.sendMail = async (options) => {
  try {
    const mailOptions = {
      from: process.env.MAIL_FROM || process.env.MAIL_USER,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

/**
 * Send verification email with OTP
 * @param {string} to - Recipient email
 * @param {string} otp - One-time password (6 digits)
 */
exports.sendVerificationEmail = async (to, otp) => {
  const subject = 'Verify Your CosmosCraft Account';
  const html = `
    <h2>Welcome to CosmosCraft!</h2>
    <p>Please verify your email address using the code below:</p>
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
      <h1 style="color: #d4af37; margin: 0; letter-spacing: 5px;">${otp}</h1>
      <p style="color: #666; margin: 10px 0 0 0;">This code expires in 15 minutes</p>
    </div>
    <p>If you didn't request this code, please ignore this email.</p>
    <p>CosmosCraft Team</p>
  `;

  const text = `Your CosmosCraft verification code is: ${otp} (expires in 15 minutes)`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetLink - Password reset URL
 */
exports.sendPasswordResetEmail = async (to, resetLink) => {
  const subject = 'Reset Your CosmosCraft Password';
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <a href="${resetLink}" style="background-color: #d4af37; color: #231f20; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Reset Password
    </a>
    <p>Or copy this link: ${resetLink}</p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  const text = `Reset your password by clicking: ${resetLink}`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send appointment confirmation email
 * @param {string} to - Recipient email
 * @param {Object} appointment - Appointment details
 */
exports.sendAppointmentConfirmation = async (to, appointment) => {
  const subject = 'Appointment Confirmation - CosmosCraft';
  const html = `
    <h2>Your Appointment is Confirmed!</h2>
    <p>Thank you for booking with CosmosCraft.</p>
    <h3>Appointment Details:</h3>
    <ul>
      <li><strong>Date:</strong> ${appointment.date || 'TBD'}</li>
      <li><strong>Time:</strong> ${appointment.time || 'TBD'}</li>
      <li><strong>Service:</strong> ${appointment.service || 'Custom Service'}</li>
      <li><strong>Status:</strong> ${appointment.status || 'Pending'}</li>
    </ul>
    <p>We look forward to serving you!</p>
    <p>CosmosCraft Team</p>
  `;

  const text = `Your appointment on ${appointment.date} at ${appointment.time} has been confirmed.`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send order confirmation email
 * @param {string} to - Recipient email
 * @param {Object} order - Order details
 */
exports.sendOrderConfirmation = async (to, order) => {
  const subject = 'Order Confirmation - CosmosCraft';
  const html = `
    <h2>Order Confirmed!</h2>
    <p>Thank you for your purchase.</p>
    <h3>Order Details:</h3>
    <ul>
      <li><strong>Order ID:</strong> ${order.id || 'N/A'}</li>
      <li><strong>Total Amount:</strong> $${order.total || '0.00'}</li>
      <li><strong>Status:</strong> ${order.status || 'Processing'}</li>
    </ul>
    <p>You will receive tracking information once your order ships.</p>
    <p>Thank you for your business!</p>
  `;

  const text = `Order #${order.id} has been confirmed. Total: $${order.total}`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Verify transporter connection on startup
 */
exports.verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✓ Email service connected successfully');
    return true;
  } catch (error) {
    console.error('✗ Email service connection failed:', error.message);
    return false;
  }
};

module.exports = exports;
