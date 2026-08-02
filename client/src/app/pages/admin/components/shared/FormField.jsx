export function FormField({
  label,
  children,
  error,
  required = false,
  value,
  onChange,
  type = 'text',
  placeholder,
  textarea = false,
  min,
  step,
  id,
}) {
  const fieldId = id || (label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : undefined)
  const baseCls = 'w-full px-4 py-3 bg-[var(--surface-dark)] border rounded-2xl text-[var(--text-light)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 text-sm'
  const normalCls = `${baseCls} border-[var(--border)] focus:ring-[var(--gold-primary)]`
  const errorCls = `${baseCls} border-red-500/50 focus:ring-red-500`

  const hasInputProps = value !== undefined || onChange !== undefined

  return (
    <div>
      {label ? (
        <label htmlFor={fieldId} className="block text-sm font-semibold text-[var(--text-muted)] mb-2">
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
      ) : null}
      {hasInputProps ? (
        textarea ? (
          <textarea
            id={fieldId}
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={error ? errorCls : normalCls}
          />
        ) : (
          <input
            id={fieldId}
            type={type}
            value={value ?? ''}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            min={min}
            step={step}
            className={error ? errorCls : normalCls}
          />
        )
      ) : (
        children
      )}
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  )
}

export default FormField