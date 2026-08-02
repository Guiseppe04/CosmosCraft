import { useEffect, useState } from 'react'
import { ModalHeader } from '../shared/ModalHeader'
import { ModalFooter } from '../shared/ModalFooter'
import { FormField } from '../shared/FormField'

const cleanNumericValue = (value) => {
  const cleaned = String(value).replace(/[^0-9.]/g, '')
  const [integer, decimals] = cleaned.split('.')
  if (!decimals) return integer
  return `${integer}.${decimals.slice(0, 2)}`
}

const formatPriceValue = (value) => {
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) return ''
  return numericValue.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function ServiceModal({ modal, form, setForm, formErrors, closeModal, isSaving, saveService, labelCls, inputCls }) {
  const [priceDisplay, setPriceDisplay] = useState('')
  const [isPriceFocused, setIsPriceFocused] = useState(false)

  useEffect(() => {
    if (!modal.open || isPriceFocused) return
    const rawPrice = form.price === undefined || form.price === null ? '' : String(form.price)
    const numericPrice = Number(rawPrice)
    setPriceDisplay(rawPrice === '' ? '' : Number.isFinite(numericPrice) ? formatPriceValue(numericPrice) : rawPrice)
  }, [modal.open, form.price, isPriceFocused])

  const handlePriceChange = (event) => {
    const rawValue = cleanNumericValue(event.target.value.replace(/PHP\s*/gi, ''))
    setForm((f) => ({ ...f, price: rawValue }))
    setPriceDisplay(rawValue)
  }

  const handlePriceBlur = () => {
    setIsPriceFocused(false)
    const numericPrice = Number(form.price)
    if (form.price === '' || Number.isNaN(numericPrice)) {
      setPriceDisplay(form.price || '')
      return
    }
    setPriceDisplay(formatPriceValue(numericPrice))
  }

  const handlePriceFocus = () => {
    setIsPriceFocused(true)
    setPriceDisplay(form.price === undefined || form.price === null ? '' : String(form.price))
  }

  const isSaveDisabled = !form.name?.toString().trim() || !form.price?.toString().trim() || Number(form.price) <= 0

  return (
    <>
      <ModalHeader title={modal.data ? 'Edit Service' : 'Add Service'} onClose={closeModal} />
      <div className="space-y-4 mt-6">
        <FormField label="Service Name *" required error={formErrors.name}>
          <input
            className={inputCls}
            value={form.name || ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Setup & Intonation"
          />
        </FormField>

        <FormField label="Description">
          <textarea
            className={`${inputCls} min-h-[120px] resize-none`}
            value={form.description || ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Describe the service..."
          />
        </FormField>

        <FormField label="Base Price *" required error={formErrors.price}>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--text-muted)]">PHP</span>
            <input
              className={`${inputCls} pl-14`}
              inputMode="decimal"
              value={priceDisplay}
              onChange={handlePriceChange}
              onFocus={handlePriceFocus}
              onBlur={handlePriceBlur}
              placeholder="1,500.00"
            />
          </div>
        </FormField>

        <FormField label="Duration (hours)">
          <input
            className={inputCls}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={form.duration || ''}
            onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value.replace(/[^0-9.]/g, '') }))}
            placeholder="e.g. 2"
          />
        </FormField>

        <FormField label="Status">
          <select
            value={form.is_active === undefined ? 'true' : form.is_active ? 'true' : 'false'}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === 'true' }))}
            className={inputCls}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </FormField>
      </div>
      <ModalFooter onCancel={closeModal} onSave={saveService} isSaving={isSaving} disabled={isSaveDisabled} />
    </>
  )
}