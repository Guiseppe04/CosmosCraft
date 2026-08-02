import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { X, CheckCircle, Clock, DollarSign, Calendar, Upload, CreditCard, Banknote } from 'lucide-react'
import { adminApi } from '../../utils/adminApi'
import { formatCurrency } from '../../utils/formatCurrency'

const API_URL = import.meta.env.VITE_API_URL
const FALLBACK_QR = '/gcashqrcode.png'
const FALLBACK_BANK = {
  bankName: 'BDO Unibank',
  accountName: 'CosmosCraft Guitar Shop',
  accountNumber: '1234 5678 9012',
}

function ReceiptUpload({ image, onUpload, onRemove, label }) {
  const fileInputRef = useRef(null)

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
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
        <img src={image} alt="Receipt" className="h-48 w-full object-cover" />
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
    <label className="cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-blue-50 p-6 text-center transition-all hover:border-slate-400 hover:bg-slate-100/50">
      <div className="mb-2 text-3xl">
        <Upload className="mx-auto h-6 w-6 text-slate-400" />
      </div>
      <p className="mb-1 text-sm font-bold text-slate-900">{label || 'Upload Receipt'}</p>
      <p className="mb-3 text-xs text-slate-500">PNG, JPG, or JPEG. Max 10MB</p>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          fileInputRef.current?.click()
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2 text-xs font-bold text-slate-900 shadow-md transition-all hover:bg-yellow-500"
      >
        <span>Choose File</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </label>
  )
}

