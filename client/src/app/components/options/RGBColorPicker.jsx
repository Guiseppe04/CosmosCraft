import { useState, useCallback, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * RGBColorPicker Component
 * Provides RGB and HEX color selection with real-time preview
 */
export function RGBColorPicker({ value, onChange, label = 'Select Color' }) {
  const [hexValue, setHexValue] = useState(value || '#1a1a1a')
  const [showCopied, setShowCopied] = useState(false)

  // Ensure hex is valid when value changes from parent
  useEffect(() => {
    if (value && /^#[0-9A-F]{6}$/i.test(value)) {
      setHexValue(value)
    }
  }, [value])

  // Convert HEX to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 }
  }

  // Convert RGB to HEX
  const rgbToHex = (r, g, b) => {
    return '#' + [r, g, b].map((x) => {
      const hex = x.toString(16)
      return hex.length === 1 ? '0' + hex : hex
    }).join('').toUpperCase()
  }

  const rgb = hexToRgb(hexValue)

  const handleHexChange = (e) => {
    let value = e.target.value
    if (!value.startsWith('#')) {
      value = '#' + value
    }
    value = value.toUpperCase().slice(0, 7)
    setHexValue(value)

    if (/^#[0-9A-F]{6}$/i.test(value)) {
      onChange(value)
    }
  }

  const handleRgbChange = (channel, newValue) => {
    const parsed = parseInt(newValue) || 0
    const clamped = Math.max(0, Math.min(255, parsed))
    const updated = { ...rgb, [channel]: clamped }
    const newHex = rgbToHex(updated.r, updated.g, updated.b)
    setHexValue(newHex)
    onChange(newHex)
  }

  const handleColorInputChange = (e) => {
    const color = e.target.value
    setHexValue(color)
    onChange(color)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(hexValue)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="w-full space-y-3">
      {/* Color Preview & Picker Input */}
      <div className="flex gap-3 items-center">
        <div className="relative flex-shrink-0">
          <input
            type="color"
            value={hexValue}
            onChange={handleColorInputChange}
            className="h-12 w-12 rounded-lg border-2 border-[var(--border)] cursor-pointer hover:border-[var(--gold-primary)] transition-colors"
          />
          <div className="absolute inset-0 rounded-lg border border-[var(--gold-primary)]/20 pointer-events-none" />
        </div>

        <div className="flex-1">
          <label className="block text-xs font-medium text-[var(--text-muted)] mb-1.5">
            HEX Value
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={hexValue}
              onChange={handleHexChange}
              placeholder="#1a1a1a"
              maxLength={7}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-2 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)] transition-colors font-mono"
            />
            <button
              type="button"
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] text-sm text-[var(--text-light)] hover:border-[var(--gold-primary)] hover:bg-[var(--surface-dark)] transition-colors flex-shrink-0"
            >
              {showCopied ? (
                <>
                  <Check className="h-4 w-4 text-[var(--gold-primary)]" />
                  <span className="hidden sm:inline">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* RGB Sliders */}
      <div className="space-y-2.5 pt-1">
        {/* Red Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              Red (R)
            </label>
            <span className="text-xs font-semibold text-[var(--text-light)] bg-red-500/20 px-2 py-0.5 rounded">
              {rgb.r}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb.r}
            onChange={(e) => handleRgbChange('r', e.target.value)}
            className="w-full h-2 rounded-lg bg-[var(--surface-dark)] border border-[var(--border)] cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-red-600 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-red-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-red-600"
          />
          <input
            type="number"
            min="0"
            max="255"
            value={rgb.r}
            onChange={(e) => handleRgbChange('r', e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1.5 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
          />
        </div>

        {/* Green Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              Green (G)
            </label>
            <span className="text-xs font-semibold text-[var(--text-light)] bg-green-500/20 px-2 py-0.5 rounded">
              {rgb.g}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb.g}
            onChange={(e) => handleRgbChange('g', e.target.value)}
            className="w-full h-2 rounded-lg bg-[var(--surface-dark)] border border-[var(--border)] cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-green-600 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-green-600"
          />
          <input
            type="number"
            min="0"
            max="255"
            value={rgb.g}
            onChange={(e) => handleRgbChange('g', e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1.5 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
          />
        </div>

        {/* Blue Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[var(--text-muted)]">
              Blue (B)
            </label>
            <span className="text-xs font-semibold text-[var(--text-light)] bg-blue-500/20 px-2 py-0.5 rounded">
              {rgb.b}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="255"
            value={rgb.b}
            onChange={(e) => handleRgbChange('b', e.target.value)}
            className="w-full h-2 rounded-lg bg-[var(--surface-dark)] border border-[var(--border)] cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-blue-600"
          />
          <input
            type="number"
            min="0"
            max="255"
            value={rgb.b}
            onChange={(e) => handleRgbChange('b', e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-dark)] px-3 py-1.5 text-sm text-[var(--text-light)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--gold-primary)]"
          />
        </div>
      </div>

      {/* RGB Display */}
      <div className="pt-2 px-3 py-2.5 rounded-lg bg-[var(--surface-dark)] border border-[var(--border)]">
        <p className="text-xs text-[var(--text-muted)] mb-1">RGB Value:</p>
        <p className="font-mono text-sm font-semibold text-[var(--text-light)]">
          rgb({rgb.r}, {rgb.g}, {rgb.b})
        </p>
      </div>
    </div>
  )
}
