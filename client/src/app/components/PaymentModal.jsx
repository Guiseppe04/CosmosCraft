import { useEffect, useRef, useState } from 'react'
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
        className="relative overflow-hidden rounded-2xl border-2 border-green-200 bg-white shadow-lg"
      >
        <img src={image} alt="Receipt" className="h-64 w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-4 top-4 rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-lg transition-all hover:bg-red-600"
        >
          Remove
        </button>
        <div className="absolute bottom-4 left-4 text-sm font-medium text-white">
          Receipt uploaded
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-8 text-center transition-all hover:border-slate-400 hover:bg-slate-100/50"
      onClick={() => fileInputRef.current?.click()}
    >
      <div className="mb-3 text-4xl">Upload</div>
      <p className="mb-1 text-base font-bold text-slate-900">{label || 'Upload Receipt'}</p>
      <p className="mb-4 text-xs text-slate-500">PNG, JPG, or JPEG. Max 10MB</p>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          fileInputRef.current?.click()
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-bold text-slate-900 shadow-md transition-all hover:bg-yellow-500 hover:shadow-lg"
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

export function PaymentModal({
  isOpen,
  onClose,
  onSubmit,
  total,
  fullTotal = total,
  isProcessing,
  requiresCustomTerms = false,
  downPaymentRate = 0.5,
}) {
  const [paymentMethod, setPaymentMethod] = useState('bank')
  const [paymentPlan, setPaymentPlan] = useState('down_payment')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return

    setPaymentMethod('bank')
    setPaymentPlan(requiresCustomTerms ? 'down_payment' : 'full')
    setReceipt(null)
    setError('')
  }, [isOpen, requiresCustomTerms])

  const downPaymentAmount = Number.isFinite(Number(total)) ? Number(total) : 0
  const fullPaymentAmount = Number.isFinite(Number(fullTotal)) ? Number(fullTotal) : downPaymentAmount
  const downPaymentPercentage = Math.round(downPaymentRate * 100)
  const selectedPaymentPlan = requiresCustomTerms ? paymentPlan : 'full'
  const amountDue = selectedPaymentPlan === 'full' ? fullPaymentAmount : downPaymentAmount
  const remainingBalance = Math.max(0, fullPaymentAmount - amountDue)

  const handleMethodChange = (method) => {
    setPaymentMethod(method)
    setReceipt(null)
    setError('')
  }

  const canSubmit = () => {
    const hasValidReceipt = paymentMethod === 'gcash' || paymentMethod === 'bank'
      ? Boolean(receipt)
      : true

    return hasValidReceipt
  }

  const handleSubmit = () => {
    if (!canSubmit()) {
      setError('Please upload your payment receipt before continuing.')
      return
    }

    onSubmit(paymentMethod, receipt, selectedPaymentPlan)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Payment</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Checkout</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition-colors duration-200 hover:bg-slate-200"
              >
                X
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-5 sm:p-6">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-slate-600 sm:text-sm">
                {requiresCustomTerms && selectedPaymentPlan === 'down_payment' ? 'Down payment due now' : 'Total payment due'}
              </p>
              <div className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">
                PHP {amountDue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
              </div>
              {requiresCustomTerms && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p className="font-semibold">
                    {selectedPaymentPlan === 'full'
                      ? 'You are paying the full custom build amount now.'
                      : `${downPaymentPercentage}% down payment required to start your custom build.`}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {selectedPaymentPlan === 'full'
                      ? 'No remaining balance will be due before release or delivery.'
                      : `Remaining balance after this payment: PHP ${remainingBalance.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm font-medium text-red-700"
                >
                  {error}
                </motion.div>
              )}

              {requiresCustomTerms && (
                <div className="space-y-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6">
                  <div>
                    <p className="font-bold text-slate-900">Choose Custom Build Payment Option</p>
                    <p className="mt-1 text-sm text-slate-600">
                      You can pay the required {downPaymentPercentage}% down payment now or settle the full custom build total in one payment.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      {
                        value: 'down_payment',
                        title: `Pay ${downPaymentPercentage}% Down Payment`,
                        amount: downPaymentAmount,
                        subtitle: `Remaining later: PHP ${Math.max(0, fullPaymentAmount - downPaymentAmount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
                      },
                      {
                        value: 'full',
                        title: 'Pay in Full',
                        amount: fullPaymentAmount,
                        subtitle: 'Settle the full custom build total now',
                      }
                    ].map((option) => {
                      const isSelected = selectedPaymentPlan === option.value

                      return (
                        <motion.button
                          key={option.value}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          type="button"
                          onClick={() => setPaymentPlan(option.value)}
                          className={`rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
                            isSelected
                              ? 'border-yellow-400 bg-yellow-50 shadow-lg shadow-yellow-200/50'
                              : 'border-slate-200 bg-white hover:border-yellow-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-bold text-slate-900">{option.title}</p>
                              <p className="mt-2 text-2xl font-black text-slate-900">
                                PHP {option.amount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}
                              </p>
                              <p className="mt-2 text-xs text-slate-500">{option.subtitle}</p>
                            </div>
                            <div
                              className={`mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                                isSelected
                                  ? 'border-yellow-500 bg-yellow-400 text-white'
                                  : 'border-slate-300 bg-white text-slate-300'
                              }`}
                            >
                              {isSelected && <span className="text-sm font-bold">OK</span>}
                            </div>
                          </div>
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <p className="text-sm font-bold text-slate-900 sm:text-base">Select Payment Method</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  {[
                    { value: 'gcash', title: 'GCash', subtitle: 'Upload receipt' },
                    { value: 'bank', title: 'Bank Transfer', subtitle: 'BDO account' }
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
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-bold text-slate-900">{option.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{option.subtitle}</p>
                        </div>
                        <motion.div
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            paymentMethod === option.value
                              ? 'border-yellow-500 bg-yellow-400 text-white'
                              : 'border-slate-300 bg-white text-slate-300'
                          }`}
                          animate={paymentMethod === option.value ? { scale: 1.1 } : { scale: 1 }}
                        >
                          {paymentMethod === option.value && <span className="text-[10px] font-bold">OK</span>}
                        </motion.div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

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
                    <p className="mt-1 text-xs text-slate-500">Mobile Payment Solution</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-md">
                    <img src={GCASH_QR_CODE} alt="GCash QR code" className="mx-auto h-auto w-full max-w-xs object-contain" />
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Scan the QR code in your GCash app, pay the exact amount of PHP {amountDue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}, and upload the receipt below.
                  </p>
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
                    <p className="mt-1 text-xs text-slate-500">Please transfer to this account</p>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-200 py-3">
                      <span className="text-sm font-medium text-slate-600">Bank</span>
                      <span className="font-semibold text-slate-900">{BANK_DETAILS.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 py-3">
                      <span className="text-sm font-medium text-slate-600">Account Name</span>
                      <span className="font-semibold text-slate-900">{BANK_DETAILS.accountName}</span>
                    </div>
                    <div className="flex items-center justify-between py-3">
                      <span className="text-sm font-medium text-slate-600">Account Number</span>
                      <span className="font-mono font-semibold text-slate-900">{BANK_DETAILS.accountNumber}</span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Transfer the exact amount of PHP {amountDue.toLocaleString('en-PH', { maximumFractionDigits: 2 })} to this account and upload proof of payment below.
                  </p>
                  <ReceiptUpload label="Upload bank proof" image={receipt} onUpload={setReceipt} onRemove={() => setReceipt(null)} />
                </motion.div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 bg-white px-6 py-5 sm:px-8 sm:py-6">
            <motion.button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit() || isProcessing}
              whileHover={{ scale: canSubmit() && !isProcessing ? 1.02 : 1 }}
              whileTap={{ scale: canSubmit() && !isProcessing ? 0.98 : 1 }}
              className={`flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-black text-slate-900 transition-all duration-300 sm:text-lg ${
                !canSubmit() || isProcessing
                  ? 'cursor-not-allowed bg-yellow-300 opacity-60'
                  : 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:shadow-xl hover:shadow-yellow-400/40 active:scale-95'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="h-5 w-5 rounded-full border-[3px] border-slate-900 border-t-transparent animate-spin" />
                  <span className="font-bold">Processing...</span>
                </>
              ) : (
                <>
                  <span className="font-black tracking-tight">
                    {requiresCustomTerms
                      ? selectedPaymentPlan === 'full' ? 'Pay in Full' : 'Pay Down Payment'
                      : 'Place Order'}
                  </span>
                  <span className="text-xl font-black">PHP {amountDue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
