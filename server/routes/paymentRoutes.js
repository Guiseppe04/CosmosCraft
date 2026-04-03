const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const paymentController = require('../controllers/paymentController');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '../uploads/proofs');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'proof-' + uniqueSuffix + ext);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) and PDF are allowed'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter,
});

router.use(authenticateToken);

router.post('/', paymentController.createPayment);

router.get('/methods', paymentController.getPaymentMethods);
router.get('/methods/:method/instructions', paymentController.getPaymentInstructions);

router.get('/stats', authorize('admin', 'staff'), paymentController.getPaymentStats);

router.get('/', paymentController.listPayments);

router.get('/users/:userId', paymentController.getUserPayments);

router.get('/:id', paymentController.getPayment);

router.post('/:id/upload-proof', upload.single('proof'), paymentController.uploadProof);

router.patch('/:id/verify', authorize('admin', 'staff'), paymentController.verifyPayment);

router.patch('/:id/reject', authorize('admin', 'staff'), paymentController.rejectPayment);

router.patch('/:id/refund', authorize('admin'), paymentController.refundPayment);

router.delete('/:id', paymentController.cancelPayment);

module.exports = router;
