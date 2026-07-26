import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { CreditCard, FileText, Loader2, Save, Smartphone, Upload } from 'lucide-react'
import { adminApi } from '../../../../utils/adminApi'
import { uploadToCloudinary } from '../../../../utils/cloudinary'
import { SectionLoader } from '../shared/SectionLoader'

export function PaymentSettingsTab({ showToast }) {
  const [settings, setSettings] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    gcash_number: '',
    maya_number: '',
    qr_image_url: '',
    notes: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [qrFile, setQrFile] = useState(null)
  const [qrPreview, setQrPreview] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getPaymentSettings()
      if (res?.data) {
        setSettings(res.data)
      }
    } catch (err) {
      console.error('Failed to load payment settings:', err)
      showToast?.('Failed to load payment settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      let qr_image_url = settings.qr_image_url
      if (qrFile) {
        qr_image_url = await uploadToCloudinary(qrFile)
      }
      await adminApi.updatePaymentSettings({
        ...settings,
        qr_image_url,
      })
      showToast?.('Payment settings saved successfully!', 'success')
      setQrFile(null)
      setQrPreview(null)
      loadSettings()
    } catch (err) {
      showToast?.(err.message || 'Failed to save payment settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setQrFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setQrPreview(reader.result)
    reader.readAsDataURL(file)
  }

  if (loading) {
    return (
      <motion.div key="payment-settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <SectionLoader label="Loading payment settings..." />
      </motion.div>
    )
  }

  const inputCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm'
  const labelCls = 'block text-xs uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-2'

  return (
    <motion.div key="payment-settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-[var(--gold-primary)]" />
            Bank Transfer Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Bank Name</label>
              <input
                type="text"
                value={settings.bank_name}
                onChange={(e) => setSettings((prev) => ({ ...prev, bank_name: e.target.value }))}
                placeholder="e.g. BDO Unibank"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Account Name</label>
              <input
                type="text"
                value={settings.account_name}
                onChange={(e) => setSettings((prev) => ({ ...prev, account_name: e.target.value }))}
                placeholder="e.g. CosmosCraft Guitar Shop"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Account Number</label>
              <input
                type="text"
                value={settings.account_number}
                onChange={(e) => setSettings((prev) => ({ ...prev, account_number: e.target.value }))}
                placeholder="e.g. 1234 5678 9012"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Smartphone className="w-5 h-5 text-[var(--gold-primary)]" />
            E-Wallet Details
          </h3>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>GCash Number</label>
              <input
                type="text"
                value={settings.gcash_number}
                onChange={(e) => setSettings((prev) => ({ ...prev, gcash_number: e.target.value }))}
                placeholder="e.g. 0917 123 4567"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Maya Number</label>
              <input
                type="text"
                value={settings.maya_number}
                onChange={(e) => setSettings((prev) => ({ ...prev, maya_number: e.target.value }))}
                placeholder="e.g. 0917 123 4567"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Upload className="w-5 h-5 text-[var(--gold-primary)]" />
            GCash QR Image
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Upload a QR code image that customers can scan to pay via GCash.
          </p>
          <div className="flex flex-col items-start gap-4">
            {(qrPreview || settings.qr_image_url) && (
              <div className="w-full max-w-[200px] rounded-xl overflow-hidden border border-[var(--border)] bg-white">
                <img
                  src={qrPreview || settings.qr_image_url}
                  alt="GCash QR Code"
                  className="w-full h-auto object-contain"
                />
              </div>
            )}
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[var(--border)] rounded-xl cursor-pointer hover:border-[var(--gold-primary)]/50 transition-colors bg-[var(--bg-primary)]/30">
              <div className="flex flex-col items-center gap-2 text-[var(--text-muted)]">
                <Upload className="w-6 h-6" />
                <span className="text-sm">{qrFile ? 'Change QR Image' : 'Upload QR Image'}</span>
                <span className="text-xs">PNG, JPG up to 5MB</span>
              </div>
              <input type="file" accept="image/png, image/jpeg, image/jpg" className="hidden" onChange={handleQrUpload} />
            </label>
            {qrPreview && (
              <button
                type="button"
                onClick={() => {
                  setQrFile(null)
                  setQrPreview(null)
                }}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Remove selected file
              </button>
            )}
          </div>
        </div>

        <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl p-6">
          <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-[var(--gold-primary)]" />
            Payment Notes / Instructions
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            These notes will be shown to customers during checkout as payment instructions.
          </p>
          <textarea
            value={settings.notes}
            onChange={(e) => setSettings((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="e.g. Please include your order number as a reference when making the payment."
            rows={6}
            className="w-full px-4 py-3 bg-[var(--surface-dark)] border border-[var(--border)] rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--gold-primary)] to-[var(--gold-secondary)] text-black font-bold hover:shadow-[0_8px_25px_rgba(212,175,55,0.35)] transition-all disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          {saving ? 'Saving...' : 'Save Payment Settings'}
        </button>
      </div>
    </motion.div>
  )
}
