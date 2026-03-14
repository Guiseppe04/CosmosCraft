import { ChevronDown } from 'lucide-react'

export function CustomizationPanel({ config, setConfig }) {
  const colorPresets = [
    { name: 'Black', value: '#1a1a1a' },
    { name: 'White', value: '#f5f5f5' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Gold', value: '#d4af37' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Orange', value: '#ea580c' },
  ]

  return (
    <div className="bg-[var(--surface-dark)] border border-[var(--border)] rounded-xl p-6 space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
      <h2 className="text-xl font-semibold text-[var(--gold-primary)]">Customization Options</h2>

      {/* Guitar Type */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--text-light)]">Guitar Type</label>
        <div className="relative">
          <select
            value={config.type}
            onChange={e => setConfig({ ...config, type: e.target.value })}
            className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
          >
            <option value="acoustic">Acoustic</option>
            <option value="electric">Electric</option>
            <option value="bass">Bass</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Body Shape */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--text-light)]">Body Shape</label>
        <div className="relative">
          <select
            value={config.bodyShape}
            onChange={e => setConfig({ ...config, bodyShape: e.target.value })}
            className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
          >
            {config.type === 'electric' && (
              <>
                <option value="stratocaster">Stratocaster</option>
                <option value="telecaster">Telecaster</option>
                <option value="les-paul">Les Paul</option>
                <option value="sg">SG</option>
              </>
            )}
            {config.type === 'acoustic' && (
              <>
                <option value="dreadnought">Dreadnought</option>
                <option value="parlor">Parlor</option>
                <option value="jumbo">Jumbo</option>
              </>
            )}
            {config.type === 'bass' && (
              <>
                <option value="p-bass">P-Bass</option>
                <option value="j-bass">J-Bass</option>
                <option value="5-string">5-String</option>
              </>
            )}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Color Mode */}
      <div className="space-y-2">
        <label className="text-sm text-[var(--text-light)]">Color Configuration</label>
        <div className="grid grid-cols-3 gap-2">
          {['single', 'two-tone', 'three-tone'].map(mode => (
            <button
              key={mode}
              onClick={() => setConfig({ ...config, colorMode: mode })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                config.colorMode === mode
                  ? 'bg-[var(--gold-primary)] text-[var(--text-dark)]'
                  : 'bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-light)] border border-[var(--border)]'
              }`}
            >
              {mode === 'single' ? 'Single' : mode === 'two-tone' ? 'Two Tone' : 'Three Tone'}
            </button>
          ))}
        </div>
      </div>

      {/* Color Swatches */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-[var(--text-light)]">Primary Color</label>
          <div className="grid grid-cols-4 gap-2">
            {colorPresets.map(color => (
              <button
                key={color.value}
                onClick={() => setConfig({ ...config, primaryColor: color.value })}
                className={`w-full aspect-square rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                  config.primaryColor === color.value
                    ? 'border-[var(--gold-primary)] ring-2 ring-[var(--gold-primary)]/30'
                    : 'border-[var(--border)]'
                }`}
                style={{ backgroundColor: color.value }}
                title={color.name}
              />
            ))}
          </div>
        </div>

        {config.colorMode !== 'single' && (
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-light)]">Secondary Color</label>
            <div className="grid grid-cols-4 gap-2">
              {colorPresets.map(color => (
                <button
                  key={color.value}
                  onClick={() => setConfig({ ...config, secondaryColor: color.value })}
                  className={`w-full aspect-square rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                    config.secondaryColor === color.value
                      ? 'border-[var(--gold-primary)] ring-2 ring-[var(--gold-primary)]/30'
                      : 'border-[var(--border)]'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}

        {config.colorMode === 'three-tone' && (
          <div className="space-y-2">
            <label className="text-sm text-[var(--text-light)]">Tertiary Color</label>
            <div className="grid grid-cols-4 gap-2">
              {colorPresets.map(color => (
                <button
                  key={color.value}
                  onClick={() => setConfig({ ...config, tertiaryColor: color.value })}
                  className={`w-full aspect-square rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
                    config.tertiaryColor === color.value
                      ? 'border-[var(--gold-primary)] ring-2 ring-[var(--gold-primary)]/30'
                      : 'border-[var(--border)]'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hardware */}
      {config.type !== 'acoustic' && (
        <div className="space-y-4 pt-4 border-t border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--gold-primary)]">Hardware</h3>

          <div className="space-y-2">
            <label className="text-sm text-[var(--text-light)]">Pickups</label>
            <div className="relative">
              <select
                value={config.hardware.pickups}
                onChange={e =>
                  setConfig({
                    ...config,
                    hardware: { ...config.hardware, pickups: e.target.value },
                  })
                }
                className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
              >
                <option value="single-coil">Single Coil</option>
                <option value="humbucker">Humbucker</option>
                <option value="active">Active Pickups</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[var(--text-light)]">Bridge</label>
            <div className="relative">
              <select
                value={config.hardware.bridge}
                onChange={e =>
                  setConfig({
                    ...config,
                    hardware: { ...config.hardware, bridge: e.target.value },
                  })
                }
                className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
              >
                <option value="hardtail">Hardtail</option>
                <option value="tremolo">Tremolo</option>
                <option value="floyd-rose">Floyd Rose</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[var(--text-light)]">Tuners</label>
            <div className="relative">
              <select
                value={config.hardware.tuners}
                onChange={e =>
                  setConfig({
                    ...config,
                    hardware: { ...config.hardware, tuners: e.target.value },
                  })
                }
                className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
              >
                <option value="standard">Standard</option>
                <option value="locking">Locking Tuners</option>
                <option value="vintage">Vintage Style</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-[var(--text-light)]">Knobs</label>
            <div className="relative">
              <select
                value={config.hardware.knobs}
                onChange={e =>
                  setConfig({
                    ...config,
                    hardware: { ...config.hardware, knobs: e.target.value },
                  })
                }
                className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] text-[var(--text-light)] border border-[var(--border)] rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--gold-primary)] transition-all duration-200"
              >
                <option value="chrome">Chrome</option>
                <option value="gold">Gold</option>
                <option value="black">Black</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

