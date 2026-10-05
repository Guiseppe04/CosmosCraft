import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle, Clock, AlertCircle, Guitar, DollarSign, Calendar,
  CreditCard, RefreshCw, HelpCircle, Info, Layers, Hammer,
  CheckSquare, FileText, ChevronDown, ChevronUp, Package, Truck, ShieldCheck,
  X, Upload, QrCode, Eye, Loader2, Check, MapPin, Edit2, Printer, CircleDot, MessageSquare
} from 'lucide-react';
import { adminApi } from '../../utils/adminApi';
import { resolveImageUrl, API, getAuthHeaders } from '../../utils/apiConfig';
import { ConfirmModal } from '../ui/ConfirmModal';
import { useSocketEvent } from '../../context/SocketContext';
import { useBranchSettings } from '../../hooks/useBranchSettings';

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

const formatAddress = (addr) => {
  if (!addr) return '';
  const parts = [
    addr.street_line1,
    addr.street_line2,
    addr.barangay ? `Brgy. ${addr.barangay}` : null,
    addr.city,
    addr.province,
  ];
  return parts.filter(Boolean).join(', ');
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
  const isFulfillmentCompleted = project.fulfillment_status === 'completed' || project.customization_status === 'fulfilled';

  if (isFulfillmentCompleted && (resolution === 'current_build_released' || resolution === 'parts_released' || resolution === 'parts_returned' || resolution === 'partial_refund_and_build' || resolution === 'partial_refund_and_parts')) {
    return {
      title: 'Project Cancelled — Build/Parts Handover Completed',
      subtitle: 'Your build/parts have been released and handover is complete. Fulfillment has finished.',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    };
  }
  if (isFulfillmentCompleted && (resolution === 'full_refund' || refundStatus === 'refunded')) {
    return {
      title: `Project Cancelled — Refund & Fulfillment Completed (${formatCurrency(refundAmount)})`,
      subtitle: 'Your refund has been disbursed and project fulfillment is complete. Thank you for choosing CosmosCraft.',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    };
  }
  if (isFulfillmentCompleted) {
    return {
      title: 'Project Cancelled — Fulfillment Completed',
      subtitle: 'All cancellation and fulfillment resolutions have been finalized.',
      badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    };
  }

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
              {paymentSettings?.bank_transfer_display_mode === 'qr' && paymentSettings?.bank_transfer_qr_image_url && (
                <div className="mx-auto h-36 w-36 rounded-xl border border-[var(--border)] bg-white p-2">
                  <img
                    src={paymentSettings.bank_transfer_qr_image_url}
                    alt="Bank transfer QR code"
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              {(paymentSettings?.bank_transfer_display_mode !== 'qr' || !paymentSettings?.bank_transfer_qr_image_url) && (
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
              )}
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

export default function CustomerProjectTracker({ projectId, projectName, projectData, customBuildId, onInstallmentScheduleChange, onLeaveCustomizationFeedback }) {
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
  const [showRefundRequestForm, setShowRefundRequestForm] = useState(false);
  const [showInstallmentSchedule, setShowInstallmentSchedule] = useState(false);
  const progressSummaryRef = useRef(null);
  const refundRequestRef = useRef(null);
  const installmentScheduleRef = useRef(null);
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
  // Fulfillment state
  const [fulfillmentData, setFulfillmentData] = useState(null);
  const { branch: pickupBranch } = useBranchSettings();
  const [pickupStorageFee, setPickupStorageFee] = useState(0);
  const [fulfillmentLoading, setFulfillmentLoading] = useState(false);
  const [isEditingMethod, setIsEditingMethod] = useState(false);
  const [userAddresses, setUserAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [fulfillmentMethod, setFulfillmentMethod] = useState('pickup');
  const [fulfillmentNotes, setFulfillmentNotes] = useState('');
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false);
  const [fulfillmentMessage, setFulfillmentMessage] = useState(null);
  const [showDeliveryConfirmModal, setShowDeliveryConfirmModal] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [deliveryConfirmError, setDeliveryConfirmError] = useState(null);

  const handleConfirmDelivery = async () => {
    if (!projectId) return;
    try {
      setConfirmingDelivery(true);
      setDeliveryConfirmError(null);
      await adminApi.confirmProjectDelivery(projectId);
      setShowDeliveryConfirmModal(false);
      await Promise.all([
        loadData(),
        loadFulfillment(),
      ]);
    } catch (err) {
      console.error('Failed to confirm delivery:', err);
      setDeliveryConfirmError(err.message || 'Failed to confirm delivery');
    } finally {
      setConfirmingDelivery(false);
    }
  };

  const handleSelectAddress = useCallback((addressId) => {
    setSelectedAddressId(addressId);
  }, []);

  useEffect(() => {
    setShowInstallmentSchedule(false);
    if (projectId) {
      loadData();
      loadInstallments();
      loadRefundEligibility();
      loadBuildClaim();
      loadSettlement();
      loadFulfillment();
      loadPickupStorageFee();
      loadAddresses();
    }
  }, [projectId]);

  useEffect(() => {
    if (!onInstallmentScheduleChange) return undefined;
    onInstallmentScheduleChange(showInstallmentSchedule);
    return () => onInstallmentScheduleChange(false);
  }, [showInstallmentSchedule, onInstallmentScheduleChange]);

  useSocketEvent('project:updated', (data) => {
    if (!data?.projectId || data.projectId === projectId) {
      loadData();
      loadInstallments();
      loadBuildClaim();
      loadSettlement();
      loadFulfillment();
    }
  });

  useSocketEvent('fulfillment:updated', (data) => {
    if (String(data?.projectId) === String(projectId)) {
      loadData();
      loadFulfillment();
    }
  });

  useSocketEvent('project:milestone_updated', () => {
    loadData();
  });

  useSocketEvent('project:subtask_updated', () => {
    loadData();
  });

  const loadFulfillment = async () => {
    if (!projectId) return;
    try {
      setFulfillmentLoading(true);
      const res = await adminApi.getProjectFulfillment(projectId);
      if (res?.data) {
        setFulfillmentData(res.data);
        if (res.data.fulfillment_method) {
          const norm = res.data.fulfillment_method.includes('delivery') ? 'delivery' : 'pickup';
          setFulfillmentMethod(norm);
        }
        if (res.data.delivery_address_id) {
          setSelectedAddressId(res.data.delivery_address_id);
        }
        if (res.data.notes) {
          setFulfillmentNotes(res.data.notes);
        }
      }
    } catch (err) {
      console.warn('Failed to load fulfillment data:', err);
    } finally {
      setFulfillmentLoading(false);
    }
  };

  const loadPickupStorageFee = async () => {
    try {
      const res = await adminApi.getPaymentSettings();
      setPickupStorageFee(Math.max(0, Number(res?.data?.pickup_storage_fee) || 0));
    } catch (err) {
      console.warn('Failed to load pickup storage fee:', err);
      setPickupStorageFee(0);
    }
  };

  const loadAddresses = async () => {
    try {
      const res = await fetch(`${API}/api/users/me`, { headers: getAuthHeaders(), credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        const addrs = json?.data?.user?.addresses || [];
        setUserAddresses(addrs);
        if (addrs.length > 0) {
          const def = addrs.find((a) => a.is_default) || addrs[0];
          setSelectedAddressId((prev) => prev || def.address_id);
        }
      }
    } catch (err) {
      console.warn('Failed to load user addresses:', err);
    }
  };


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
      setShowRefundRequestForm(false);
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

  const handleFulfillmentChoice = async () => {
    if (!projectId) return;
    if (fulfillmentSaving) return; // Prevent double-clicks
    
    if (fulfillmentMethod === 'delivery') {
      const activeAddress = userAddresses.find((a) => a.address_id === selectedAddressId) || userAddresses[0];
      if (!activeAddress && !hierarchy?.fulfillment_address_id && !fulfillmentData?.delivery_address_id) {
        setFulfillmentMessage({ type: 'error', text: 'Please add or select a delivery address before requesting Shop Delivery.' });
        return;
      }
    }

    try {
      setFulfillmentSaving(true);
      setFulfillmentMessage(null);
      await adminApi.submitProjectFulfillment(projectId, {
        method: fulfillmentMethod,
        delivery_address_id: selectedAddressId || undefined,
      });
      setFulfillmentMessage({
        type: 'success',
        text: isEditingMethod
          ? 'Fulfillment preference updated successfully.'
          : 'Fulfillment request submitted. Your request has been sent to the shop.',
      });
      setIsEditingMethod(false);
      await Promise.all([loadData(), loadFulfillment()]);
    } catch (err) {
      setFulfillmentMessage({ type: 'error', text: err.message || 'Unable to save fulfillment choice.' });
    } finally {
      setFulfillmentSaving(false);
    }
  };


  const taskSummary = hierarchy?.task_summary || { total: 0, completed: 0, pending: 0 };
  const clampedProgress = Math.min(Math.max(Number(hierarchy?.progress) || 0, 0), 100);
  const isProgressComplete = clampedProgress >= 100 || String(hierarchy?.status || '').toLowerCase() === 'completed';
  const milestones = Array.isArray(hierarchy?.milestones) ? hierarchy.milestones : [];
  const taskCompletionRate = taskSummary.total > 0
    ? Math.round((taskSummary.completed / taskSummary.total) * 100)
    : 0;
  const completedMilestones = milestones.filter((milestone) => {
    const subtasks = Array.isArray(milestone?.subtasks) ? milestone.subtasks : [];
    return subtasks.length > 0
      ? subtasks.every((subtask) => subtask.status === 'completed')
      : milestone.status === 'completed';
  }).length;
  const totalMilestones = milestones.length;
  const milestoneCompletionRate = totalMilestones > 0
    ? Math.round((completedMilestones / totalMilestones) * 100)
    : 0;

  const estimatedCompletion = formatShortDate(
    hierarchy?.estimated_completion_date ||
    projectData?.estimated_completion_date
  );

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

  const printInstallmentReceipt = (installment) => {
    if ((installment.display_status || installment.status) !== 'paid') return;

    const printWindow = window.open('', '_blank', 'width=720,height=800');
    if (!printWindow) {
      setInstallmentMessage({
        type: 'error',
        title: 'Unable to Print',
        text: 'Allow pop-ups for this site to print your payment receipt.',
      });
      return;
    }

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
    const receiptDate = formatShortDate(installment.payment_date || installment.paid_at || installment.payment_verified_at) || '—';
    const dueDate = formatShortDate(installment.due_date) || '—';
    const paymentReference = installment.payment_reference || installment.schedule_id || '—';
    const buildName = projectName || hierarchy?.name || hierarchy?.title || 'Custom Build';
    const buildNumber = hierarchy?.order_number || projectData?.order_number || customBuildId || '—';
    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>Installment Payment Receipt</title>
      <style>
        body{font-family:Arial,sans-serif;color:#171717;margin:40px auto;max-width:680px;padding:0 24px}
        header{border-bottom:2px solid #d4af37;padding-bottom:18px;margin-bottom:24px}
        h1{font-size:24px;margin:0 0 6px}p{margin:6px 0;color:#525252}
        dl{margin:24px 0}dl div{display:flex;justify-content:space-between;gap:24px;padding:12px 0;border-bottom:1px solid #ddd}
        dt{color:#525252}dd{margin:0;text-align:right;font-weight:600}
        .amount{font-size:20px;color:#111}.note{margin-top:30px;font-size:12px;color:#737373}
        @media print{body{margin:0 auto;padding:0 12px}}
      </style></head><body>
        <header><h1>Payment Receipt</h1><p>CosmosCraft · Guitar Build Installment</p></header>
        <p><strong>Build:</strong> ${escapeHtml(buildName)} (${escapeHtml(buildNumber)})</p>
        <dl>
          <div><dt>Build number</dt><dd>${escapeHtml(buildNumber)}</dd></div>
          <div><dt>Installment</dt><dd>#${escapeHtml(installment.installment_number)}</dd></div>
          <div><dt>Due date</dt><dd>${escapeHtml(dueDate)}</dd></div>
          <div><dt>Paid date</dt><dd>${escapeHtml(receiptDate)}</dd></div>
          <div><dt>Payment method</dt><dd>${escapeHtml(formatLabel(installment.payment_method) || '—')}</dd></div>
          <div><dt>Reference</dt><dd>${escapeHtml(paymentReference)}</dd></div>
          <div><dt>Amount paid</dt><dd class="amount">${escapeHtml(formatCurrency(installment.amount))}</dd></div>
          <div><dt>Status</dt><dd>Paid</dd></div>
        </dl>
        <p class="note">This receipt confirms the installment payment shown above.</p>
      </body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
    window.setTimeout(() => printWindow.print(), 250);
  };

  const printPickupClaimReceipt = () => {
    if (!fulfillmentData || !String(fulfillmentData.fulfillment_method || '').includes('pickup')) return;

    const printWindow = window.open('', '_blank', 'width=720,height=800');
    if (!printWindow) {
      setFulfillmentMessage({ type: 'error', text: 'Allow pop-ups for this site to print your pickup claim receipt.' });
      return;
    }

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
    const customerName = [fulfillmentData.first_name, fulfillmentData.last_name].filter(Boolean).join(' ') || 'Customer';
    const projectTitle = fulfillmentData.project_title || projectName || hierarchy?.name || hierarchy?.title || 'Custom Guitar Build';
    const generatedDate = formatDate(new Date()) || '';
    const storageFeeNotice = pickupStorageFee > 0
      ? `If you do not collect the guitar by the scheduled pickup time, a storage fee of ${formatCurrency(pickupStorageFee)} per day will be charged.`
      : 'No missed-pickup storage fee is currently configured.';
    const html = `<!doctype html>
      <html><head><meta charset="utf-8"><title>Guitar Pickup Claim Receipt</title>
      <style>
        body{font-family:Arial,sans-serif;color:#171717;margin:40px auto;max-width:680px;padding:0 24px}
        header{border-bottom:2px solid #d4af37;padding-bottom:18px;margin-bottom:24px}
        h1{font-size:24px;margin:0 0 6px}p{margin:6px 0;color:#525252}
        dl{margin:24px 0}dl div{display:flex;justify-content:space-between;gap:24px;padding:12px 0;border-bottom:1px solid #ddd}
        dt{color:#525252}dd{margin:0;text-align:right;font-weight:600;overflow-wrap:anywhere}
        .notice{border:1px solid #d4af37;padding:14px;margin:24px 0;font-weight:600}
        .signatures{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:56px}
        .signature{border-top:1px solid #777;padding-top:8px;font-size:12px;color:#525252}
        .note{margin-top:28px;font-size:11px;color:#737373}
        @media print{body{margin:0 auto;padding:0 12px}}
      </style></head><body>
        <header><h1>Guitar Pickup Claim Receipt</h1><p>${escapeHtml(pickupBranch.name)}</p></header>
        <dl>
          <div><dt>Receipt reference</dt><dd>${escapeHtml(fulfillmentData.id || projectId)}</dd></div>
          <div><dt>Order number</dt><dd>${escapeHtml(fulfillmentData.order_number || '—')}</dd></div>
          <div><dt>Project</dt><dd>${escapeHtml(projectTitle)}</dd></div>
          <div><dt>Claimant</dt><dd>${escapeHtml(customerName)}</dd></div>
          <div><dt>Email</dt><dd>${escapeHtml(fulfillmentData.email || '—')}</dd></div>
          <div><dt>Phone</dt><dd>${escapeHtml(fulfillmentData.phone || '—')}</dd></div>
          <div><dt>Pickup location</dt><dd>${escapeHtml(pickupBranch.address)}</dd></div>
        </dl>
        <div class="notice">Bring this receipt and a valid government-issued photo ID. The name on your ID must match the claimant name printed above. Staff will verify the ID before releasing the guitar. ${escapeHtml(storageFeeNotice)}</div>
        <div class="signatures">
          <div class="signature">Customer signature and date</div>
          <div class="signature">Staff name, signature, and date</div>
        </div>
        <p class="note">Generated ${escapeHtml(generatedDate)}. This receipt is for in-store pickup of the custom build listed above.</p>
      </body></html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
    window.setTimeout(() => printWindow.print(), 250);
  };

  // Refund status from the project payload
  const refundStatus = hierarchy?.refund_status || settlementData?.refund_status || null;

  // Last completed stage
  const lastCompletedStage = hierarchy?.cancelled_stage_snapshot || hierarchy?.last_completed_stage || null;
  const lastCompletedStageAt = hierarchy?.cancelled_stage_snapshot_at || hierarchy?.last_completed_stage_at || null;

  const isCancelled = String(hierarchy?.status || '').toLowerCase() === 'cancelled';
  const customizationStatus = hierarchy?.customization_status || null;
  const isOrderOnHold = customizationStatus === 'on_hold';
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
              {(() => {
                const isCompleted =
                  hierarchy.fulfillment_status === 'completed' ||
                  hierarchy.customization_status === 'fulfilled' ||
                  ['received', 'picked_up', 'delivered'].includes(buildClaim?.claim_status) ||
                  refundStatus === 'refunded' ||
                  hierarchy.cancel_resolution === 'no_refund';

                return (
                  <div className={`p-3 rounded-xl border ${isCompleted ? 'bg-black/30 border-white/20 text-white' : 'bg-black/10 border-white/5 text-white/40'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className={`w-4 h-4 ${isCompleted ? 'text-emerald-400' : 'text-white/30'}`} />
                      <span className="text-xs font-bold">4. Final Handover</span>
                    </div>
                    <p className="text-[11px] text-white/70 capitalize">
                      {isCompleted
                        ? (buildClaim?.claim_status === 'received'
                            ? 'Received by Customer'
                            : buildClaim?.claim_status === 'picked_up'
                            ? 'Picked Up'
                            : buildClaim?.claim_status === 'delivered'
                            ? 'Delivered'
                            : refundStatus === 'refunded'
                            ? 'Refund Disbursed'
                            : 'Fulfillment Completed')
                        : (buildClaim?.claim_status ? formatStatus(buildClaim.claim_status) : 'Pending Action')}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── CUSTOM BUILD FULFILLMENT LIFECYCLE ── */}
      {(() => {
        const isBuildComplete =
          (clampedProgress >= 100 ||
            hierarchy?.status === 'completed' ||
            ['fulfillment_pending', 'fulfillment_in_progress', 'fulfilled'].includes(customizationStatus)) &&
          !isCancelled;

        if (!isBuildComplete) return null;

        const fStatus = fulfillmentData?.status || (customizationStatus === 'fulfillment_pending' ? 'not_requested' : (hierarchy?.fulfillment_status || 'not_requested'));
        const hasRequested = fStatus !== 'not_requested' && !!fulfillmentData?.id;
        const isFulfillmentActive = ['processing', 'ready_for_pickup', 'out_for_delivery', 'completed'].includes(fStatus);
        const activeMethod = (fulfillmentData?.fulfillment_method?.includes('delivery') ? 'delivery' : (fulfillmentData?.fulfillment_method?.includes('pickup') ? 'pickup' : fulfillmentMethod)) || 'pickup';

        const deliverySteps = [
          { key: 'build_completed', label: 'Build Completed', done: true, active: false },
          { key: 'requested', label: 'Fulfillment Requested', done: true, active: false },
          { key: 'processing', label: 'Processing', done: ['out_for_delivery', 'completed'].includes(fStatus), active: fStatus === 'processing' },
          { key: 'out_for_delivery', label: 'Out for Delivery', done: fStatus === 'completed', active: fStatus === 'out_for_delivery' },
          { key: 'completed', label: 'Delivered', done: fStatus === 'completed', active: false },
        ];

        const pickupSteps = [
          { key: 'build_completed', label: 'Build Completed', done: true, active: false },
          { key: 'requested', label: 'Pickup Requested', done: true, active: false },
          { key: 'processing', label: 'Processing', done: ['ready_for_pickup', 'completed'].includes(fStatus), active: fStatus === 'processing' },
          { key: 'ready_for_pickup', label: 'Ready for Pickup', done: fStatus === 'completed', active: fStatus === 'ready_for_pickup' },
          { key: 'completed', label: 'Picked Up', done: fStatus === 'completed', active: false },
        ];

        const activeSteps = activeMethod === 'delivery' ? deliverySteps : pickupSteps;
        const selectedAddress = userAddresses.find((a) => a.address_id === selectedAddressId) || userAddresses[0] || fulfillmentData?.delivery_address_snapshot || null;
        const scheduledPickup = fulfillmentData?.pickup_scheduled_at
          ? formatDate(fulfillmentData.pickup_scheduled_at)
          : null;

        return (
          <div className="rounded-3xl border border-[var(--gold-primary)]/40 bg-[var(--surface-dark)] p-6 shadow-2xl space-y-6">
            {/* Header / Title Card */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--border)] pb-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex-shrink-0">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">Your custom build is complete</h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Choose how you would like to receive it. You can update your choice until the shop starts fulfillment.
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                  fStatus === 'completed'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : isFulfillmentActive
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                    : hasRequested
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] border-[var(--gold-primary)]/40'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    fStatus === 'completed' ? 'bg-emerald-400' : isFulfillmentActive ? 'bg-sky-400 animate-pulse' : hasRequested ? 'bg-amber-400' : 'bg-[var(--gold-primary)]'
                  }`} />
                  {fStatus === 'not_requested'
                    ? 'Awaiting Selection'
                    : fStatus === 'requested'
                    ? (activeMethod === 'delivery' ? 'Shop Delivery Requested' : 'Pickup at Shop Requested')
                    : formatLabel(fStatus)}
                </span>
              </div>
            </div>

            {/* LOCKED NOTICE when fulfillment has started */}
            {isFulfillmentActive && activeMethod === 'delivery' && fStatus !== 'completed' && (
              <div className="rounded-2xl border border-sky-500/40 bg-sky-500/10 p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-sky-400 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-sky-200">
                    Fulfillment has started. Your delivery method can no longer be changed.
                  </p>
                  <p className="text-xs text-sky-300/80 mt-0.5">
                    {fStatus === 'processing' && 'Your custom build is being prepared for fulfillment.'}
                    {fStatus === 'ready_for_pickup' && 'Your custom guitar is ready for pickup at the workshop.'}
                    {fStatus === 'out_for_delivery' && 'Your custom guitar is out for delivery with our courier.'}
                    {fStatus === 'completed' && 'Your custom build has been successfully fulfilled.'}
                  </p>
                </div>
              </div>
            )}

            {/* OUT FOR DELIVERY: CUSTOMER DELIVERY CONFIRMATION ACTION */}
            {fStatus === 'out_for_delivery' && activeMethod === 'delivery' && (
              <div className="rounded-2xl border border-[var(--gold-primary)]/50 bg-[var(--gold-primary)]/10 p-5 space-y-4 shadow-lg shadow-[var(--gold-primary)]/5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] flex-shrink-0">
                      <Truck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight">Your custom guitar is out for delivery</h4>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        Once you receive your guitar, please confirm the delivery below.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryConfirmError(null);
                      setShowDeliveryConfirmModal(true);
                    }}
                    disabled={confirmingDelivery}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-5 py-2.5 text-xs font-bold text-black shadow-lg shadow-[var(--gold-primary)]/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {confirmingDelivery ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    {confirmingDelivery ? 'Confirming...' : 'Confirm Delivery'}
                  </button>
                </div>

                {deliveryConfirmError && (
                  <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{deliveryConfirmError}</span>
                  </div>
                )}
              </div>
            )}

            {/* DELIVERED STATUS BANNER */}
            {fStatus === 'completed' && activeMethod === 'delivery' && (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-200">
                      Delivered
                    </p>
                    <p className="text-xs text-emerald-300/80">
                      {(fulfillmentData?.delivery_confirmation_method === 'customer' || hierarchy?.delivery_confirmation_method === 'customer')
                        ? 'Delivery confirmed by customer.'
                        : 'Delivery confirmed by the shop.'}
                      {(fulfillmentData?.delivered_at || hierarchy?.delivered_at) && ` (${formatDate(fulfillmentData?.delivered_at || hierarchy?.delivered_at)})`}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* LIFECYCLE PROGRESS STEPPER */}
            {hasRequested && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)]">
                    Fulfillment Progress
                  </span>
                  <span className="text-xs font-semibold text-[var(--gold-primary)]">
                    Method: {activeMethod === 'delivery' ? 'Shop Delivery' : 'Pickup at Shop'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                  {activeSteps.map((step, idx) => (
                    <div
                      key={step.key}
                      className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                        step.done
                          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                          : step.active
                          ? 'bg-sky-950/40 border-sky-500/40 text-sky-200 ring-1 ring-sky-400/40'
                          : 'bg-white/[0.02] border-white/5 text-white/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono opacity-60">0{idx + 1}</span>
                        {step.done ? (
                          <CheckCircle className="h-4 w-4 text-emerald-400" />
                        ) : step.active ? (
                          <span className="h-3 w-3 rounded-full bg-sky-400 animate-ping" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-white/20" />
                        )}
                      </div>
                      <p className="text-xs font-bold leading-tight">{step.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {fStatus === 'completed' && activeMethod === 'pickup' && onLeaveCustomizationFeedback && (
              <button
                type="button"
                onClick={() => onLeaveCustomizationFeedback(fulfillmentData)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--gold-primary)]/10 transition-colors cursor-pointer"
              >
                <MessageSquare className="h-3 w-3" />
                Leave Customization Feedback
              </button>
            )}

            {/* STATE A: REQUEST SUBMITTED & NOT LOCKED (Customer can view preference or toggle change) */}
            {hasRequested && !isFulfillmentActive && !isEditingMethod && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-bold block mb-1">
                      Fulfillment Method
                    </span>
                    <p className="text-base font-bold text-white flex items-center gap-2">
                      {activeMethod === 'delivery' ? (
                        <>
                          <Truck className="h-5 w-5 text-[var(--gold-primary)]" />
                          Shop Delivery
                        </>
                      ) : (
                        <>
                          <MapPin className="h-5 w-5 text-[var(--gold-primary)]" />
                          Pickup at Shop
                        </>
                      )}
                    </p>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMethod(true);
                        setFulfillmentMessage(null);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--gold-primary)] text-sm font-bold text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/10 transition-all cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                      Change Fulfillment Method
                    </button>
                  </div>
                </div>

                {/* Details summary */}
                {activeMethod === 'delivery' && (
                  <div className="pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1">
                    <p className="font-semibold text-white">Delivery Address:</p>
                    {selectedAddress ? (
                      <p>
                        {selectedAddress.street_line1}
                        {selectedAddress.street_line2 ? `, ${selectedAddress.street_line2}` : ''}
                        {selectedAddress.barangay ? `, Brgy. ${selectedAddress.barangay}` : ''}
                        {selectedAddress.city ? `, ${selectedAddress.city}` : ''}
                        {selectedAddress.province ? `, ${selectedAddress.province}` : ''}
                      </p>
                    ) : (
                      <p className="text-amber-400">Checkout saved delivery address will be used.</p>
                    )}
                  </div>
                )}

                {activeMethod === 'pickup' && (
                  <div className="pt-3 border-t border-[var(--border)] text-xs text-[var(--text-muted)] space-y-1">
                    <p className="font-semibold text-white">Pickup Location:</p>
                    <p>{pickupBranch.name}, {pickupBranch.address}</p>
                    {scheduledPickup && (
                      <p className="text-[var(--gold-primary)] font-semibold mt-1">
                        Scheduled: {scheduledPickup}
                      </p>
                    )}
                    {hasRequested && (
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={printPickupClaimReceipt}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 text-xs font-extrabold text-black shadow-md shadow-[var(--gold-primary)]/25 transition-all hover:-translate-y-0.5 hover:bg-[var(--gold-secondary)] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white cursor-pointer"
                        >
                          <Printer className="h-4 w-4" />
                          Print Claim Receipt
                        </button>
                        <p className="mt-2 text-[11px]">Bring a valid photo ID. Its name must match the claimant name on your receipt.</p>
                        <p className="mt-1 text-[11px]">
                          {pickupStorageFee > 0
                            ? `If you miss the scheduled pickup time, a storage fee of ${formatCurrency(pickupStorageFee)} per day will be charged.`
                            : 'No missed-pickup storage fee is currently configured.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {fulfillmentNotes && (
                  <div className="pt-2 text-xs text-[var(--text-muted)]">
                    <span className="font-semibold text-white">Notes: </span>
                    {fulfillmentNotes}
                  </div>
                )}
              </div>
            )}

            {/* STATE B: SELECTION FORM (shown when not yet requested OR when customer clicked [Change Fulfillment Method]) */}
            {(!hasRequested || isEditingMethod) && !isFulfillmentActive && (
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)]">
                  {isEditingMethod ? 'Update Your Fulfillment Method' : 'Select Fulfillment Method'}
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('pickup')}
                    className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                      fulfillmentMethod === 'pickup'
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 ring-1 ring-[var(--gold-primary)]/50'
                        : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className="h-5 w-5 text-[var(--gold-primary)]" />
                      <p className="font-bold text-white">Pickup at Shop</p>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      Collect your custom guitar directly from our workshop.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFulfillmentMethod('delivery')}
                    className={`rounded-2xl border p-4 text-left transition-all cursor-pointer ${
                      fulfillmentMethod === 'delivery'
                        ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 ring-1 ring-[var(--gold-primary)]/50'
                        : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Truck className="h-5 w-5 text-[var(--gold-primary)]" />
                      <p className="font-bold text-white">Shop Delivery</p>
                    </div>
                    <p className="mt-2 text-xs text-[var(--text-muted)] leading-relaxed">
                      We will safely ship your custom guitar to your saved delivery address.
                    </p>
                  </button>
                </div>

                {/* Delivery Address Selector */}
                {fulfillmentMethod === 'delivery' && (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-wider font-bold text-[var(--text-muted)]">
                        Delivery Address
                      </span>
                     
                    </div>

                    {userAddresses.length > 0 ? (
                      <div className="space-y-2">
                        {userAddresses.map((addr) => {
                          const isSelected = selectedAddressId === addr.address_id;
                          return (
                            <label
                              key={addr.address_id}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                isSelected
                                  ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 text-white'
                                  : 'border-[var(--border)] text-white/80 hover:bg-white/5'
                              }`}
                            >
                              <input
                                type="radio"
                                name="fulfillment_address"
                                checked={isSelected}
                                onChange={() => handleSelectAddress(addr.address_id)}
                                className="mt-1 accent-[var(--gold-primary)]"
                              />
                              <div className="text-xs min-w-0 flex-1">
                                <span className="font-bold text-white block">
                                  {addr.label || 'Home'} {addr.is_default && '(Default)'}
                                </span>
                                <p className="text-[var(--text-muted)] mt-0.5">
                                  {formatAddress(addr)}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-300">
                        <AlertCircle className="h-4 w-4 inline mr-1.5 text-amber-400" />
                        Please add or select a delivery address before requesting Shop Delivery.
                      </div>
                    )}
                  </div>
                )}

                {fulfillmentMessage && (
                  <p className={`text-sm font-semibold ${fulfillmentMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>
                    {fulfillmentMessage.text}
                  </p>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleFulfillmentChoice}
                    disabled={fulfillmentSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-5 py-3 text-sm font-bold text-black shadow-lg shadow-[var(--gold-primary)]/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {fulfillmentSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4" />
                    )}
                    {fulfillmentSaving
                      ? 'Submitting...'
                      : isEditingMethod
                      ? 'Update Fulfillment Preference'
                      : 'Submit Fulfillment Request'}
                  </button>

                  {isEditingMethod && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingMethod(false);
                        setFulfillmentMessage(null);
                      }}
                      className="px-4 py-3 rounded-xl border border-[var(--border)] text-sm font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {/* Progress Header */}
      {!showInstallmentSchedule && !isProgressComplete && (
      <div ref={progressSummaryRef} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6">
        <div className="mb-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)] lg:items-start">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-white sm:text-2xl">{projectName || hierarchy.name || hierarchy.title || 'Custom Build'}</h2>
            {(hierarchy.order_number || projectData?.order_number || customBuildId) && (
              <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
                Order: {hierarchy.order_number || projectData?.order_number || customBuildId}
              </p>
            )}
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              For: {hierarchy.customer_name || projectData?.customer_name || '—'}
            </p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Estimated completion: <span className="font-medium text-white">{estimatedCompletion || 'Not set'}</span>
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-left lg:text-right">
            <span className="text-3xl font-black leading-none text-[var(--gold-primary)] sm:text-4xl">{clampedProgress}%</span>
            <p className="mt-1 font-semibold text-white">{formatStatus(hierarchy.status)}</p>
          </div>
        </div>

        {isOrderOnHold && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-amber-300">Manufacturing is on hold</p>
            {hierarchy.customization_hold_reason && (
              <p className="mt-1 text-xs text-amber-200/80">Reason: {hierarchy.customization_hold_reason}</p>
            )}
            {hierarchy.hold_at_step && (
              <p className="mt-1 text-xs text-amber-200/70">Paused at: {formatLabel(hierarchy.hold_at_step)}</p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)]/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">Total progress</p>
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">Live tracking</span>
          </div>

          <div className="relative mt-7 pb-7">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${clampedProgress}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)]"
              />
            </div>
            <div className="pointer-events-none absolute left-0 top-0 h-2 w-full">
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-400/60 bg-emerald-400/20 p-1"
                style={{ left: `${Math.min(98, Math.max(2, taskCompletionRate))}%`, top: '50%' }}
                title={`Tasks completed: ${taskCompletionRate}%`}
              >
                <CheckCircle className="h-3 w-3 text-emerald-300" />
              </span>
              <span
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-blue-400/60 bg-blue-400/20 p-1"
                style={{ left: `${Math.min(98, Math.max(2, milestoneCompletionRate))}%`, top: '50%' }}
                title={`Milestones completed: ${milestoneCompletionRate}%`}
              >
                <CircleDot className="h-3 w-3 text-blue-300" />
              </span>
            </div>
            {[0, 25, 50, 100].map((value) => (
              <span
                key={value}
                className={`absolute -bottom-0.5 text-[11px] font-medium text-[var(--text-muted)] ${value === 0 ? 'left-0' : value === 100 ? 'right-0' : '-translate-x-1/2'}`}
                style={value === 0 || value === 100 ? undefined : { left: `${value}%` }}
              >
                {value}%
              </span>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Task progress</p>
              <p className="mt-2 text-2xl font-bold text-white">{taskSummary.completed}<span className="text-base text-[var(--text-muted)]">/{taskSummary.total || 0}</span></p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Milestones done</p>
              <p className="mt-2 text-2xl font-bold text-white">{completedMilestones}<span className="text-base text-[var(--text-muted)]">/{totalMilestones}</span></p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-muted)]">Percentage</p>
              <p className="mt-2 text-2xl font-bold text-white">{clampedProgress}<span className="text-base text-[var(--text-muted)]">%</span></p>
            </div>
          </div>
        </div>

      </div>
      )}

      {!showInstallmentSchedule && (
        <>
          {!isProgressComplete && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Current Build — What You Receive</p>
              {lastCompletedStage ? (
                <div className="mt-2 flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-400" />
                  <div>
                    <p className="font-semibold text-white">{formatLabel(lastCompletedStage)}</p>
                    {lastCompletedStageAt && (
                      <p className="text-xs text-[var(--text-muted)]">Completed {formatDate(lastCompletedStageAt)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-[var(--text-muted)]" />
                  <p className="text-sm text-[var(--text-muted)]">No completed build available.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {!refundStatus && refundEligibility?.eligible ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowRefundRequestForm(true);
                    requestAnimationFrame(() => refundRequestRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--gold-primary)]/40 px-4 py-2.5 text-sm font-semibold text-[var(--gold-primary)] transition-colors hover:bg-[var(--gold-primary)]/10"
                >
                  <DollarSign className="h-4 w-4" />
                  Request Refund
                </button>
              ) : null}
            </div>
            {!isFullPayment && installmentSummary && (
              <button
                type="button"
                onClick={() => {
                  setShowInstallmentSchedule(true);
                  requestAnimationFrame(() => installmentScheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-4 py-2.5 text-sm font-bold text-black transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.3)]"
              >
                <CreditCard className="h-4 w-4" />
                View Installment Schedule
              </button>
            )}
          </div>
        </>
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

            {/* Mark as Received button - Customer finalizes fulfillment */}
            {['delivered', 'picked_up'].includes(buildClaim.claim_status) && (
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <div>
                  <p className="text-sm font-bold text-emerald-300">
                    {buildClaim.claim_status === 'picked_up'
                      ? 'Your guitar has been released for pickup'
                      : 'Your guitar has been delivered'}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-200/80">
                    Please confirm that you have received your build/parts to complete and finalize project fulfillment.
                  </p>
                </div>
                <button
                  onClick={handleMarkReceived}
                  disabled={markReceivedLoading}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-bold text-black transition-all hover:shadow-[0_0_20px_rgba(16,185,129,0.35)] disabled:opacity-50"
                >
                  {markReceivedLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {markReceivedLoading ? 'Finalizing Fulfillment...' : 'Confirm Receipt & Finalize Fulfillment'}
                </button>
              </div>
            )}

            {buildClaim.claim_status === 'received' && buildClaim.received_at && (
              <p className="mt-2 text-xs text-emerald-300/70">
                Received on {formatDate(buildClaim.received_at)}
              </p>
            )}
          </div>
        )}

        {/* Request Refund (customer-only, only when eligible) */}
        {refundEligibility?.eligible && !refundStatus && showRefundRequestForm && (
          <div ref={refundRequestRef} className="mt-6 rounded-xl border border-[var(--gold-primary)]/30 bg-[var(--gold-primary)]/5 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Request Refund</p>
              <button
                type="button"
                onClick={() => setShowRefundRequestForm(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close refund request form"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
        {isFullPayment && !isProgressComplete ? (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/5 p-5">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <p className="text-white font-bold text-lg">Payment Complete</p>
                <p className="text-sm text-[var(--text-muted)]">You paid it in Full Payment.</p>
              </div>
            </div>
          </div>
        ) : installmentSummary && showInstallmentSchedule ? (
          <div ref={installmentScheduleRef} className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
              <h3 className="text-white font-bold text-lg">Payment Installment Schedule</h3>
              </div>
              {paymentStatus && (
                <span className={`ml-auto text-xs font-semibold px-2.5 py-1 rounded-full border ${paymentStatus.bg} ${paymentStatus.border} ${paymentStatus.color}`}>
                  {paymentStatus.label}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowInstallmentSchedule(false);
                  requestAnimationFrame(() => progressSummaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                }}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-light)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
              >
                Back to Track Progress
              </button>
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
            </div>

            {/* Installment schedule cards */}
            {installmentData?.installments?.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--text-muted)]">Schedule Breakdown</p>
                <div className="space-y-3">
                  {installmentData.installments.map((inst) => {
                    const statusKey = inst.display_status || inst.status;
                    const isPaid = statusKey === 'paid';
                    const isPendingVerification = statusKey === 'for_verification';
                    const isRejected = statusKey === 'rejected';
                    const isOverdue = statusKey === 'overdue';
                    const isDue = statusKey === 'due';
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
                      <article
                        key={inst.schedule_id}
                        className={`min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-dark)] p-4 ${isOverdue ? 'border-red-500/30 bg-red-500/[0.04]' : ''}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                isPaid ? 'bg-green-400' :
                                isPendingVerification ? 'bg-amber-400' :
                                isOverdue ? 'bg-red-400' :
                                isDue ? 'bg-blue-400' :
                                'bg-slate-500'
                              }`} />
                              <h4 className="font-semibold text-white">Installment #{inst.installment_number}</h4>
                            </div>
                            <p className="mt-1 pl-[18px] text-xs text-[var(--text-muted)]">Due {formatShortDate(inst.due_date) || '—'}</p>
                          </div>
                          <span className={`inline-flex max-w-full whitespace-normal rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeConfig.bg} ${statusBadgeConfig.border} ${statusBadgeConfig.text}`}>
                            {statusBadgeConfig.label}
                          </span>
                        </div>

                        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2">
                          <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Amount Due</p>
                            <p className="mt-1 break-words font-bold text-[var(--gold-primary)]">{formatCurrency(inst.amount)}</p>
                          </div>
                          <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] p-3">
                            <p className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">Payment Info</p>
                            {isPaid ? (
                              <p className="mt-1 break-words text-sm font-medium text-white">Paid on {formatDate(inst.payment_date || inst.paid_at || inst.payment_verified_at)}</p>
                            ) : isPendingVerification ? (
                              <div className="mt-1 break-words text-sm text-amber-300">
                                <p>Submitted {formatShortDate(inst.submitted_at) || '—'}</p>
                                {inst.payment_reference && <p className="mt-0.5 text-xs text-[var(--text-muted)]">Ref: {inst.payment_reference}</p>}
                              </div>
                            ) : (
                              <p className="mt-1 text-sm text-[var(--text-muted)]">No payment submitted</p>
                            )}
                          </div>
                        </div>

                        {isRejected && (
                          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-300">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                            <span>
                              <strong>Payment rejected.</strong> Your previous payment could not be verified.
                              {inst.rejection_reason ? ` Reason: "${inst.rejection_reason}".` : ''} Submit a new payment using Pay Now.
                            </span>
                          </div>
                        )}

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400">
                              <CheckCircle className="h-3.5 w-3.5 text-green-400" /> Verified
                            </span>
                          ) : <span />}
                          {isPayable ? (
                            <button
                              type="button"
                              onClick={() => setPayingInstallment(inst)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] px-3.5 py-2 text-xs font-bold text-black transition-all hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                            >
                              <CreditCard className="h-3.5 w-3.5" /> Pay Now
                            </button>
                          ) : isPendingVerification ? (
                            <button
                              type="button"
                              onClick={() => setViewingInstallment(inst)}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
                            >
                              <Info className="h-3.5 w-3.5" /> View Proof
                            </button>
                          ) : isPaid ? (
                            <button
                              type="button"
                              onClick={() => printInstallmentReceipt(inst)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-light)] transition-colors hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
                              aria-label={`Print receipt for installment ${inst.installment_number}`}
                            >
                              <Printer className="h-3.5 w-3.5" /> Print Receipt
                            </button>
                          ) : (
                            <span className="text-xs text-[var(--text-muted)]">No action required</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}

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

        {/* Customer Delivery Confirmation Modal */}
        <ConfirmModal
          open={showDeliveryConfirmModal}
          title="Confirm Delivery"
          description="Have you received your custom guitar? Only confirm after you have physically received and inspected the guitar."
          confirmLabel="Confirm Delivery"
          cancelLabel="Cancel"
          variant="info"
          isBusy={confirmingDelivery}
          onConfirm={handleConfirmDelivery}
          onCancel={() => setShowDeliveryConfirmModal(false)}
        />
    </div>
  );
}
