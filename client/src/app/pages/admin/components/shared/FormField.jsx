export function FormField({ label, children, error, required = false }) {
  return (
    <div>
      {label ? (
        <label className="block text-sm font-semibold text-[var(--text-muted)] mb-2">
          {label}
          {required ? <span className="text-red-400"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  )
}

export default FormField
