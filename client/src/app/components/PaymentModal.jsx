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
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative rounded-2xl overflow-hidden border-2 border-green-200 bg-white shadow-lg"
      >
        <img src={image} alt="Receipt" className="w-full h-64 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-4 right-4 rounded-full bg-red-500 hover:bg-red-600 px-4 py-2 text-xs font-semibold text-white transition-all shadow-lg"
        >
          ✕ Remove
        </button>
        <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white text-sm font-medium">
          <span>✓ Receipt uploaded</span>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-8 text-center cursor-pointer hover:border-slate-400 hover:bg-slate-100/50 transition-all"
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="text-4xl mb-3">📷</div>
      <p className="text-base font-bold text-slate-900 mb-1">{label || 'Upload Receipt'}</p>
      <p className="text-xs text-slate-500 mb-4">PNG, JPG, or JPEG • Max 10MB</p>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          fileInputRef.current?.click()
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 hover:bg-yellow-500 px-6 py-3 text-sm font-bold text-slate-900 transition-all shadow-md hover:shadow-lg"
      >
        <span>+</span>
        <span>Choose File</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </motion.div>
  )
}

export function PaymentModal({ isOpen, onClose, onSubmit, total, isProcessing }) {
  const [paymentMethod, setPaymentMethod] = useState('bank')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  const handleMethodChange = (method) => {
    setPaymentMethod(method)
    setReceipt(null)
    setError('')
  }

  const canSubmit = () => {
    if (paymentMethod === 'gcash' || paymentMethod === 'bank') {
      return Boolean(receipt)
    }
    return true
  }

  const handleSubmit = () => {
    if (!canSubmit()) {
      setError('Please upload your payment receipt before continuing.')
      return
    }
    onSubmit(paymentMethod, receipt)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="border-b border-slate-200 px-6 sm:px-8 py-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Payment</p>
                <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900">Checkout</h2>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-slate-100 p-2.5 text-slate-500 hover:bg-slate-200 transition-colors duration-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-5 sm:p-6">
              <p className="text-xs sm:text-sm font-medium text-slate-600 uppercase tracking-[0.1em]">Total payment due</p>
              <div className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
                ₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 px-6 sm:px-8 py-6 sm:py-8">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700"
                >
                  {error}
                </motion.div>
              )}

              {/* Payment Method Selection */}
              <div className="space-y-4">
                <p className="text-sm sm:text-base font-bold text-slate-900">Select Payment Method</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {[
                    { value: 'gcash', title: 'GCash', subtitle: 'Upload receipt', icon: '📱' },
                    { value: 'bank', title: 'Bank Transfer', subtitle: 'BDO account', icon: '🏦' },
                    { value: 'cod', title: 'Cash on Delivery', subtitle: 'Pay on delivery', icon: '🚚', highlight: true }
                  ].map((option) => (
                    <motion.button
                      key={option.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => handleMethodChange(option.value)}
                      className={`relative rounded-2xl border-2 p-5 text-left transition-all duration-300 ${
                        paymentMethod === option.value
                          ? 'border-yellow-400 bg-yellow-50 shadow-lg shadow-yellow-200/50'
                          : 'border-slate-200 bg-white hover:border-yellow-300 hover:shadow-md'
                      } ${option.highlight && paymentMethod === option.value ? 'ring-2 ring-yellow-300 ring-offset-2' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{option.icon}</span>
                            <p className="font-bold text-slate-900">{option.title}</p>
                          </div>
                          <p className="text-xs text-slate-500">{option.subtitle}</p>
                        </div>
                        <motion.div
                          className={`flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                            paymentMethod === option.value
                              ? 'border-yellow-500 bg-yellow-400 text-white'
                              : 'border-slate-300 bg-white text-slate-300'
                          }`}
                          animate={paymentMethod === option.value ? { scale: 1.1 } : { scale: 1 }}
                        >
                          {paymentMethod === option.value && <span className="text-sm font-bold">✓</span>}
                        </motion.div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Payment Details */}
              {paymentMethod === 'gcash' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6"
                >
                  <div>
                    <p className="font-bold text-slate-900">GCash Payment</p>
                    <p className="text-xs text-slate-500 mt-1">Mobile Payment Solution</p>
                  </div>
                  <div className="rounded-2xl bg-white p-6 shadow-md border border-slate-100">
                    <img src={GCASH_QR_CODE} alt="GCash QR code" className="mx-auto h-auto w-full max-w-xs object-contain" />
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">Scan the QR code in your GCash app, pay the exact amount, and upload the receipt below.</p>
                  <ReceiptUpload label="Upload GCash receipt" image={receipt} onUpload={setReceipt} onRemove={() => setReceipt(null)} />
                </motion.div>
              )}

              {paymentMethod === 'bank' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6"
                >
                  <div>
                    <p className="font-bold text-slate-900">Bank Transfer Details</p>
                    <p className="text-xs text-slate-500 mt-1">Please transfer to this account</p>
                  </div>
                  <div className="rounded-2xl bg-white p-5 shadow-md border border-slate-100 space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-slate-200">
                      <span className="text-sm text-slate-600 font-medium">Bank</span>
                      <span className="font-semibold text-slate-900">{BANK_DETAILS.bankName}</span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-slate-200">
                      <span className="text-sm text-slate-600 font-medium">Account Name</span>
                      <span className="font-semibold text-slate-900">{BANK_DETAILS.accountName}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-slate-600 font-medium">Account Number</span>
                      <span className="font-semibold text-slate-900 font-mono">{BANK_DETAILS.accountNumber}</span>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">Transfer the exact amount to this account and upload proof of payment below.</p>
                  <ReceiptUpload label="Upload bank proof" image={receipt} onUpload={setReceipt} onRemove={() => setReceipt(null)} />
                </motion.div>
              )}

              {paymentMethod === 'cod' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-white p-6"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 text-3xl">🚚</div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">Cash on Delivery</p>
                      <p className="text-sm text-slate-600 mt-2">
                        Pay the delivery rider when your order arrives. No payment or receipt upload required. You'll receive your items safely and can inspect them before payment.
                      </p>
                      <div className="mt-4 p-4 bg-white rounded-xl border border-green-200">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-[0.05em]">✓ No upfront payment required</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Footer - Fixed */}
          <div className="border-t border-slate-200 px-6 sm:px-8 py-5 sm:py-6 bg-white">
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit() || isProcessing}
              whileHover={{ scale: !canSubmit() && !isProcessing ? 1.02 : 1 }}
              whileTap={{ scale: !canSubmit() && !isProcessing ? 0.98 : 1 }}
              className={`w-full rounded-2xl px-6 py-4 text-base sm:text-lg font-black text-slate-900 transition-all duration-300 flex items-center justify-center gap-3 ${
                !canSubmit() || isProcessing
                  ? 'bg-yellow-300 opacity-60 cursor-not-allowed'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:shadow-xl hover:shadow-yellow-400/40 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-5 h-5 border-3 border-slate-900 border-t-transparent rounded-full animate-spin" />
                  <span className="font-bold">Processing...</span>
                </>
              ) : (
                <>
                  <span className="font-black tracking-tight">Place Order</span>
                  <span className="text-xl font-black">₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
