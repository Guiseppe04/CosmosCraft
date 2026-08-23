import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle, Clock, AlertCircle, Guitar, DollarSign, Calendar,
  CreditCard, RefreshCw, HelpCircle, Info, Layers, Hammer,
  CheckSquare, FileText, ChevronDown, ChevronUp, Package, Truck, ShieldCheck,
  X, Upload, QrCode, Eye, Loader2, Check
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { resolveImageUrl } from '../../utils/apiConfig';

const formatLabel = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatStatus = (status) => {
  if (!status) return 'Not Started';
  const map = {
    'not_started': 'Not Started',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'on_hold': 'On Hold',
    'pending': 'Pending',
    'delivered': 'Delivered',
  };
  return map[status] || formatLabel(status);
};

const formatDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatShortDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
};

const REFUND_STATUS_CONFIG = {
  pending: { label: 'Refund Request Pending Review', className: 'border-amber-500/30 text-amber-400 bg-amber-500/10' },
  'pending_payment_verification': { label: 'Refund Awaiting Payment Verification', className: 'border-violet-500/30 text-violet-400 bg-violet-500/10' },
  approved: { label: 'Refund Approved', className: 'border-green-500/30 text-green-400 bg-green-500/10' },
  processing: { label: 'Refund Processing', className: 'border-sky-500/30 text-sky-400 bg-sky-500/10' },
  rejected: { label: 'Refund Rejected', className: 'border-red-500/30 text-red-400 bg-red-500/10' },
  refunded: { label: 'Refund Completed', className: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' },
  no_refund_due: { label: 'No Refund Due', className: 'border-gray-500/30 text-gray-400 bg-gray-500/10' },
};

const getCompoundCancellationInfo = (project, settlement) => {
  if (!project) return null;
  const isCancelled = String(project.status || '').toLowerCase() === 'cancelled';
  const cancelRequested = Boolean(project.cancel_requested_at && !project.cancel_approved_at);

  if (cancelRequested) {
    return {
      title: 'Cancellation Requested — Under Admin Review',
      subtitle: 'Your cancellation request is currently under review by an administrator.',
      badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    };
  }

  if (!isCancelled) return null;

  const resolution = project.cancel_resolution || settlement?.resolution?.actual || settlement?.resolution?.recommended || 'no_refund';
  const refundStatus = project.refund_status || settlement?.refund_status;
  const refundAmount = settlement?.qa?.how_much_refund ?? settlement?.financials?.refundable_amount ?? project.refund_approved_amount ?? project.refund_amount_requested ?? 0;

  if (refundStatus === 'refunded') {
    return {
      title: `Project Cancelled — Refund Completed (${formatCurrency(refundAmount)})`,
      subtitle: 'Your refund has been disbursed. Thank you for choosing CosmosCraft.',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    };
  }
  if (refundStatus === 'processing') {
    return {
      title: `Project Cancelled — Refund Processing (${formatCurrency(refundAmount)})`,
      subtitle: 'Your refund has been approved and is currently being processed by finance.',
      badgeClass: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    };
  }
  if (refundStatus === 'approved') {
    return {
      title: `Project Cancelled — Refund Approved (${formatCurrency(refundAmount)})`,
      subtitle: 'Your refund has been approved by admin and queued for payout.',
      badgeClass: 'border-green-500/40 bg-green-500/10 text-green-300',
    };
  }
  if (refundStatus === 'pending_payment_verification') {
    return {
      title: 'Project Cancelled — Payment Verification Pending',
      subtitle: 'We are verifying your payment proof before processing your refund.',
      badgeClass: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    };
  }
  if (resolution === 'partial_refund_and_build') {
    return {
      title: `Project Cancelled — Partial Refund (${formatCurrency(refundAmount)}) & Build Claim`,
      subtitle: 'You receive a partial refund and the guitar in its current build state.',
      badgeClass: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    };
  }
  if (resolution === 'partial_refund_and_parts') {
    return {
      title: `Project Cancelled — Partial Refund (${formatCurrency(refundAmount)}) & Parts Release`,
      subtitle: 'You receive a partial refund and the acquired parts/materials for your build.',
      badgeClass: 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
    };
  }
  if (resolution === 'parts_released') {
    return {
      title: 'Project Cancelled — Acquired Parts Awaiting Fulfillment',
      subtitle: 'Payment was used for custom build parts. Your parts are ready for pickup or delivery.',
      badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    };
  }
  if (resolution === 'full_refund' || refundStatus === 'pending') {
    return {
      title: `Project Cancelled — Refund Pending Review (${formatCurrency(refundAmount)})`,
      subtitle: '100% of your verified payment is eligible for refund.',
      badgeClass: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
    };
  }

  return {
    title: 'Project Cancelled — Settlement Finalized',
    subtitle: 'Project has been closed with all accounts reconciled.',
    badgeClass: 'border-red-500/40 bg-red-500/10 text-red-300',
  };
};

function PayInstallmentModal({ isOpen, installment, projectId, onClose, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    setPaymentMethod('gcash');
    setReferenceNumber('');
    setReceiptFile(null);
    setReceiptPreview(null);
    setError('');
    setSubmitting(false);

    const fetchSettings = async () => {
      try {
        const res = await adminApi.getPaymentSettings();
        if (res?.success && res?.data) {
          setPaymentSettings(res.data);
        }
      } catch {
        // Fallback
      }
    };
    fetchSettings();
  }, [isOpen]);

  if (!isOpen || !installment) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setReceiptPreview(reader.result);
      reader.readAsDataURL(file);
      setError('');
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();

    try {
      setSubmitting(true);
      setError('');
      const formData = new FormData();
      if (referenceNumber.trim()) {
        formData.append('reference_number', referenceNumber.trim());
      }
      formData.append('method', paymentMethod);
      if (receiptFile) {
        formData.append('proof', receiptFile);
      }

      const res = await adminApi.submitInstallmentPayment(projectId, installment.schedule_id, formData);
      onSuccess(res?.data || res);
    } catch (err) {
      setError(err.message || 'Failed to submit installment payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const gcashInfo = paymentSettings?.gcash || {
    accountNumber: '0917 123 4567',
    accountName: 'CosmosCraft Official',
    qrCode: '/gcashqrcode.png',
  };

  const bankInfo = paymentSettings?.bankTransfer || {
    bankName: 'BDO Unibank',
    accountName: 'CosmosCraft Guitar Shop',
    accountNumber: '1234 5678 9012',
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[var(--surface-dark)] border border-[var(--gold-primary)]/30 rounded-3xl p-6 sm:p-8 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--gold-primary)]/20 border border-[var(--gold-primary)]/40 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg">Pay Installment #{installment.installment_number}</h3>
              <p className="text-xs text-[var(--text-muted)]">Due: {formatShortDate(installment.due_date)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-[var(--text-muted)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="rounded-2xl border border-[var(--gold-primary)]/30 bg-gradient-to-r from-[var(--gold-primary)]/15 via-[var(--bg-primary)] to-[var(--surface-dark)] p-4 mb-5">
          <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold">Amount Due</p>
          <p className="text-2xl font-bold text-[var(--gold-primary)] mt-0.5">{formatCurrency(installment.amount)}</p>
        </div>

        <div className="mb-5">
          <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('gcash')}
              className={`p-3.5 rounded-2xl border text-sm font-semibold transition-all flex flex-col items-center gap-2 ${
                paymentMethod === 'gcash'
                  ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/40 hover:text-white'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white font-bold text-xs flex items-center justify-center">G</div>
              <span>GCash</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('bank_transfer')}
              className={`p-3.5 rounded-2xl border text-sm font-semibold transition-all flex flex-col items-center gap-2 ${
                paymentMethod === 'bank_transfer'
                  ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)] shadow-[0_0_15px_rgba(212,175,55,0.2)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--gold-primary)]/40 hover:text-white'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-green-500 text-white font-bold text-xs flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <span>Bank Transfer</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/70 p-4 mb-5 space-y-3">
          {paymentMethod === 'gcash' ? (
            <div className="text-center">
              <p className="text-xs text-[var(--text-muted)] mb-2 font-medium">Scan QR Code or send to GCash number</p>
              {gcashInfo.qrCode && (
                <div className="mx-auto w-36 h-36 bg-white rounded-xl p-2 shadow-md mb-3 flex items-center justify-center">
                  <img src={gcashInfo.qrCode} alt="GCash QR Code" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="bg-[var(--surface-dark)] rounded-xl p-2.5 border border-[var(--border)] text-xs">
                <p className="text-[var(--text-muted)]">Account Name: <span className="text-white font-semibold">{gcashInfo.accountName || 'CosmosCraft'}</span></p>
                <p className="text-[var(--text-muted)] mt-0.5">GCash Number: <span className="text-[var(--gold-primary)] font-mono font-bold text-sm">{gcashInfo.accountNumber || '0917 123 4567'}</span></p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <p className="text-xs text-[var(--text-muted)] mb-1 font-medium text-center">Transfer to the shop bank account</p>
              <div className="bg-[var(--surface-dark)] rounded-xl p-3 border border-[var(--border)] space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Bank Name:</span>
                  <span className="text-white font-semibold">{bankInfo.bankName || 'BDO Unibank'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Account Name:</span>
                  <span className="text-white font-semibold">{bankInfo.accountName || 'CosmosCraft Guitar Shop'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Account Number:</span>
                  <span className="text-[var(--gold-primary)] font-mono font-bold">{bankInfo.accountNumber || '1234 5678 9012'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">
              Payment Reference Number
            </label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => { setReferenceNumber(e.target.value); setError(''); }}
              placeholder={paymentMethod === 'gcash' ? 'e.g., GCash Ref #100293849182' : 'e.g., Bank Ref / Trace #98371928'}
              className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1.5">
              Upload Payment Receipt / Proof
            </label>
            {receiptPreview ? (
              <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-3 flex items-center gap-3">
                <img src={receiptPreview} alt="Receipt preview" className="w-14 h-14 rounded-xl object-cover border border-[var(--border)]" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{receiptFile?.name || 'receipt-image'}</p>
                  <p className="text-[var(--text-muted)] text-[10px]">{Math.round((receiptFile?.size || 0) / 1024)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveReceipt}
                  className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-medium hover:bg-red-500/20 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-primary)]/50 p-5 cursor-pointer hover:border-[var(--gold-primary)]/50 hover:bg-[var(--surface-dark)] transition-all">
                <Upload className="w-6 h-6 text-[var(--gold-primary)] mb-1.5" />
                <p className="text-xs font-semibold text-white">Click or drag image to upload proof</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5">PNG, JPG, JPEG, WebP, or PDF (Max 10MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm font-semibold text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-bold text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Submit Payment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function ViewSubmittedPaymentModal({ isOpen, installment, onClose }) {
  if (!isOpen || !installment) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Info className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-bold text-lg">Installment #{installment.installment_number} Payment</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors text-[var(--text-muted)] hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-sm">
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-amber-300 text-xs">
            <p className="font-semibold">Payment Verification Pending</p>
            <p className="mt-0.5 opacity-90">Your payment has been submitted and is currently being verified by the admin team.</p>
          </div>

          <div className="bg-[var(--bg-primary)] rounded-2xl p-4 border border-[var(--border)] space-y-2.5">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Amount:</span>
              <span className="text-[var(--gold-primary)] font-bold text-base">{formatCurrency(installment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Method:</span>
              <span className="text-white capitalize">{formatLabel(installment.payment_method || 'GCash')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Reference Number:</span>
              <span className="text-white font-mono">{installment.payment_reference || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Submitted Date:</span>
              <span className="text-white">{formatDate(installment.submitted_at || installment.updated_at)}</span>
            </div>
          </div>

          {installment.payment_proof_url && (
            <div>
              <p className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2">Uploaded Proof</p>
              <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-black/40 max-h-56">
                <img src={resolveImageUrl(installment.payment_proof_url)} alt="Uploaded Proof" className="w-full h-auto object-contain" />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[var(--surface-dark)] border border-[var(--border)] text-sm font-semibold text-white hover:bg-white/5 transition-colors mt-2"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PaymentSubmittedModal({ isOpen, data, onClose }) {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-[var(--surface-dark)] border border-green-500/40 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-center"
      >
        <div className="w-14 h-14 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center mx-auto mb-4 text-green-400">
          <CheckCircle className="w-8 h-8" />
        </div>

        <h3 className="text-xl font-bold text-white">Payment Submitted</h3>
        <p className="text-sm text-[var(--text-muted)] mt-1.5">
          Your payment for <span className="text-white font-semibold">Installment #{data.installmentNumber}</span> has been submitted and is waiting for verification.
        </p>

        <div className="mt-5 bg-[var(--bg-primary)] rounded-2xl p-4 border border-[var(--border)] text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Installment Amount:</span>
            <span className="text-[var(--gold-primary)] font-bold text-sm">{formatCurrency(data.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Payment Method:</span>
            <span className="text-white capitalize">{formatLabel(data.method)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Reference Number:</span>
            <span className="text-white font-mono font-semibold">{data.referenceNumber || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Submitted Date:</span>
            <span className="text-white">{formatDate(data.submittedAt)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[var(--border)]">
            <span className="text-[var(--text-muted)]">Payment Status:</span>
            <span className="text-amber-400 font-semibold">Payment Verification Pending</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-sm font-bold text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all"
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
}

export default function CustomerProjectTracker({ projectId, projectName, projectData, customBuildId }) {
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [installmentData, setInstallmentData] = useState(null);
  const [installmentLoading, setInstallmentLoading] = useState(false);
  const [refundEligibility, setRefundEligibility] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundMessage, setRefundMessage] = useState(null);
  const [settlementData, setSettlementData] = useState(null);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState(true);

  // Installment payment interaction states
  const [payingInstallment, setPayingInstallment] = useState(null);
  const [viewingInstallment, setViewingInstallment] = useState(null);
  const [confirmedPayment, setConfirmedPayment] = useState(null);
  const [installmentMessage, setInstallmentMessage] = useState(null);

  // Build claim state
  const [buildClaim, setBuildClaim] = useState(null);
  const [buildClaimLoading, setBuildClaimLoading] = useState(false);
  const [markReceivedLoading, setMarkReceivedLoading] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadData();
      loadInstallments();
      loadRefundEligibility();
      loadBuildClaim();
      loadSettlement();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const hierarchyRes = await adminApi.getProjectHierarchy(projectId);
      setHierarchy(hierarchyRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInstallments = async () => {
    try {
      setInstallmentLoading(true);
      const res = await adminApi.getProjectInstallments(projectId);
      setInstallmentData(res.data);
    } catch (err) {
      console.error('Failed to load installments:', err);
    } finally {
      setInstallmentLoading(false);
    }
  };

  const loadRefundEligibility = async () => {
    if (!projectId) return;
    try {
      setRefundLoading(true);
      const res = await adminApi.getProjectRefundEligibility(projectId);
      setRefundEligibility(res.data);
    } catch (err) {
      console.error('Failed to load refund eligibility:', err);
      setRefundEligibility(null);
    } finally {
      setRefundLoading(false);
    }
  };

  const loadSettlement = async () => {
    if (!projectId) return;
    try {
      setSettlementLoading(true);
      const res = await adminApi.getProjectCancellationSettlement(projectId);
      setSettlementData(res?.data || null);
    } catch (err) {
      console.warn('Failed to load cancellation settlement:', err);
      setSettlementData(null);
    } finally {
      setSettlementLoading(false);
    }
  };

  const handleRequestRefund = async () => {
    if (!projectId || !refundReason.trim()) return;
    try {
      setRefundSubmitting(true);
      await adminApi.requestProjectRefund(projectId, {
        reason: refundReason.trim(),
        amount_requested: refundEligibility?.refundable_amount,
      });
      setRefundMessage({ type: 'success', text: 'Refund request submitted. An admin will review it shortly.' });
      setRefundReason('');
      setRefundEligibility(null);
      await loadSettlement();
      await loadData();
    } catch (err) {
      setRefundMessage({ type: 'error', text: err.message });
    } finally {
      setRefundSubmitting(false);
    }
  };

  const loadBuildClaim = async () => {
    if (!projectId) return;
    try {
      setBuildClaimLoading(true);
      const res = await adminApi.getBuildClaim(projectId);
      setBuildClaim(res?.data || null);
    } catch (err) {
      // No claim exists — this is normal for projects cancelled without progress
      setBuildClaim(null);
    } finally {
      setBuildClaimLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!projectId) return;
    try {
      setMarkReceivedLoading(true);
      await adminApi.markBuildClaimReceived(projectId);
      await loadBuildClaim();
      await loadSettlement();
    } catch (err) {
      console.error('Failed to mark as received:', err);
    } finally {
      setMarkReceivedLoading(false);
    }
  };

  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };
  const clampedProgress = Math.min(Math.max(Number(hierarchy?.progress) || 0, 0), 100);
  const milestones = Array.isArray(hierarchy?.milestones) ? hierarchy.milestones : [];

  // Find current milestone
  const currentMilestone = milestones.find((m) => {
    const subtasks = Array.isArray(m?.subtasks) ? m.subtasks : [];
    if (subtasks.length > 0) {
      return subtasks.some((s) => s.status === 'pending' || s.status === 'in_progress');
    }
    if (m.status === 'completed') return false;
    const idx = milestones.indexOf(m);
    if (idx === 0) return true;
    const prev = milestones[idx - 1];
    const prevSubtasks = Array.isArray(prev?.subtasks) ? prev.subtasks : [];
    return prevSubtasks.length > 0 ? prevSubtasks.every(s => s.status === 'completed') : prev.status === 'completed';
  });

  const currentTask = currentMilestone?.subtasks?.find((s) => s.status === 'pending' || s.status === 'in_progress');

  const estimatedCompletion = formatShortDate(
    hierarchy?.estimated_completion_date ||
    projectData?.estimated_completion_date
  );

  const lastUpdated = formatDate(hierarchy?.updated_at || hierarchy?.claimed_at || hierarchy?.created_at);

  const installmentSummary = installmentData?.summary;
  const paymentPlan = installmentData?.payment_plan;
  const isFullPayment = paymentPlan === 'full_payment';

  // Compute payment status
  const getPaymentStatus = () => {
    if (!installmentSummary || !installmentSummary.total_months) return null;
    const { paid_count, total_months } = installmentSummary;
    if (paid_count === 0) return { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30' };
    if (paid_count >= total_months) return { label: 'Fully Paid', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' };
    return { label: 'Ongoing', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' };
  };

  const paymentStatus = getPaymentStatus();

  // Refund status from the project payload
  const refundStatus = hierarchy?.refund_status || settlementData?.refund_status || null;
  const refundStatusConfig = refundStatus ? (REFUND_STATUS_CONFIG[refundStatus] || REFUND_STATUS_CONFIG.pending) : null;

  // Last completed stage
  const lastCompletedStage = hierarchy?.cancelled_stage_snapshot || hierarchy?.last_completed_stage || null;
  const lastCompletedStageAt = hierarchy?.cancelled_stage_snapshot_at || hierarchy?.last_completed_stage_at || null;

  const isCancelled = String(hierarchy?.status || '').toLowerCase() === 'cancelled';
  const compoundCancellation = isCancelled ? getCompoundCancellationInfo(hierarchy, settlementData) : null;
  const qa = settlementData?.qa;
  const fin = settlementData?.financials;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--gold-primary)] border-t-transparent" />
          <p className="text-sm text-[var(--text-muted)]">Loading progress...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">Unable to load project progress. Please try again later.</p>
        </div>
      </div>
    );
  }

  if (!hierarchy) return null;

  return (
    <div className="space-y-6">
      {/* Cancellation Settlement Header (when cancelled) */}
      {isCancelled && compoundCancellation && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-6 shadow-xl ${compoundCancellation.badgeClass}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-black/30 border-white/20">
                  Project Status & Settlement
                </span>
                {hierarchy.cancel_resolution && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white">
                    {formatLabel(hierarchy.cancel_resolution)}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {compoundCancellation.title}
              </h2>
              <p className="mt-1 text-sm text-white/80 max-w-2xl">
                {compoundCancellation.subtitle}
              </p>
            </div>
            {fin && (
              <div className="rounded-xl bg-black/40 border border-white/10 p-4 text-right min-w-[180px]">
                <p className="text-[11px] uppercase tracking-wider text-white/60">Refundable Balance</p>
                <p className="text-2xl font-black text-[var(--gold-primary)] mt-0.5">
                  {formatCurrency(fin.refundable_amount)}
                </p>
                <p className="text-[11px] text-white/60 mt-1">
                  Paid: {formatCurrency(fin.total_paid)}
                </p>
              </div>
            )}
          </div>

          {/* Dynamic Multi-State Cancellation Lifecycle Timeline */}
          <div className="mt-6 pt-6 border-t border-white/15">
            <p className="text-xs uppercase tracking-[0.14em] text-white/70 font-semibold mb-3">
              Cancellation Resolution Lifecycle
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Step 1: Cancellation Requested */}
              <div className={`p-3 rounded-xl border ${hierarchy.cancel_requested_at ? 'bg-black/30 border-white/20 text-white' : 'bg-black/10 border-white/5 text-white/40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className={`w-4 h-4 ${hierarchy.cancel_requested_at ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className="text-xs font-bold">1. Requested</span>
                </div>
                <p className="text-[11px] text-white/70">
                  {hierarchy.cancel_requested_at ? formatShortDate(hierarchy.cancel_requested_at) : 'Initiated'}
                </p>
              </div>

              {/* Step 2: Admin Resolution Approved */}
              <div className={`p-3 rounded-xl border ${hierarchy.cancel_approved_at ? 'bg-black/30 border-white/20 text-white' : 'bg-black/10 border-white/5 text-white/40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className={`w-4 h-4 ${hierarchy.cancel_approved_at ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className="text-xs font-bold">2. Settlement Decision</span>
                </div>
                <p className="text-[11px] text-white/70">
                  {hierarchy.cancel_approved_at ? formatShortDate(hierarchy.cancel_approved_at) : 'Pending Review'}
                </p>
              </div>

              {/* Step 3: Payment Verification & Refund Processing */}
              <div className={`p-3 rounded-xl border ${refundStatus === 'refunded' || refundStatus === 'processing' || refundStatus === 'approved' ? 'bg-black/30 border-white/20 text-white' : 'bg-black/10 border-white/5 text-white/40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {refundStatus === 'refunded' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : refundStatus === 'processing' || refundStatus === 'approved' ? (
                    <Clock className="w-4 h-4 text-sky-400" />
                  ) : (
                    <Info className="w-4 h-4 text-white/30" />
                  )}
                  <span className="text-xs font-bold">3. Finance & Payout</span>
                </div>
                <p className="text-[11px] text-white/70 capitalize">
                  {refundStatus ? formatStatus(refundStatus) : 'Reconciliation'}
                </p>
              </div>

              {/* Step 4: Fulfillment / Completion */}
              <div className={`p-3 rounded-xl border ${buildClaim?.claim_status === 'received' || refundStatus === 'refunded' || hierarchy.cancel_resolution === 'no_refund' ? 'bg-black/30 border-white/20 text-white' : 'bg-black/10 border-white/5 text-white/40'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className={`w-4 h-4 ${buildClaim?.claim_status === 'received' || refundStatus === 'refunded' ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className="text-xs font-bold">4. Final Handover</span>
                </div>
                <p className="text-[11px] text-white/70 capitalize">
                  {buildClaim?.claim_status ? formatStatus(buildClaim.claim_status) : (refundStatus === 'refunded' ? 'Complete' : 'Pending Action')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Progress Header */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">{projectName || hierarchy.name || hierarchy.title || 'Custom Build'}</h2>
          {customBuildId && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Custom Build ID: {customBuildId}
            </p>
          )}
        </div>

        {/* Status & Progress */}
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          {String(hierarchy.status || '').toLowerCase() === 'on_hold' ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:col-span-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
                  <Clock className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.14em] text-amber-300/70">Status</p>
                  <p className="text-lg font-bold text-amber-300">On Hold</p>
                </div>
              </div>
              {hierarchy.hold_reason && (
                <p className="mt-2 text-sm text-amber-200/80 pl-11">
                  Reason: {hierarchy.hold_reason}
                </p>
              )}
              {hierarchy.hold_requested_at && (
                <p className="mt-1 text-xs text-amber-300/60 pl-11">
                  Placed on hold: {formatDate(hierarchy.hold_requested_at)}
                </p>
              )}
              {hierarchy.hold_at_step && (
                <p className="mt-1 text-xs text-amber-300/60 pl-11">
                  Paused at: {formatLabel(hierarchy.hold_at_step)}
                </p>
              )}
              <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                <p className="text-xs text-amber-200/70">
                  Manufacturing is paused. Staff cannot complete or start any build tasks until you resume the project. You can resume it from your dashboard.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Status</p>
              <p className="mt-2 text-lg font-bold text-white">{formatStatus(hierarchy.status)}</p>
            </div>
          )}
           <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
             <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Progress</p>
             <p className="mt-2 text-lg font-bold text-[var(--gold-primary)]">{clampedProgress}%</p>
           </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[var(--text-muted)]">Overall Progress</span>
            <span className="text-sm font-semibold text-white">{taskSummary.completed} of {taskSummary.total} tasks</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${clampedProgress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
            />
          </div>
        </div>

        {/* Current Build Progress */}
        {milestones.length > 0 ? (
          <div className="rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-5">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold-primary)]/20">
                {currentMilestone ? (
                  <Clock className="h-5 w-5 text-[var(--gold-primary)]" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">
                  {currentMilestone ? 'Current Build Progress' : 'Manufacturing Complete'}
                </p>
                <p className="mt-1.5 font-semibold text-white text-lg">
                  {currentMilestone ? formatLabel(currentMilestone.title) : 'All Steps Completed'}
                </p>
                {currentTask && (
                  <p className="mt-1.5 text-sm text-[var(--gold-primary)]">
                    Current Task: {formatLabel(currentTask.title)}
                  </p>
                )}

                {/* Step progress indicator */}
                {milestones.length > 0 && (
                  <div className="mt-4 flex items-center gap-2">
                    {milestones.map((m, i) => {
                      const subtasks = Array.isArray(m?.subtasks) ? m.subtasks : [];
                      const isStepComplete = subtasks.length > 0
                        ? subtasks.every(s => s.status === 'completed')
                        : m.status === 'completed';
                      const isCurrentStep = m.milestone_id === currentMilestone?.milestone_id;

                      return (
                        <div key={m.milestone_id} className="flex items-center gap-1">
                          <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                            isStepComplete
                              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                              : isCurrentStep
                              ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border border-[var(--gold-primary)]/40'
                              : 'bg-white/5 text-[var(--text-muted)] border border-[var(--border)]'
                          }`}>
                            {isStepComplete ? (
                              <CheckCircle className="h-3.5 w-3.5" />
                            ) : (
                              i + 1
                            )}
                          </div>
                          {i < milestones.length - 1 && (
                            <div className={`h-px w-4 ${
                              isStepComplete ? 'bg-green-500/40' : 'bg-[var(--border)]'
                            }`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 text-center">
            <Guitar className="mx-auto h-8 w-8 text-[var(--text-muted)]/30 mb-2" />
            <p className="text-white font-semibold">Build Not Yet Started</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              The manufacturing process will begin once a staff member claims this project.
            </p>
          </div>
        )}

        {/* 11 Critical Questions & Answers Resolution Card (When Cancelled) */}
        {false && isCancelled && qa && ( // Remove the false && to return
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] overflow-hidden shadow-lg">
            <div
              onClick={() => setExpandedQuestions(!expandedQuestions)}
              className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-[var(--border)]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--gold-primary)]/15 flex items-center justify-center text-[var(--gold-primary)]">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base sm:text-lg">
                    Frequently Asked Questions About Your Cancellation
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Clear answers to payments, parts, labor value, refunds, and physical item release
                  </p>
                </div>
              </div>
              <button className="p-2 text-[var(--text-muted)] hover:text-white transition-colors">
                {expandedQuestions ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>

            <AnimatePresence>
              {expandedQuestions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-5 divide-y divide-[var(--border)] space-y-4"
                >
                  {/* Q1: Why was my project cancelled? */}
                  <div className="pt-3 first:pt-0">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">1.</span> Why was my project cancelled?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.why_cancelled}
                    </p>
                  </div>

                  {/* Q2: How much did I pay? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">2.</span> How much did I pay?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      You have a verified total payment of <strong className="text-white">{formatCurrency(qa.how_much_paid)}</strong>.
                    </p>
                  </div>

                  {/* Q3: What happened to my payment? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">3.</span> What happened to my payment?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.what_happened_to_payment}
                    </p>
                  </div>

                  {/* Q4: How much refund will I receive? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">4.</span> How much refund will I receive?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      Eligible refund amount: <strong className="text-[var(--gold-primary)]">{formatCurrency(qa.how_much_refund)}</strong>.
                    </p>
                  </div>

                  {/* Q5: Why is this amount refundable vs non-refundable? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">5.</span> Why is this amount refundable vs non-refundable?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.why_refundable}
                    </p>
                  </div>

                  {/* Q6: What happened to the parts purchased for my build? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">6.</span> What happened to the parts purchased for my build?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.what_happened_to_parts}
                    </p>
                  </div>

                  {/* Q7: What happened to the work and woodworking performed? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">7.</span> What happened to the work performed on my guitar?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.what_happened_to_work}
                    </p>
                  </div>

                  {/* Q8: Do I receive any physical parts or the unfinished guitar? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">8.</span> Do I receive any physical parts or the unfinished guitar build?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.do_i_receive_items}
                    </p>
                  </div>

                  {/* Q9: When will I receive my refund? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">9.</span> When will I receive my refund?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.when_refund}
                    </p>
                  </div>

                  {/* Q10: Where and how do I receive physical items? */}
                  <div className="pt-3">
                    <p className="text-sm font-semibold text-white flex items-center gap-2">
                      <span className="text-[var(--gold-primary)] font-bold">10.</span> Where and how do I receive my physical parts or guitar?
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                      {qa.where_receive_items}
                    </p>
                  </div>

                  {/* Q11: What is my refund / claim reference number? */}
                  {qa.refund_reference_number && (
                    <div className="pt-3">
                      <p className="text-sm font-semibold text-white flex items-center gap-2">
                        <span className="text-[var(--gold-primary)] font-bold">11.</span> What is my refund / settlement reference number?
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 pl-5 leading-relaxed">
                        Reference Number: <span className="font-mono text-white font-bold bg-white/10 px-2 py-0.5 rounded">{qa.refund_reference_number}</span>
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Financial Settlement Breakdown Grid (When Cancelled) */}
        {isCancelled && fin && (
          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)] font-semibold mb-4">
              Financial Breakdown & Cost Accounting
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Total Order Value</p>
                <p className="text-lg font-bold text-white mt-1">{formatCurrency(fin.total_price)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Verified Money Paid</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">{formatCurrency(fin.total_paid)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Parts / Materials Cost</p>
                <p className="text-lg font-bold text-white mt-1">{formatCurrency(fin.parts_purchased_cost)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-3.5">
                <p className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Completed Labor Value</p>
                <p className="text-lg font-bold text-white mt-1">{formatCurrency(fin.completed_labor_cost)}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[var(--text-muted)]">
                Incurred Costs: <span className="text-white font-semibold">{formatCurrency(fin.non_refundable_total)}</span>
              </div>
              <div className="text-sm font-bold text-white">
                Final Refundable Balance:{' '}
                <span className="text-[var(--gold-primary)] text-base font-extrabold ml-1">
                  {formatCurrency(fin.refundable_amount)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Last Completed Stage (what the customer receives if cancelled now) */}
        <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Current Build — What You Receive</p>
          {lastCompletedStage ? (
            <div className="mt-2 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="text-white font-semibold">{formatLabel(lastCompletedStage)}</p>
                {lastCompletedStageAt && (
                  <p className="text-xs text-[var(--text-muted)]">Completed {formatDate(lastCompletedStageAt)}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-[var(--text-muted)] shrink-0" />
              <p className="text-sm text-[var(--text-muted)]">No completed build available.</p>
            </div>
          )}
        </div>

        {/* Cancellation Info */}
        {String(hierarchy.status || '').toLowerCase() === 'cancelled' && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-red-300/70">Cancellation</p>
            <p className="mt-2 text-sm text-white">
              {hierarchy.cancel_reason || 'Cancelled'}
            </p>
            {hierarchy.cancel_approved_at && (
              <p className="mt-1 text-xs text-red-300/60">
                Cancelled on {formatDate(hierarchy.cancel_approved_at)}
              </p>
            )}
          </div>
        )}

        {/* Current Build Claim Tracking */}
        {buildClaim && String(hierarchy.status || '').toLowerCase() === 'cancelled' && (
          <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-amber-300/70">Current Build Claim</p>

            {/* Claim status badge */}
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${
                buildClaim.claim_status === 'received' ? 'border-emerald-500/30 text-emerald-400' :
                buildClaim.claim_status === 'delivered' || buildClaim.claim_status === 'picked_up' ? 'border-sky-500/30 text-sky-400' :
                buildClaim.claim_status === 'out_for_delivery' || buildClaim.claim_status === 'courier_arranged' ? 'border-blue-500/30 text-blue-400' :
                buildClaim.claim_status === 'ready_for_delivery' || buildClaim.claim_status === 'ready_for_pickup' ? 'border-cyan-500/30 text-cyan-400' :
                'border-amber-500/30 text-amber-400'
              }`}>
                {formatStatus(buildClaim.claim_status)}
              </span>
              {buildClaim.claim_method && (
                <span className="text-xs text-[var(--text-muted)] capitalize">
                  via {buildClaim.claim_method === 'courier' ? 'Courier Delivery' : 'Pickup'}
                </span>
              )}
            </div>

            {/* Build state snapshot */}
            {buildClaim.build_state_snapshot && Array.isArray(buildClaim.build_state_snapshot) && (
              <div className="mt-4 space-y-1.5">
                {buildClaim.build_state_snapshot.map((stage, idx) => (
                  <div key={stage.milestone_id || idx} className="flex items-center gap-2">
                    {stage.status === 'completed' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    ) : stage.status === 'in_progress' ? (
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[var(--border)] shrink-0" />
                    )}
                    <span className={`text-xs ${stage.status === 'completed' ? 'text-emerald-300' : stage.status === 'in_progress' ? 'text-amber-300' : 'text-[var(--text-muted)]'}`}>
                      {stage.title}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Progress + amount */}
            <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Progress at Cancellation</span>
              <span className="text-white font-semibold">{buildClaim.progress_at_cancellation}%</span>
            </div>
            {Number(buildClaim.amount_paid) > 0 && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-[var(--text-muted)]">Amount Paid</span>
                <span className="text-[var(--gold-primary)] font-semibold">{formatCurrency(buildClaim.amount_paid)}</span>
              </div>
            )}

            {/* Current state photos */}
            {buildClaim.current_state_photos && buildClaim.current_state_photos.length > 0 && (
              <div className="mt-3 pt-3 border-t border-amber-500/20">
                <p className="text-xs text-[var(--text-muted)] mb-2">Current State Photos</p>
                <div className="flex gap-2 flex-wrap">
                  {buildClaim.current_state_photos.map((url, i) => (
                    <img key={i} src={url} alt={`Build state ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-[var(--border)]" />
                  ))}
                </div>
              </div>
            )}

            {/* Courier/delivery info */}
            {buildClaim.claim_method === 'courier' && buildClaim.courier_service && (
              <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Courier</span>
                  <span className="text-white">{buildClaim.courier_service}</span>
                </div>
                {buildClaim.courier_reference && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Reference</span>
                    <span className="text-white font-mono">{buildClaim.courier_reference}</span>
                  </div>
                )}
                {buildClaim.estimated_delivery_date && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--text-muted)]">Est. Delivery</span>
                    <span className="text-white">{formatShortDate(buildClaim.estimated_delivery_date)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Pickup info */}
            {buildClaim.claim_method === 'pickup' && buildClaim.pickup_location && (
              <div className="mt-3 pt-3 border-t border-amber-500/20">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--text-muted)]">Pickup Location</span>
                  <span className="text-white">{buildClaim.pickup_location}</span>
                </div>
              </div>
            )}

            {/* Admin confirmation notes */}
            {buildClaim.admin_confirmation_notes && (
              <div className="mt-3 pt-3 border-t border-amber-500/20">
                <p className="text-xs text-[var(--text-muted)] mb-1">Admin Notes</p>
                <p className="text-sm text-white">{buildClaim.admin_confirmation_notes}</p>
              </div>
            )}

            {/* Mark as Received button */}
            {['delivered', 'picked_up'].includes(buildClaim.claim_status) && (
              <button
                onClick={handleMarkReceived}
                disabled={markReceivedLoading}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-50"
              >
                {markReceivedLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {markReceivedLoading ? 'Confirming...' : 'Confirm Guitar Received'}
              </button>
            )}

            {buildClaim.claim_status === 'received' && buildClaim.received_at && (
              <p className="mt-2 text-xs text-emerald-300/70">
                Received on {formatDate(buildClaim.received_at)}
              </p>
            )}
          </div>
        )}

        {/* Refund Status */}
        {refundStatusConfig && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Refund</p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm font-semibold ${refundStatusConfig.className}`}>
                {refundStatusConfig.label}
              </span>
              {hierarchy.refund_amount_requested && (
                <span className="text-sm text-white">{formatCurrency(hierarchy.refund_amount_requested)}</span>
              )}
            </div>
            {hierarchy.refund_requested_at && (
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Requested {formatDate(hierarchy.refund_requested_at)}
              </p>
            )}
            {refundStatus === 'pending_payment_verification' && (
              <p className="mt-2 text-xs text-violet-300/80">
                Your payment proof is being reviewed by the admin. Once verified, your refund request will be submitted for approval.
              </p>
            )}
            {refundStatus === 'rejected' && (
              <p className="mt-2 text-xs text-red-300/80">
                Refund unavailable — your submitted payment proof was not verified by the admin.
              </p>
            )}
          </div>
        )}

        {/* Request Refund (customer-only, only when eligible) */}
        {refundEligibility?.eligible && !refundStatus && (
          <div className="mt-6 rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-5">
            <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Request Refund</p>
            <p className="mt-2 text-sm text-white">
              You are eligible for a refund of{' '}
              <span className="font-bold text-[var(--gold-primary)]">{formatCurrency(refundEligibility.refundable_amount)}</span>{' '}
              because this project has not started yet.
            </p>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="Reason for refund (required)..."
              rows={3}
              className="mt-3 w-full px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] text-sm text-white placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--gold-primary)] resize-none"
            />
            {refundMessage && (
              <p className={`mt-2 text-sm ${refundMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {refundMessage.text}
              </p>
            )}
            <button
              onClick={handleRequestRefund}
              disabled={refundSubmitting || !refundReason.trim()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-semibold text-black transition-all hover:shadow-[0_0_20px_rgba(212,175,55,0.35)] disabled:opacity-50"
            >
              {refundSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}
              {refundSubmitting ? 'Submitting...' : 'Request Refund'}
            </button>
          </div>
        )}

        {/* Installment Schedule */}
        {isFullPayment ? (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/5 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-white font-bold text-lg">Payment Complete</p>
                <p className="text-sm text-[var(--text-muted)]">You paid it in Full Payment.</p>
              </div>
            </div>
          </div>
        ) : installmentSummary ? (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
              <h3 className="text-white font-bold text-lg">Payment Installment Schedule</h3>
              {paymentStatus && (
                <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full border ${paymentStatus.bg} ${paymentStatus.border} ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              )}
            </div>

            {/* Action/Feedback message */}
            {installmentMessage && (
              <div className={`mb-4 rounded-xl p-4 text-sm flex items-start justify-between border ${
                installmentMessage.type === 'success'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}>
                <div>
                  <p className="font-semibold">{installmentMessage.title || (installmentMessage.type === 'success' ? 'Payment Submitted' : 'Error')}</p>
                  <p className="text-xs mt-0.5 opacity-90">{installmentMessage.text}</p>
                </div>
                <button onClick={() => setInstallmentMessage(null)} className="ml-3 flex-shrink-0 text-[var(--text-muted)] hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Remaining Balance</p>
                <p className="mt-1 text-lg font-bold text-[var(--gold-primary)]">
                  {formatCurrency(installmentSummary.remaining_balance)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Monthly Payment</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {formatCurrency(installmentSummary.monthly_payment)}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Paid Installments</p>
                <p className="mt-1 text-lg font-bold text-green-400">
                  {installmentSummary.paid_count || 0} / {installmentSummary.total_months} Paid
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Remaining Installments</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {installmentSummary.remaining_months} / {installmentSummary.total_months} Remaining
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Next Due Date</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {installmentSummary.next_due_date ? formatShortDate(installmentSummary.next_due_date) : '—'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Last Updated</p>
                <p className="mt-1 text-lg font-bold text-white">
                  {installmentSummary.last_updated ? formatDate(installmentSummary.last_updated) : '—'}
                </p>
              </div>
            </div>

            {/* Installment list / table */}
            {installmentData?.installments?.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Schedule Breakdown</p>
                <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-left text-sm text-white">
                    <thead className="bg-[var(--surface-dark)] text-xs uppercase text-[var(--text-muted)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-4 py-3">Installment</th>
                        <th className="px-4 py-3">Due Date</th>
                        <th className="px-4 py-3 text-right">Amount Due</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3">Payment Info</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] bg-[var(--bg-primary)]">
                      {installmentData.installments.map((inst) => {
                        const statusKey = inst.display_status || inst.status;
                        const isPaid = statusKey === 'paid';
                        const isPendingVerification = statusKey === 'for_verification';
                        const isRejected = statusKey === 'rejected';
                        const isOverdue = statusKey === 'overdue';
                        const isDue = statusKey === 'due';
                        const isUpcoming = statusKey === 'upcoming';
                        const isPayable = inst.is_payable || ['due', 'overdue', 'rejected', 'pending'].includes(statusKey);

                        const statusBadgeConfig = {
                          paid: { label: 'Paid ✓', bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-400' },
                          for_verification: { label: 'Payment Verification Pending', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
                          due: { label: 'Due', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400' },
                          overdue: { label: 'Overdue', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
                          upcoming: { label: 'Upcoming', bg: 'bg-slate-500/10', border: 'border-slate-500/30', text: 'text-slate-400' },
                          rejected: { label: 'Payment Rejected', bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400' },
                        }[statusKey] || { label: formatLabel(statusKey), bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400' };

                        return (
                          <React.Fragment key={inst.schedule_id}>
                            <tr className={`transition-colors hover:bg-white/[0.02] ${isOverdue ? 'bg-red-500/[0.03]' : ''}`}>
                              <td className="px-4 py-3.5 font-medium">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    isPaid ? 'bg-green-400' :
                                    isPendingVerification ? 'bg-amber-400' :
                                    isOverdue ? 'bg-red-400' :
                                    isDue ? 'bg-blue-400' :
                                    'bg-slate-500'
                                  }`} />
                                  <span>Installment #{inst.installment_number}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                                {formatShortDate(inst.due_date)}
                              </td>
                              <td className="px-4 py-3.5 text-right font-semibold text-[var(--gold-primary)]">
                                {formatCurrency(inst.amount)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusBadgeConfig.bg} ${statusBadgeConfig.border} ${statusBadgeConfig.text}`}>
                                  {statusBadgeConfig.label}
                                </span>
                              </td>
                              <td className="px-4 py-3.5 text-xs text-[var(--text-muted)]">
                                {isPaid ? (
                                  <div>
                                    <p className="text-white font-medium">Paid on {formatShortDate(inst.payment_date || inst.paid_at)}</p>
                                    {inst.payment_reference && <p className="text-[10px] text-[var(--text-muted)]">Ref: {inst.payment_reference}</p>}
                                  </div>
                                ) : isPendingVerification ? (
                                  <div>
                                    <p className="text-amber-300 font-medium">Submitted {formatShortDate(inst.submitted_at)}</p>
                                    {inst.payment_reference && <p className="text-[10px] text-[var(--text-muted)]">Ref: {inst.payment_reference}</p>}
                                  </div>
                                ) : (
                                  <span className="text-[var(--text-muted)]">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-right">
                                {isPayable ? (
                                  <button
                                    type="button"
                                    onClick={() => setPayingInstallment(inst)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black text-xs font-bold transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                                  >
                                    <CreditCard className="w-3.5 h-3.5" />
                                    Pay Now
                                  </button>
                                ) : isPendingVerification ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewingInstallment(inst)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                    View Proof
                                  </button>
                                ) : isPaid ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-400 font-medium">
                                    <CheckCircle className="w-3.5 h-3.5" />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="text-xs text-[var(--text-muted)]">—</span>
                                )}
                              </td>
                            </tr>
                            {/* If rejected, show explanation banner below the row */}
                            {isRejected && (
                              <tr className="bg-red-500/10 border-b border-red-500/20">
                                <td colSpan={6} className="px-4 py-2.5 text-xs text-red-300">
                                  <div className="flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                    <span>
                                      <strong>Payment Rejected:</strong> Your previous payment for Installment #{inst.installment_number} could not be verified.
                                      {inst.rejection_reason ? ` Reason: "${inst.rejection_reason}".` : ''} Please review your payment information and submit a new payment using <strong>Pay Now</strong>.
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Info Row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {estimatedCompletion && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Estimated Completion</p>
              <p className="mt-1 text-sm font-medium text-white">{estimatedCompletion}</p>
            </div>
          )}
          {lastUpdated && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Last Updated</p>
              <p className="mt-1 text-sm font-medium text-white">{lastUpdated}</p>
            </div>
          )}
        </div>

        {/* Pay Installment Modal */}
        {payingInstallment && (
          <PayInstallmentModal
            isOpen={Boolean(payingInstallment)}
            installment={payingInstallment}
            projectId={projectId}
            onClose={() => setPayingInstallment(null)}
            onSuccess={(data) => {
              setPayingInstallment(null);
              setConfirmedPayment({
                installmentNumber: payingInstallment.installment_number,
                amount: payingInstallment.amount,
                method: data?.payment?.method || 'gcash',
                referenceNumber: data?.payment?.reference_number,
                submittedAt: new Date().toISOString(),
              });
              setInstallmentMessage({
                type: 'success',
                title: 'Payment Submitted',
                text: `Your payment for Installment #${payingInstallment.installment_number} has been submitted and is waiting for verification.`,
              });
              loadInstallments();
              loadData();
            }}
          />
        )}

        {/* View Submitted Payment Proof Modal */}
        {viewingInstallment && (
          <ViewSubmittedPaymentModal
            isOpen={Boolean(viewingInstallment)}
            installment={viewingInstallment}
            onClose={() => setViewingInstallment(null)}
          />
        )}

        {/* Payment Submitted Confirmation Modal */}
        {confirmedPayment && (
          <PaymentSubmittedModal
            isOpen={Boolean(confirmedPayment)}
            data={confirmedPayment}
            onClose={() => setConfirmedPayment(null)}
          />
        )}
      </div>
    </div>
  );
}