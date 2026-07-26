export function QuantityStepper({ value, onChange, maxValue, minValue = 1, disabled = false }) {
  const handleDecrement = () => {
    if (!disabled && value > (minValue || 1)) {
      onChange(value - 1)
    }
  }

  const handleIncrement = () => {
    if (!disabled && (!maxValue || value < maxValue)) {
      onChange(value + 1)
    }
  }

  const handleInputChange = (e) => {
    const val = parseInt(e.target.value, 10) || 0
    const validVal = Math.max(minValue || 1, Math.min(maxValue || 9999, val))
    onChange(validVal)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= (minValue || 1)}
        className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-white text-xl font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        min={minValue}
        max={maxValue}
        className="flex-1 h-12 px-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-white text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || (maxValue && value >= maxValue)}
        className="w-12 h-12 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] text-white text-xl font-bold hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center"
      >
        +
      </button>
    </div>
  )
}

export default QuantityStepper
