import { ChevronDown } from 'lucide-react'

export default function OptionGroup({
  title,
  description,
  options,
  value,
  onChange,
  variant = 'card',
  chipShape = 'rounded',
  surface = 'light',
  isOpen = true,
  onToggle,
  selectedLabel,
}) {
  const dark = surface === 'dark'

  return (
    <section className="border-b border-white/10 bg-[#2a2a2a] last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-white">{title}</h3>
          {description && <p className="mt-1 text-xs text-white/55">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {selectedLabel && <span className="hidden text-xs text-white/60 sm:inline">{selectedLabel}</span>}
          <ChevronDown className={`h-4 w-4 text-white/70 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4">
          <div className={variant === 'menu' ? 'space-y-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-3'}>
            {options.map(option => {
              const active = value === option.value
              const previewStyle =
                variant === 'swatch'
                  ? { backgroundColor: option.value }
                  : option.preview
                    ? {
                        backgroundImage: `url(${option.preview})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : { backgroundColor: '#f3f4f6' }

              const priceLabel = option.price > 0 ? `+$${option.price}` : null
              const shapeClass = chipShape === 'circle' ? 'rounded-full' : 'rounded-2xl'
              const previewClass =
                chipShape === 'circle'
                  ? 'aspect-square w-full rounded-full border border-black/15 shadow-sm'
                  : 'h-10 rounded-xl border border-black/10'

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onChange(option.value)}
                  className={[
                    'border p-3 text-left transition-all duration-200',
                    dark ? 'bg-white/6 hover:bg-white/10 shadow-none' : 'bg-white/85 hover:bg-white shadow-sm',
                    shapeClass,
                    active ? 'border-[#d4af37] ring-2 ring-[#d4af37]/25' : dark ? 'border-white/10' : 'border-[#e5e7eb]',
                    variant === 'menu' ? 'flex items-center justify-between gap-3 px-4 py-3' : '',
                  ].join(' ')}
                >
                  {variant === 'menu' ? (
                    <>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-[#121212]">{option.label}</div>
                        {option.note && <div className="mt-1 truncate text-xs text-[#6b7280]">{option.note}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {priceLabel && <span className="text-xs font-semibold text-[#14a8f5]">{priceLabel}</span>}
                        <span className={`h-3.5 w-3.5 ${active ? 'rounded-full bg-[#d4af37]' : 'rounded-full bg-[#cbd5e1]'}`} />
                      </div>
                    </>
                  ) : variant === 'text' ? (
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-white">{option.label}</div>
                      <div className="text-xs text-white/55">{option.note}</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div
                        className={previewClass}
                        style={{
                          ...previewStyle,
                          borderColor: dark ? 'rgba(255,255,255,0.12)' : undefined,
                        }}
                      />
                      <div>
                        <div className={`text-sm font-semibold ${dark ? 'text-white' : 'text-[#121212]'}`}>
                          {option.label}
                        </div>
                        <div className={`text-xs ${dark ? 'text-white/60' : 'text-[#6b7280]'}`}>{option.note}</div>
                        {priceLabel && <div className={`mt-1 text-xs font-semibold ${dark ? 'text-[#28b6ff]' : 'text-[#14a8f5]'}`}>{priceLabel}</div>}
                      </div>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
