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
      <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
        <img src={image} alt="Receipt" className="w-full h-52 object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-3 right-3 rounded-full bg-black/70 px-3 py-1 text-xs text-white hover:bg-black/80"
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
      <p className="text-sm font-semibold text-slate-900 mb-2">{label || 'Upload receipt'}</p>
      <p className="text-xs text-slate-500 mb-4">PNG, JPG, or JPEG • max 10MB</p>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="rounded-md bg-yellow-400 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-yellow-300"
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Payment</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">Checkout</h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-slate-500 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              Total payment due
              <div className="mt-2 text-lg font-semibold text-slate-900">₱{total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900">Payment method</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: 'gcash', title: 'GCash', subtitle: 'Upload receipt' },
                  { value: 'bank', title: 'Bank Transfer', subtitle: 'BDO account' },
                  { value: 'cod', title: 'Cash on Delivery', subtitle: 'Pay on delivery' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleMethodChange(option.value)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      paymentMethod === option.value
                        ? 'border-yellow-400 bg-yellow-50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{option.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{option.subtitle}</p>
                      </div>
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${paymentMethod === option.value ? 'border-yellow-500 bg-yellow-500 text-white' : 'border-slate-300 bg-white text-slate-300'}`}>
                        ✓
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'gcash' && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">GCash Payment</p>
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <img src={GCASH_QR_CODE} alt="GCash QR code" className="mx-auto h-48 w-full object-contain" />
                </div>
                <p className="text-sm text-slate-600">Scan the QR code in your GCash app, pay the exact amount, and upload the receipt.</p>
                <ReceiptUpload label="Upload GCash receipt" image={receipt} onUpload={setReceipt} onRemove={() => setReceipt(null)} />
              </div>
            )}

            {paymentMethod === 'bank' && (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Bank Transfer</p>
                <div className="rounded-2xl bg-white p-4 shadow-sm text-sm text-slate-700">
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-500">Bank</span>
                    <span className="font-medium text-slate-900">{BANK_DETAILS.bankName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-200">
                    <span className="text-slate-500">Account name</span>
                    <span className="font-medium text-slate-900">{BANK_DETAILS.accountName}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-500">Account number</span>
                    <span className="font-medium text-slate-900">{BANK_DETAILS.accountNumber}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Transfer the exact amount to this account and upload proof of payment.</p>
                <ReceiptUpload label="Upload bank proof" image={receipt} onUpload={setReceipt} onRemove={() => setReceipt(null)} />
              </div>
            )}

            {paymentMethod === 'cod' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Cash on Delivery</p>
                <p className="mt-2">Pay the rider when your order arrives. No upload required.</p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit() || isProcessing}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isProcessing ? 'Processing...' : `Place Order · ₱${total.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
