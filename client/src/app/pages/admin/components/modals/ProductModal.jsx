import { motion, AnimatePresence } from 'motion/react'
import { Check, AlertCircle, Loader2, X, Sparkles, ArrowLeft, ArrowRight, Package } from 'lucide-react'
import { ImageUploadWidget } from '../shared/ImageUploadWidget'
import { useRef, useState, useEffect, useCallback } from 'react'
import { formatLowStockHelper } from '../../../../utils/stockUtils'
import { validate } from '../../constants/adminOptions'

const STEP_FIELDS = {
  basic: ['name', 'sku', 'description', 'brand', 'category_id'],
  inventory: ['price', 'cost_price', 'max_stock', 'low_stock_threshold'],
  media: ['image_url', 'image_file'],
}

function AutoResizeTextarea({ value, onChange, placeholder, className, maxLength = 500 }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [value])

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        rows={3}
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        maxLength={maxLength}
      />
      <span className="absolute bottom-2 right-3 text-[10px] text-[var(--text-muted)]/60 select-none">
        {(value || '').length}/{maxLength}
      </span>
    </div>
  )
}

function ClearableInput({ value, onChange, placeholder, className, type = 'text', prefix, onClear, error }) {
  const [isFocused, setIsFocused] = useState(false)
  const hasValue = value !== '' && value !== null && value !== undefined

  return (
    <div className="relative">
      {prefix && (
        <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm pointer-events-none transition-colors ${isFocused ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`}>
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        className={`${className} pr-10 ${prefix ? 'pl-9' : ''} ${isFocused ? 'ring-2 ring-[var(--gold-primary)]/30 border-[var(--gold-primary)]' : ''} transition-all duration-200`}
        aria-invalid={Boolean(error)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {hasValue && (
        <button
          type="button"
          aria-label="Clear field"
          onClick={() => {
            onChange({ target: { value: '' } })
            onClear?.()
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--text-muted)] hover:text-white hover:bg-white/10 transition-all"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

function ToggleSwitch({ checked, onChange, id, label }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] focus:ring-offset-2 focus:ring-offset-[var(--surface-dark)] ${
          checked ? 'bg-emerald-500' : 'bg-gray-600'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer font-medium text-white text-sm">
        {label}
      </label>
    </div>
  )
}

function MarginProgressBar({ marginPct }) {
  if (marginPct == null) return null
  const clampedPct = Math.min(Math.max(marginPct, 0), 100)
  const color = marginPct >= 20 ? 'bg-emerald-400' : marginPct >= 10 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="mt-2 h-2 w-full rounded-full bg-[var(--border)]/30 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: '0%' }}
        animate={{ width: `${clampedPct}%` }}
        transition={{ type: 'spring', stiffness: 60, damping: 15 }}
      />
    </div>
  )
}

export function ProductModal({
  modal,
  form,
  setForm,
  formErrors,
  setFormErrors,
  wizardTab,
  setWizardTab,
  closeModal,
  isSaving,
  isUploading,
  saveProduct,
  handleImageUpload,
  categories,
  formatCurrency,
  validateAndSave,
  productRules,
  labelCls,
}) {
  const [direction, setDirection] = useState(1)
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false)
  const formRef = useRef(null)

  const productStep1Complete = Boolean(String(form.name || '').trim() && String(form.sku || '').trim() && String(form.category_id || '').trim())
  const sellingN = parseFloat(form.price)
  const productStep2Complete = Number.isFinite(sellingN) && sellingN > 0
  const productStep3Complete = Boolean(form.image_url || form.preview_url || form.image_file)
  const productTabs = [
    { id: 'basic', step: 1, label: 'Basic Info', done: productStep1Complete, description: 'Introduce your product', title: 'Start with the essentials', hint: 'Give your product a name, SKU, and category so customers can find it.' },
    { id: 'inventory', step: 2, label: 'Pricing & Stock', done: productStep2Complete, description: 'Set price and inventory', title: 'Set your price and stock', hint: 'Choose a selling price and set inventory levels. Cost price is optional.' },
    { id: 'media', step: 3, label: 'Media & Assets', done: productStep3Complete, description: 'Add an image and review', title: 'Make it ready for the catalog', hint: 'Add an optional product image, review the details, and save your product.' },
  ]
  const currentStep = productTabs.find((tab) => tab.id === wizardTab) || productTabs[0]
  const isBusy = isSaving || isUploading

  const sellingPrice = parseFloat(form.price)
  const costPrice = parseFloat(form.cost_price) || 0
  const hasValidSelling = !Number.isNaN(sellingPrice)
  const profitAmount = hasValidSelling ? sellingPrice - costPrice : NaN
  const marginPct = hasValidSelling && sellingPrice > 0 ? (profitAmount / sellingPrice) * 100 : null
  const marginHealthy = marginPct != null && marginPct >= 20
  const marginWarn = marginPct != null && marginPct < 20
  const recommendedPrice = costPrice > 0 ? costPrice / 0.8 : null

  const fieldBase = 'w-full px-4 py-2.5 bg-[var(--bg-primary)] rounded-xl text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm transition-colors'
  const fieldOk = `${fieldBase} border border-[var(--border)] focus:ring-[var(--gold-primary)]`
  const fieldErr = `${fieldBase} border border-[var(--border)] border-l-4 border-l-red-500 focus:ring-red-500/40`
  const selErr = fieldErr
  const selOk = fieldOk
  const scrollToFirstError = () => formRef.current?.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  // Bring validation errors on an earlier step back into view.
  useEffect(() => {
    const errorStep = Object.keys(STEP_FIELDS).find((step) => STEP_FIELDS[step].some((field) => formErrors[field]))
    if (errorStep && errorStep !== wizardTab) {
      setDirection(-1)
      setWizardTab(errorStep)
    } else {
      scrollToFirstError()
    }
  }, [formErrors, wizardTab, setWizardTab])

  const validateSteps = (steps) => {
    const fields = steps.flatMap((step) => STEP_FIELDS[step])
    const rules = Object.fromEntries(Object.entries(productRules).filter(([field]) => fields.includes(field)))
    const errors = validate(rules, form)
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleTabChange = (tabId) => {
    if (isBusy) return
    const currentIdx = productTabs.findIndex((t) => t.id === wizardTab)
    const newIdx = productTabs.findIndex((t) => t.id === tabId)
    if (newIdx > currentIdx && !validateSteps(productTabs.slice(0, newIdx).map((tab) => tab.id))) return
    if (newIdx <= currentIdx) setFormErrors({})
    setDirection(newIdx > currentIdx ? 1 : -1)
    setWizardTab(tabId)
    formRef.current?.scrollTo({ top: 0 })
  }

  const handleBack = () => handleTabChange(wizardTab === 'media' ? 'inventory' : 'basic')

  const handleNext = () => handleTabChange(wizardTab === 'basic' ? 'inventory' : 'media')

  const handleCancel = useCallback(() => {
    if (isBusy) return
    const trackedFields = [
      'name', 'sku', 'description', 'brand', 'category_id', 'price',
      'cost_price', 'low_stock_threshold', 'max_stock',
    ]

    const normStr = (val) => {
      if (val === null || val === undefined) return ''
      return String(val)
    }

    const normActive = (val) => {
      if (val === null || val === undefined) return ''
      if (val === true || val === 1 || val === '1' || val === 'true') return 'true'
      if (val === false || val === 0 || val === '0' || val === 'false') return 'false'
      return String(val)
    }

    const hasChanges = modal.data
      ? trackedFields.some((key) => normStr(form[key]) !== normStr(modal.data[key])) ||
        normActive(form.is_active ?? true) !== normActive(modal.data.is_active) ||
        form.image_file instanceof File ||
        normStr(form.image_url) !== normStr(modal.data.primary_image ?? modal.data.image_url)
      : trackedFields.some((key) => {
          const val = form[key]
          return val !== '' && val !== null && val !== undefined
        }) ||
        form.image_file instanceof File

    if (hasChanges) {
      setShowUnsavedWarning(true)
    } else {
      closeModal()
    }
  }, [form, modal.data, closeModal, isBusy])

  const generateSku = useCallback(() => {
    const rawBrand = String(form.brand || '').trim()
    const rawName = String(form.name || '').trim()
    const categoryId = form.category_id

    const categoryName = categories?.find(
      (category) => String(category.category_id) === String(categoryId)
    )?.name || ''

    const toCode = (text, max = 8) =>
      text
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '')
        .slice(0, max)

    const brandCode = toCode(rawBrand, 6)
    const nameUpper = rawName.toUpperCase()

    let prefix = ''

    if (/PICKUP|PUP/.test(nameUpper)) prefix = 'PUP'
    else if (/BRIDGE|BRG/.test(nameUpper)) prefix = 'BRG'
    else if (/TUNER|TUNING/.test(nameUpper)) prefix = 'TUN'
    else if (/\bNUT\b/.test(nameUpper)) prefix = 'NUT'
    else if (/POTENTIOMETER|\bPOT\b/.test(nameUpper)) prefix = 'POT'
    else if (/CAPACITOR|\bCAP\b/.test(nameUpper)) prefix = 'CAP'
    else if (/SWITCH/.test(nameUpper)) prefix = 'SW'
    else if (/KNOB/.test(nameUpper)) prefix = 'KNB'
    else if (/JACK|OUTPUT/.test(nameUpper)) prefix = 'JCK'
    else if (/STRAP/.test(nameUpper)) prefix = 'STR'
    else if (/PICKGUARD/.test(nameUpper)) prefix = 'PG'
    else if (/\bNECK\b/.test(nameUpper)) prefix = 'NCK'
    else if (/\bBODY\b/.test(nameUpper)) prefix = 'BOD'
    else if (/SCREW|HARDWARE/.test(nameUpper)) prefix = 'SCR'
    else if (/STRINGS/.test(nameUpper)) prefix = 'STR'
    else if (/CABLE/.test(nameUpper)) prefix = 'ACC'
    else if (/CASE/.test(nameUpper)) prefix = 'ACC'
    else if (categoryName.toLowerCase().includes('electric guitar')) prefix = 'GTR-E'
    else if (categoryName.toLowerCase().includes('acoustic guitar')) prefix = 'GTR-A'
    else if (categoryName.toLowerCase().includes('bass')) prefix = 'GTR-B'
    else if (categoryName.toLowerCase().includes('ukulele')) prefix = 'UKU'
    else if (categoryName.toLowerCase().includes('accessor')) prefix = 'ACC'
    else if (categoryName.toLowerCase().includes('parts')) prefix = 'PRT'
    else prefix = toCode(categoryName, 6) || 'PRD'

    const specWords = rawName
      .replace(/[^A-Z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['THE', 'AND', 'FOR', 'WITH', 'FROM', 'PREMIUM', 'PROFESSIONAL', 'STANDARD', 'CLASSIC', 'DELUXE', 'ELECTRIC', 'ACOUSTIC', 'GUITAR', 'BASS', 'UKULELE', 'HUMBUCKER', 'SINGLE', 'COIL'].includes(w.toUpperCase()))
      .slice(0, 2)
      .map(w => toCode(w, 5))
      .filter(Boolean)

    const specCode = specWords.join('')

    let sku = ''
    if (brandCode) {
      sku = `${prefix}-${brandCode}`
      if (specCode && specCode !== brandCode) {
        sku += `-${specCode}`
      }
    } else {
      sku = `${prefix}-${toCode(rawName, 10)}`
    }

    if (!sku || sku === '-') {
      setForm((f) => ({ ...f, sku: '' }))
      return
    }

    const suffix = modal.data?.product_id ? '' : '-' + Date.now().toString().slice(-4)
    setForm((f) => ({ ...f, sku: sku + suffix }))
  }, [form.brand, form.name, form.category_id, categories, modal.data?.product_id, setForm])

  const handleSaveAndAnother = () => validateAndSave(productRules, () => saveProduct({ addAnother: true }))()

  const pageVariants = {
    enter: (dir) => ({ opacity: 0, x: dir > 0 ? 30 : -30 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir > 0 ? -30 : 30 }),
  }

  return (
    <>
      {/* Unsaved changes warning */}
      <AnimatePresence>
        {showUnsavedWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-dark)] p-6 shadow-2xl"
            >
              <h3 className="text-lg font-bold text-white">Unsaved Changes</h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">You have unsaved changes. Are you sure you want to close?</p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowUnsavedWarning(false)}
                  className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--bg-primary)] transition-colors"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={() => { setShowUnsavedWarning(false); closeModal() }}
                  className="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/30 transition-colors"
                >
                  Discard
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="shrink-0 border-b border-[var(--border)] px-5 pb-5 pt-5 sm:px-8 sm:pt-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--gold-primary)] sm:flex">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{modal.data ? 'Edit Product' : 'New Product'}</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Build your catalog in three simple steps.</p>
            </div>
          </div>
          <button type="button" onClick={handleCancel} disabled={isBusy} aria-label="Close product modal" className="rounded-xl p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label="Product setup steps" className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
          {productTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              disabled={isBusy}
              aria-current={wizardTab === tab.id ? 'step' : undefined}
              aria-label={tab.label}
              className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition-colors disabled:opacity-50 sm:flex-row sm:gap-3 sm:px-3 sm:text-left ${wizardTab === tab.id ? 'border-[var(--gold-primary)] bg-[var(--bg-primary)]' : 'border-[var(--border)] hover:bg-[var(--bg-primary)]'}`}
            >
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${wizardTab === tab.id ? 'bg-[var(--gold-primary)] text-black' : tab.done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[var(--bg-primary)] text-[var(--text-muted)]'}`}>
                {tab.done && wizardTab !== tab.id ? <Check className="h-3.5 w-3.5" /> : tab.step}
              </span>
              <span className="min-w-0">
                <span className={`block text-[11px] font-semibold sm:text-xs ${wizardTab === tab.id ? 'text-[var(--gold-primary)]' : 'text-[var(--text-muted)]'}`}>{tab.label}</span>
                <span className="mt-1 hidden text-[10px] text-[var(--text-muted)] sm:block">{tab.description}</span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8" ref={formRef}>
        <div className="mb-6">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--gold-primary)]">Step {currentStep.step} of 3</p>
          <h3 className="text-lg font-semibold text-white">{currentStep.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">{currentStep.hint}</p>
        </div>
        <AnimatePresence mode="wait" custom={direction}>
          {wizardTab === 'basic' && (
            <motion.div
              key="basic"
              onAnimationComplete={scrollToFirstError}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-5"
            >
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                  Product Name *
                </label>
                <ClearableInput
                  value={form.name || ''}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Classic Stratocaster"
                  className={formErrors.name ? fieldErr : fieldOk}
                  error={formErrors.name}
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.name}</p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`block text-xs font-semibold uppercase tracking-wider ${formErrors.sku ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                    SKU *
                  </label>
                  <button
                    type="button"
                    onClick={generateSku}
                    className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2 py-1 text-[10px] font-semibold text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:border-[var(--gold-primary)] transition-colors"
                    title="Auto-generate SKU"
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto
                  </button>
                </div>
                <ClearableInput
                  value={form.sku || ''}
                  onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                  placeholder="e.g. CC-STRAT-001"
                  className={formErrors.sku ? fieldErr : fieldOk}
                  error={formErrors.sku}
                />
                {formErrors.sku && (
                  <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.sku}</p>
                )}
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Unique Stock Keeping Unit for inventory tracking.</p>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Product Description
                </label>
                <AutoResizeTextarea
                  value={form.description || ''}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Write a compelling description..."
                  className={`${fieldOk} pb-7`}
                  maxLength={500}
                />
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">Shown on the product page and in search previews.</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
                  <div>
                    <label className={`${labelCls} ${formErrors.brand ? 'text-red-400' : ''}`}>Brand</label>
                    <ClearableInput
                      value={form.brand || ''}
                      onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                      placeholder="e.g. Fender, Gibson, Ibanez"
                      className={formErrors.brand ? fieldErr : fieldOk}
                      error={formErrors.brand}
                    />
                    {formErrors.brand && (
                      <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.brand}</p>
                    )}
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">Manufacturer or brand name for product identification.</p>
                  </div>
                  <div>
                    <label className={`${labelCls} ${formErrors.category_id ? 'text-red-400' : ''}`}>Category *</label>
                    <select
                      value={form.category_id || ''}
                      onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                      className={formErrors.category_id ? selErr : selOk}
                    >
                      <option value="">Select Category</option>
                      {(categories || []).map((category) => (
                        <option key={category.category_id} value={category.category_id}>{category.name}</option>
                      ))}
                    </select>
                    {formErrors.category_id && (
                      <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.category_id}</p>
                    )}
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">Groups this product in the shop catalog.</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] px-4 py-3">
                <ToggleSwitch
                  id="is_active"
                  checked={form.is_active ?? true}
                  onChange={(checked) => setForm((f) => ({ ...f, is_active: checked }))}
                  label="Active Product"
                />
                <p className="ml-0 mt-1.5 text-xs text-[var(--text-muted)]">When off, the product is hidden from the storefront.</p>
              </div>
            </motion.div>
          )}

          {wizardTab === 'inventory' && (
            <motion.div
              key="inventory"
              onAnimationComplete={scrollToFirstError}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-5"
            >
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Pricing</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${formErrors.price ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                      Selling Price *
                    </label>
                    <ClearableInput
                      type="number"
                      value={form.price || ''}
                      onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                      placeholder="e.g. 50000"
                      className={formErrors.price ? fieldErr : fieldOk}
                      prefix="₱"
                      error={formErrors.price}
                    />
                    {formErrors.price && (
                      <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.price}</p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Cost Price</label>
                    <ClearableInput
                      type="number"
                      value={form.cost_price || ''}
                      onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                      placeholder="e.g. 30000"
                      className={formErrors.cost_price ? fieldErr : fieldOk}
                      prefix="₱"
                      error={formErrors.cost_price}
                    />
                    {formErrors.cost_price && <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.cost_price}</p>}
                    <p className="mt-1.5 text-xs text-[var(--text-muted)]">Your landed cost per unit (optional, for margin math).</p>
                  </div>
                </div>
              </div>

              {form.price !== '' && form.price !== null && form.price !== undefined && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className={`rounded-xl border p-4 sm:p-5 ${
                    marginWarn
                      ? 'border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-amber-500/5'
                      : marginHealthy
                        ? 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5'
                        : 'border-[var(--border)] bg-[var(--bg-primary)]/50'
                  }`}
                >
                  <p className="mb-3 text-sm font-semibold text-white">Profit preview</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Selling price</p>
                      <p className="mt-1 font-semibold text-white">{hasValidSelling ? formatCurrency(sellingPrice, false) : '—'}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Cost price</p>
                      <p className="mt-1 font-semibold text-white">{formatCurrency(costPrice, false)}</p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Profit amount</p>
                      <p className={`mt-1 font-semibold ${Number.isNaN(profitAmount) ? 'text-[var(--text-muted)]' : profitAmount >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {hasValidSelling && !Number.isNaN(profitAmount) ? formatCurrency(profitAmount, false) : '—'}
                      </p>
                    </div>
                    <div className="rounded-lg border border-[var(--border)]/80 bg-black/20 px-3 py-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Margin %</p>
                      <p className={`mt-1 font-semibold ${marginPct == null ? 'text-[var(--text-muted)]' : marginHealthy ? 'text-emerald-300' : 'text-amber-200'}`}>
                        {marginPct != null ? `${Math.round(marginPct)}%` : '—'}
                      </p>
                    </div>
                  </div>
                  <MarginProgressBar marginPct={marginPct} />
                  {marginWarn && marginPct != null && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 space-y-2"
                    >
                      <p className="flex items-center gap-1.5 text-xs text-amber-200/90">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        Margin is below 20%. Consider adjusting price or cost.
                      </p>
                      {recommendedPrice && (
                        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-300" />
                          <span className="text-xs text-amber-200/80">
                            Suggested price: <strong className="text-amber-200">{formatCurrency(recommendedPrice, false)}</strong> (for 20% margin)
                          </span>
                          <button
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, price: Math.ceil(recommendedPrice).toString() }))}
                            className="ml-auto shrink-0 rounded-md border border-amber-500/40 px-2 py-1 text-[10px] font-medium text-amber-300 hover:bg-amber-500/10 transition-colors"
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                  {marginHealthy && marginPct != null && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-3 text-xs text-emerald-300/90"
                    >
                      ✓ Healthy margin at or above 20%.
                    </motion.p>
                  )}
                </motion.div>
              )}

               <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/60 p-4 sm:p-5">
                 <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Stock levels</p>
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                   <div>
                     <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Maximum Stock</label>
                     <ClearableInput
                       type="number"
                       value={form.max_stock ?? ''}
                       onChange={(e) => setForm((f) => ({ ...f, max_stock: e.target.value }))}
                       placeholder="e.g. 100"
                       className={formErrors.max_stock ? fieldErr : fieldOk}
                       error={formErrors.max_stock}
                     />
                     {formErrors.max_stock && <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.max_stock}</p>}
                     <p className="mt-1.5 text-xs text-[var(--text-muted)]">Full-stock capacity. On creation, current stock is initialized to this value.</p>
                   </div>
                   <div>
                     <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Low Stock Threshold (%)</label>
                     <ClearableInput
                       type="number"
                       value={form.low_stock_threshold ?? ''}
                       onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                       placeholder="10"
                       className={formErrors.low_stock_threshold ? fieldErr : fieldOk}
                       error={formErrors.low_stock_threshold}
                     />
                     {formErrors.low_stock_threshold && <p className="mt-1 text-xs text-red-400" data-error="true" role="alert">{formErrors.low_stock_threshold}</p>}
                     {form.max_stock !== '' && form.max_stock != null && Number(form.max_stock) > 0 && form.low_stock_threshold !== '' && form.low_stock_threshold != null && (
                       <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                         {formatLowStockHelper(form.low_stock_threshold, form.max_stock)}
                       </p>
                     )}
                     {(!form.max_stock || Number(form.max_stock) <= 0 || !form.low_stock_threshold || Number(form.low_stock_threshold) <= 0) && (
                       <p className="mt-1.5 text-xs text-[var(--text-muted)]">You'll be alerted when stock drops below this percentage of maximum stock.</p>
                     )}
                   </div>
                 </div>
               </div>
            </motion.div>
          )}

          {wizardTab === 'media' && (
            <motion.div
              key="media"
              onAnimationComplete={scrollToFirstError}
              custom={direction}
              variants={pageVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="space-y-4"
            >
              <div className="rounded-2xl bg-[var(--bg-primary)] p-4 sm:p-5">
                <ImageUploadWidget
                  label="Product image (optional)"
                  imageUrl={form.image_url}
                  previewUrl={form.preview_url}
                  isUploading={isUploading}
                  onUpload={handleImageUpload}
                  hint="Use a clear PNG or JPG to help your product stand out in the catalog."
                />
                {(formErrors.image_url || formErrors.image_file) && <p className="mt-2 text-xs text-red-400" data-error="true" role="alert">{formErrors.image_url || formErrors.image_file}</p>}
              </div>
              {(form.image_file || form.preview_url || form.image_url) && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium text-white">
                      {form.image_file?.name || (form.image_url ? 'Current catalog image' : 'Selected image')}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {form.image_file
                        ? `${(form.image_file.size / 1024).toFixed(form.image_file.size >= 102400 ? 0 : 1)} KB`
                        : form.image_url
                          ? 'Select another image above or remove it.'
                          : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        image_file: undefined,
                        preview_url: undefined,
                        image_url: '',
                      }))
                    }
                    className="shrink-0 rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/10"
                  >
                    Remove image
                  </button>
                </motion.div>
              )}
              <div className="rounded-2xl border border-[var(--border)] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-white">Review your product</h4>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${form.is_active === false ? 'bg-[var(--bg-primary)] text-[var(--text-muted)]' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {form.is_active === false ? 'Hidden from shop' : 'Active in shop'}
                  </span>
                </div>
                <p className="break-words font-semibold text-white">{form.name || 'Untitled product'}</p>
                <p className="mt-1 break-words text-xs text-[var(--text-muted)]">{form.sku || 'No SKU'} · {categories?.find((category) => String(category.category_id) === String(form.category_id))?.name || 'No category'}</p>
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-4">
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">Selling price</dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--gold-primary)]">{hasValidSelling ? formatCurrency(sellingPrice, false) : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">Maximum stock</dt>
                    <dd className="mt-1 text-sm font-semibold text-white">{form.max_stock !== '' && form.max_stock != null ? form.max_stock : 'Not set'}</dd>
                  </div>
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-dark)] px-5 py-4 sm:px-8 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {wizardTab !== 'basic' && (
              <button type="button" onClick={handleBack} disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
            )}
            <button type="button" onClick={handleCancel} disabled={isBusy} className="rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-primary)] disabled:opacity-50">
              Cancel
            </button>
          </div>
          {wizardTab !== 'media' ? (
            <button type="button" onClick={handleNext} disabled={isBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--gold-secondary)] disabled:opacity-50">
              Next <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:gap-3">
              <button type="button" onClick={handleSaveAndAnother} disabled={isBusy} className="rounded-xl border border-[var(--gold-primary)] px-4 py-2.5 text-sm font-medium text-[var(--gold-primary)] transition-colors hover:bg-[var(--bg-primary)] disabled:cursor-not-allowed disabled:opacity-50">
                Save &amp; Add Another
              </button>
              <button type="button" onClick={validateAndSave(productRules, saveProduct)} disabled={isBusy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--gold-primary)] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[var(--gold-secondary)] disabled:cursor-not-allowed disabled:opacity-50">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSaving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
