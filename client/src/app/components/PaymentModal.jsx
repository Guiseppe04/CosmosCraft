import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

const GCASH_QR_CODE = '/images/payment/gcash-qr.png'

const BANK_DETAILS = {
  bankName: 'BDO Unibank',
  accountName: 'CosmosCraft Guitar Shop',
  accountNumber: '1234 5678 9012'
}

function ReceiptUpload({ onUpload, onRemove, image, label }) {
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => onUpload(reader.result)
      reader.readAsDataURL(file)
    }
  }

  if (image) {
    return (
      <div className="relative inline-block">
        <img src={image} alt="Receipt" className="max-h-48 rounded-lg border border-[var(--border)]" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-2 -right-2 px-3 py-1.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="px-6 py-3 border border-[var(--border)] text-[var(--text-light)] font-medium rounded-lg hover:border-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/5 transition-all"
      >
        Upload Receipt
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

export function PaymentModal({ isOpen, onClose, onSubmit, total, isProcessing, isCustomBuild }) {
  const [paymentMethod, setPaymentMethod] = useState('bank')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  const handleMethodChange = (method) => {
    setPaymentMethod(method)
    setError('')
  }

  const canSubmit = () => {
    if (paymentMethod === 'gcash' || paymentMethod === 'bank') {
      return !!receipt
    }
    return true
  }

  const handleSubmit = () => {
    if (!canSubmit()) {
      setError('Please upload your payment receipt to continue')
      return
    }
    onSubmit(paymentMethod, receipt)
  }

  const getMethodLabel = () => {
    if (paymentMethod === 'gcash') return 'GCash'
    if (paymentMethod === 'bank') return 'Bank Transfer'
    return 'Cash on Delivery'
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="w-full max-w-md bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl overflow-hidden"
        >
          <div className="p-5 border-b border-[var(--border)]">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--text-light)]">Payment</h2>
              <button
                onClick={onClose}
                className="p-2 text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-elevated)] rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-5 space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold text-[var(--text-light)] mb-3">Select Payment Method</p>
              <div className="space-y-2">
                <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  paymentMethod === 'gcash'
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10'
                    : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="gcash"
                    checked={paymentMethod === 'gcash'}
                    onChange={() => handleMethodChange('gcash')}
                    className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                  />
                  <span className="font-medium text-[var(--text-light)]">GCash</span>
                </label>

                <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  paymentMethod === 'bank'
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10'
                    : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank"
                    checked={paymentMethod === 'bank'}
                    onChange={() => handleMethodChange('bank')}
                    className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                  />
                  <span className="font-medium text-[var(--text-light)]">Bank Transfer</span>
                </label>

                <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-[var(--gold-primary)] bg-[var(--gold-primary)]/10'
                    : 'border-[var(--border)] hover:border-[var(--gold-primary)]/50'
                }`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    onChange={() => handleMethodChange('cod')}
                    className="w-4 h-4 text-[var(--gold-primary)] mr-3"
                  />
                  <span className="font-medium text-[var(--text-light)]">Cash on Delivery</span>
                </label>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {paymentMethod === 'gcash' && (
                <motion.div
                  key="gcash"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--text-light)] mb-3 text-center">Scan to Pay</p>
                    <div className="flex justify-center mb-4">
                      <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center">
                        <img src={GCASH_QR_CODE} alt="GCash QR Code" className="w-full h-full object-contain" />
                      </div>
                    </div>
                    <p className="text-center text-lg font-bold text-[var(--gold-primary)] mb-3">
                      Total: ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="text-sm text-[var(--text-muted)] space-y-2">
                    <p className="font-semibold text-[var(--text-light)]">How to pay:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Open GCash app on your phone</li>
                      <li>Scan the QR code above</li>
                      <li>Enter the exact amount shown</li>
                      <li>Send payment and save receipt</li>
                    </ol>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[var(--text-light)] mb-2">Upload Your Receipt</p>
                    <ReceiptUpload
                      label="GCash Receipt"
                      image={receipt}
                      onUpload={setReceipt}
                      onRemove={() => setReceipt(null)}
                    />
                  </div>
                </motion.div>
              )}

              {paymentMethod === 'bank' && (
                <motion.div
                  key="bank"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4"
                >
                  <div className="p-4 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)]">
                    <p className="text-sm font-semibold text-[var(--text-light)] mb-3">Bank Details</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Bank:</span>
                        <span className="text-[var(--text-light)] font-medium">{BANK_DETAILS.bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Account Name:</span>
                        <span className="text-[var(--text-light)] font-medium">{BANK_DETAILS.accountName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Account Number:</span>
                        <span className="text-[var(--text-light)] font-medium">{BANK_DETAILS.accountNumber}</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-[var(--gold-primary)] mt-4 text-center">
                      Total: ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="text-sm text-[var(--text-muted)] space-y-2">
                    <p className="font-semibold text-[var(--text-light)]">How to pay:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Transfer the exact amount to the account above</li>
                      <li>Use your name as payment reference</li>
                      <li>Take a screenshot of the transaction</li>
                      <li>Upload the proof of payment below</li>
                    </ol>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[var(--text-light)] mb-2">Upload Proof of Payment</p>
                    <ReceiptUpload
                      label="Bank Receipt"
                      image={receipt}
                      onUpload={setReceipt}
                      onRemove={() => setReceipt(null)}
                    />
                  </div>
                </motion.div>
              )}

              {paymentMethod === 'cod' && (
                <motion.div
                  key="cod"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="p-4 bg-[var(--surface-elevated)] rounded-lg border border-[var(--border)] text-center">
                    <p className="text-[var(--text-light)]">
                      Pay upon delivery. Please prepare the exact amount of{' '}
                      <span className="font-bold text-[var(--gold-primary)]">
                        ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                      </span>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="p-5 border-t border-[var(--border)]">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit() || isProcessing}
              className="w-full py-3.5 bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-[var(--text-dark)] font-bold rounded-lg hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Processing...' : `Place Order — ₱${total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}