export default function AdvancePaymentModal({ isOpen, onClose, projectId, installments = [], onSuccess, isProcessing: externalProcessing }) {
  const [paymentMethod, setPaymentMethod] = useState('bank')
  const [selectedIds, setSelectedIds] = useState([])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showGcashQr, setShowGcashQr] = useState(true)
  const [paymentSettings, setPaymentSettings] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const processing = externalProcessing || isProcessing

  // Installments awaiting admin confirmation (flagged paid_in_advance but not yet
  // confirmed). These cannot be re-selected — the payment is already submitted.
  const awaitingConfirmation = (installments || []).filter(
    (inst) => inst.paid_in_advance && inst.status !== 'paid'
  )
  const unpaid = (installments || []).filter(
    (inst) => (inst.status === 'pending' || inst.status === 'overdue') && !inst.paid_in_advance
  )

  const selectedSet = new Set(selectedIds)
  const selectedInstallments = unpaid.filter((inst) => selectedSet.has(inst.schedule_id))
  const totalAmount = selectedInstallments.reduce((sum, inst) => sum + Number(inst.amount || 0), 0)
  const remainingBalance = unpaid.reduce((sum, inst) => sum + Number(inst.amount || 0), 0)

  const selectAllUnpaid = selectedInstallments.length === unpaid.length && unpaid.length > 0

  useEffect(() => {
    if (!isOpen) return

    setPaymentMethod('bank')
    setSelectedIds([])
    setReferenceNumber('')
    setReceipt(null)
    setError('')
    setShowGcashQr(true)
    setIsSuccess(false)

    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/api/payment-settings`, { credentials: 'include' })
        const json = await res.json()
        if (json?.success && json?.data) {
          setPaymentSettings(json.data)
        }
      } catch {
        // Fall back to defaults
      }
    }
    fetchSettings()
  }, [isOpen])

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleSelectAll = () => {
    if (selectAllUnpaid) {
      setSelectedIds([])
    } else {
      setSelectedIds(unpaid.map((inst) => inst.schedule_id))
    }
  }

  const handleMethodChange = (method) => {
    setPaymentMethod(method)
    setShowGcashQr(true)
  }

  const canSubmit = selectedInstallments.length > 0 && (receipt || referenceNumber.trim())

  const handleSubmit = async () => {
    if (!canSubmit || processing) return

    setError('')
    setIsProcessing(true)
    try {
      const result = await adminApi.createAdvancePayment(projectId, {
        schedule_ids: selectedIds,
        payment_method: paymentMethod === 'bank' ? 'bank_transfer' : paymentMethod,
        amount: Number(totalAmount.toFixed(2)),
        reference_number: referenceNumber.trim() || undefined,
        proof_url: receipt || undefined,
      })
      if (result && result.status === 'success') {
        onSuccess && onSuccess(result.data)
        setIsSuccess(true)
        setTimeout(() => onClose(), 1800)
      } else {
        setError(result?.message || 'Failed to process advance payment')
      }
    } catch (err) {
      setError(err.message || 'Failed to process advance payment')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  if (isSuccess) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-3xl border border-green-500/30 bg-green-500/10 p-10 text-center shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20"
            >
              <CheckCircle className="h-8 w-8 text-green-400" />
            </motion.div>
            <h3 className="text-2xl font-bold text-white">Advance Payment Submitted</h3>
            <p className="mt-2 text-slate-300">
              Your payment is being reviewed. An admin will confirm it shortly.
            </p>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl"
        >
          <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                  Advance Payment
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">Pay Future Installments</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 rounded-full border border-slate-200 bg-slate-100 p-2.5 text-slate-500 transition-colors duration-200 hover:bg-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Select one or more upcoming installments to pay in advance. You may also pay the entire remaining balance.
            </p>
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

              {/* Installment selection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900">Unpaid Installments</p>
                  <div className="flex items-center gap-3 text-sm">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      disabled={unpaid.length === 0}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed"
                    >
                      {selectAllUnpaid ? 'Clear All' : 'Select All Unpaid'}
                    </button>
                    <span className="text-[var(--text-muted)] text-slate-500">
                      {selectedInstallments.length} of {unpaid.length} selected
                    </span>
                  </div>
                </div>

                {unpaid.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 py-6 text-center">
                    <CheckCircle className="mx-auto h-8 w-8 text-green-400" />
                    <p className="mt-2 text-slate-700 font-semibold">All installments are paid</p>
                    <p className="mt-1 text-sm text-slate-500">There are no unpaid installments to pay in advance.</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-3 text-center text-xs uppercase tracking-wider text-slate-500 font-semibold">
                            Select
                          </th>
                          <th className="p-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">#</th>
                          <th className="p-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Due Date</th>
                          <th className="p-3 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaid.map((inst) => {
                          const isChecked = selectedSet.has(inst.schedule_id)
                          return (
                            <tr key={inst.schedule_id} className="border-t border-slate-200">
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleSelect(inst.schedule_id)}
                                  className={`mx-auto flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                                    isChecked
                                      ? 'border-yellow-400 bg-yellow-400 text-white'
                                      : 'border-slate-300 bg-white hover:border-yellow-400'
                                  }`}
                                >
                                  {isChecked && <CheckCircle className="h-3.5 w-3.5" />}
                                </button>
                              </td>
                              <td className="p-3 text-white font-mono">{inst.installment_number}</td>
                              <td className="p-3 text-slate-700">
                                {inst.due_date
                                  ? new Date(inst.due_date).toLocaleDateString('en-PH', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : '—'}
                              </td>
                              <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(Number(inst.amount))}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Installments awaiting admin confirmation (not selectable) */}
            {awaitingConfirmation.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-800">
                  Awaiting Confirmation
                </p>
                <div className="space-y-2">
                  {awaitingConfirmation.map((inst) => (
                    <div
                      key={inst.schedule_id}
                      className="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <span className="text-sm text-slate-700">Month {inst.installment_number}</span>
                      </div>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Pending Admin Review
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-amber-800">
                  These installments have a pending advance payment. An admin will confirm once the proof is verified.
                </p>
              </div>
            )}

            {/* Remaining balance shortcut */}
                {remainingBalance > 0 && (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm font-semibold text-yellow-900">
                        Pay entire remaining balance: {formatCurrency(remainingBalance)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelectedIds(unpaid.map((i) => i.schedule_id))}
                        className="ml-auto rounded-lg bg-yellow-400 px-3 py-1 text-xs font-bold text-slate-900 hover:bg-yellow-500"
                      >
                        Select All
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-yellow-800">
                      Selecting all unpaid installments above pays the full remaining balance.
                    </p>
                  </div>
                )}

              </div>

              {/* Payment method selection */}
              <div className="space-y-4">
                <p className="text-sm font-bold text-slate-900 sm:text-base">Select Payment Method</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {[
                    { value: 'bank', title: 'Bank Transfer', subtitle: 'BDO account' },
                    { value: 'gcash', title: 'GCash', subtitle: 'Upload receipt' },
                  ].map((option) => (
                    <motion.button
                      key={option.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => handleMethodChange(option.value)}
                      className={`relative rounded-2xl border-2 p-4 text-left transition-all duration-300 ${
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
                        <div
                          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                            paymentMethod === option.value
                              ? 'border-yellow-500 bg-yellow-400 text-white'
                              : 'border-slate-300 bg-white text-slate-300'
                          }`}
                        >
                          {paymentMethod === option.value && <span className="text-sm font-bold">OK</span>}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Payment details (bank / gcash) */}
              {paymentMethod === 'bank' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6"
                >
                  <p className="font-bold text-slate-900">Bank Transfer Details</p>
                  <p className="text-xs text-slate-500">Transfer the exact amount to this account</p>
                  <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
                    <div className="flex items-center justify-between border-b border-slate-200 py-2">
                      <span className="text-sm font-medium text-slate-600">Bank</span>
                      <span className="font-semibold text-slate-900">{paymentSettings?.bank_name || FALLBACK_BANK.bankName}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-200 py-2">
                      <span className="text-sm font-medium text-slate-600">Account Name</span>
                      <span className="font-semibold text-slate-900">{paymentSettings?.account_name || FALLBACK_BANK.accountName}</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium text-slate-600">Account Number</span>
                      <span className="font-mono font-semibold text-slate-900">{paymentSettings?.account_number || FALLBACK_BANK.accountNumber}</span>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Transfer the exact amount of {formatCurrency(totalAmount)} and provide your reference number below.
                  </p>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="e.g. Transaction reference number"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-yellow-400 focus:outline-none"
                  />
                </motion.div>
              )}

              {paymentMethod === 'gcash' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6"
                >
                  <p className="font-bold text-slate-900">GCash Payment</p>
                  <p className="text-xs text-slate-500">Scan the QR code and upload your receipt</p>
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
                    {showGcashQr && (
                      <img
                        src={paymentSettings?.qr_image_url || FALLBACK_QR}
                        alt="GCash QR code"
                        className="mx-auto h-auto w-full max-w-xs object-contain"
                        onError={() => setShowGcashQr(false)}
                      />
                    )}
                    {!showGcashQr && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        GCash payment image is unavailable. Please ask admin for updated QR details.
                      </div>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600">
                    Scan the QR code in your GCash app, pay the exact amount of {formatCurrency(totalAmount)}, and upload the receipt below.
                  </p>
                  <ReceiptUpload
                    label="Upload GCash receipt"
                    image={receipt}
                    onUpload={setReceipt}
                    onRemove={() => setReceipt(null)}
                  />
                </motion.div>
              )}
            </div>

            {/* Confirmation / checkout summary */}
            <div className="border-t border-slate-200 bg-white px-6 py-5 sm:px-8 sm:py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Payment Confirmation
              </p>
              <div className="mt-3 space-y-2">
                {selectedInstallments.length === 0 ? (
                  <p className="text-sm text-slate-500">Select one or more installments to pay.</p>
                ) : (
                  selectedInstallments.map((inst) => (
                    <div
                      key={inst.schedule_id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>Month {inst.installment_number}</span>
                        <span className="text-slate-400">—</span>
                        <span className="text-xs text-slate-500">
                          Due {inst.due_date ? new Date(inst.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                        </span>
                      </div>
                      <span className="font-semibold text-slate-900">{formatCurrency(Number(inst.amount))}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-yellow-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {paymentMethod === 'bank' ? 'Bank Transfer' : 'GCash'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500 uppercase">Total Amount</p>
                  <p className="text-2xl font-black text-slate-900">{formatCurrency(totalAmount)}</p>
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || processing}
                whileHover={{ scale: canSubmit && !processing ? 1.02 : 1 }}
                whileTap={{ scale: canSubmit && !processing ? 0.98 : 1 }}
                className={`mt-4 flex w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 text-base font-black text-slate-900 transition-all duration-300 sm:text-lg ${
                  !canSubmit || processing
                    ? 'cursor-not-allowed bg-yellow-300 opacity-60'
                    : 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:shadow-xl hover:shadow-yellow-400/40 active:scale-95'
                }`}
              >
                {processing ? (
                  <>
                    <div className="h-5 w-5 rounded-full border-[3px] border-slate-900 border-t-transparent animate-spin" />
                    <span className="font-bold">Processing...</span>
                  </>
                ) : (
                  <>
                    <Banknote className="h-5 w-5" />
                    <span className="font-black tracking-tight">Confirm Advance Payment</span>
                    <span className="text-xl font-black">{formatCurrency(totalAmount)}</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
