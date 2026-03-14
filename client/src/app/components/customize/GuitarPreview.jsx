import { motion } from 'motion/react'

export function GuitarPreview({ config }) {
  const getGradient = () => {
    if (config.colorMode === 'single') {
      return config.primaryColor
    } else if (config.colorMode === 'two-tone') {
      return `linear-gradient(135deg, ${config.primaryColor} 50%, ${config.secondaryColor} 50%)`
    }
    return `linear-gradient(135deg, ${config.primaryColor} 33%, ${config.secondaryColor} 33%, ${config.secondaryColor} 66%, ${config.tertiaryColor} 66%)`
  }

  return (
    <div className="relative w-full max-w-md aspect-[3/4]">
      <motion.div
        key={JSON.stringify(config)}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="relative w-full h-full"
      >
        {/* Electric */}
        {config.type === 'electric' && (
          <svg viewBox="0 0 300 500" className="w-full h-full drop-shadow-2xl">
            <path
              d="M 150 100 Q 100 120 80 180 Q 60 240 80 300 Q 100 360 150 380 Q 200 360 220 300 Q 240 240 220 180 Q 200 120 150 100"
              fill={config.primaryColor}
              stroke="#000"
              strokeWidth="2"
              style={{ background: getGradient() }}
            />
            {config.colorMode !== 'single' && (
              <path
                d="M 150 100 Q 200 120 220 180 Q 240 240 220 300 Q 200 360 150 380 L 150 100"
                fill={config.secondaryColor}
                stroke="#000"
                strokeWidth="2"
              />
            )}
            {config.colorMode === 'three-tone' && (
              <ellipse
                cx="150"
                cy="240"
                rx="50"
                ry="80"
                fill={config.tertiaryColor}
                stroke="#000"
                strokeWidth="1"
              />
            )}
            <rect x="135" y="0" width="30" height="110" fill="#3B2414" stroke="#000" strokeWidth="2" rx="4" />
            <rect x="138" y="0" width="24" height="110" fill="#1a0f08" />
            {[10, 25, 40, 55, 70, 85, 100].map((y, i) => (
              <line key={i} x1="138" y1={y} x2="162" y2={y} stroke="#888" strokeWidth="1" />
            ))}
            <path d="M 140 0 L 135 -30 L 165 -30 L 160 0" fill="#3B2414" stroke="#000" strokeWidth="2" />
            {[0, 1, 2].map(i => (
              <circle
                key={`l-${i}`}
                cx="130"
                cy={-25 + i * 10}
                r="3"
                fill={config.hardware.knobs}
                stroke="#000"
                strokeWidth="1"
              />
            ))}
            {[0, 1, 2].map(i => (
              <circle
                key={`r-${i}`}
                cx="170"
                cy={-25 + i * 10}
                r="3"
                fill={config.hardware.knobs}
                stroke="#000"
                strokeWidth="1"
              />
            ))}
            {config.hardware.pickups === 'humbucker' && (
              <>
                <rect x="130" y="200" width="40" height="20" fill="#1a1a1a" stroke="#000" strokeWidth="1" rx="2" />
                <rect x="130" y="280" width="40" height="20" fill="#1a1a1a" stroke="#000" strokeWidth="1" rx="2" />
              </>
            )}
            {config.hardware.pickups === 'single-coil' && (
              <>
                <rect x="140" y="200" width="20" height="15" fill="#f5f5f5" stroke="#000" strokeWidth="1" rx="2" />
                <rect x="140" y="240" width="20" height="15" fill="#f5f5f5" stroke="#000" strokeWidth="1" rx="2" />
                <rect x="140" y="280" width="20" height="15" fill="#f5f5f5" stroke="#000" strokeWidth="1" rx="2" />
              </>
            )}
            {config.hardware.pickups === 'active' && (
              <>
                <rect x="130" y="200" width="40" height="20" fill="#2a2a2a" stroke="#000" strokeWidth="1" rx="2" />
                <rect x="130" y="280" width="40" height="20" fill="#2a2a2a" stroke="#000" strokeWidth="1" rx="2" />
                <circle cx="150" cy="210" r="2" fill="#dc2626" />
                <circle cx="150" cy="290" r="2" fill="#dc2626" />
              </>
            )}
            <rect
              x="120"
              y="340"
              width="60"
              height="12"
              fill={config.hardware.knobs}
              stroke="#000"
              strokeWidth="1"
              rx="2"
            />
            {config.hardware.bridge === 'tremolo' && (
              <rect
                x="140"
                y="355"
                width="20"
                height="20"
                fill={config.hardware.knobs}
                stroke="#000"
                strokeWidth="1"
                rx="2"
              />
            )}
            {config.hardware.bridge === 'floyd-rose' && (
              <>
                <rect
                  x="135"
                  y="355"
                  width="30"
                  height="25"
                  fill={config.hardware.knobs}
                  stroke="#000"
                  strokeWidth="1"
                  rx="2"
                />
                <line x1="135" y1="365" x2="165" y2="365" stroke="#000" strokeWidth="1" />
              </>
            )}
            <circle cx="180" cy="320" r="8" fill={config.hardware.knobs} stroke="#000" strokeWidth="1" />
            <circle cx="180" cy="345" r="8" fill={config.hardware.knobs} stroke="#000" strokeWidth="1" />
            {[0, 1, 2, 3, 4, 5].map(i => {
              const x = 140 + i * 4
              return (
                <line
                  key={i}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="350"
                  stroke="#ddd"
                  strokeWidth="0.5"
                  opacity="0.6"
                />
              )
            })}
          </svg>
        )}

        {/* Acoustic */}
        {config.type === 'acoustic' && (
          <svg viewBox="0 0 300 500" className="w-full h-full drop-shadow-2xl">
            <ellipse
              cx="150"
              cy="280"
              rx="90"
              ry="110"
              fill={config.primaryColor}
              stroke="#000"
              strokeWidth="2"
            />
            {config.colorMode !== 'single' && (
              <path
                d="M 150 170 Q 240 280 150 390 Z"
                fill={config.secondaryColor}
                stroke="#000"
                strokeWidth="2"
              />
            )}
            <circle cx="150" cy="250" r="30" fill="#000" stroke="#3B2414" strokeWidth="3" />
            <circle cx="150" cy="250" r="35" fill="none" stroke="#3B2414" strokeWidth="1" />
            <rect x="135" y="0" width="30" height="180" fill="#3B2414" stroke="#000" strokeWidth="2" rx="4" />
            <rect x="138" y="0" width="24" height="180" fill="#1a0f08" />
            {[10, 30, 50, 70, 90, 110, 130, 150, 170].map((y, i) => (
              <line key={i} x1="138" y1={y} x2="162" y2={y} stroke="#888" strokeWidth="1" />
            ))}
            <path d="M 140 0 L 135 -35 L 165 -35 L 160 0" fill="#3B2414" stroke="#000" strokeWidth="2" />
            {[0, 1, 2].map(i => (
              <circle key={`la-${i}`} cx="128" cy={-30 + i * 12} r="3" fill="#D4AF37" stroke="#000" strokeWidth="1" />
            ))}
            {[0, 1, 2].map(i => (
              <circle key={`ra-${i}`} cx="172" cy={-30 + i * 12} r="3" fill="#D4AF37" stroke="#000" strokeWidth="1" />
            ))}
            <rect x="120" y="350" width="60" height="8" fill="#3B2414" stroke="#000" strokeWidth="1" rx="1" />
            {[0, 1, 2, 3, 4, 5].map(i => {
              const x = 140 + i * 4
              return (
                <line
                  key={i}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="358"
                  stroke="#ddd"
                  strokeWidth="0.5"
                  opacity="0.6"
                />
              )
            })}
          </svg>
        )}

        {/* Bass */}
        {config.type === 'bass' && (
          <svg viewBox="0 0 300 500" className="w-full h-full drop-shadow-2xl">
            <path
              d="M 140 120 Q 90 150 75 220 Q 60 290 85 340 Q 110 380 160 385 Q 210 380 235 340 Q 260 290 245 220 Q 230 150 180 120"
              fill={config.primaryColor}
              stroke="#000"
              strokeWidth="2"
            />
            {config.colorMode !== 'single' && (
              <path
                d="M 160 120 Q 230 150 245 220 Q 260 290 235 340 Q 210 380 160 385 L 160 120"
                fill={config.secondaryColor}
                stroke="#000"
                strokeWidth="2"
              />
            )}
            <rect x="145" y="0" width="30" height="130" fill="#3B2414" stroke="#000" strokeWidth="2" rx="4" />
            <rect x="148" y="0" width="24" height="130" fill="#1a0f08" />
            {[10, 30, 50, 70, 90, 110].map((y, i) => (
              <line key={i} x1="148" y1={y} x2="172" y2={y} stroke="#888" strokeWidth="1" />
            ))}
            <path d="M 148 0 L 143 -40 L 177 -40 L 172 0" fill="#3B2414" stroke="#000" strokeWidth="2" />
            {[0, 1, 2, 3].map(i => (
              <circle
                key={`peg-${i}`}
                cx="135"
                cy={-35 + i * 10}
                r="4"
                fill={config.hardware.knobs}
                stroke="#000"
                strokeWidth="1"
              />
            ))}
            <rect x="130" y="240" width="60" height="22" fill="#1a1a1a" stroke="#000" strokeWidth="1" rx="2" />
            <rect x="130" y="300" width="60" height="22" fill="#1a1a1a" stroke="#000" strokeWidth="1" rx="2" />
            <rect x="130" y="360" width="60" height="15" fill={config.hardware.knobs} stroke="#000" strokeWidth="1" rx="2" />
            <circle cx="200" cy="320" r="9" fill={config.hardware.knobs} stroke="#000" strokeWidth="1" />
            <circle cx="200" cy="345" r="9" fill={config.hardware.knobs} stroke="#000" strokeWidth="1" />
            {[0, 1, 2, 3].map(i => {
              const x = 152 + i * 5
              return (
                <line
                  key={i}
                  x1={x}
                  y1="0"
                  x2={x}
                  y2="370"
                  stroke="#ddd"
                  strokeWidth="0.8"
                  opacity="0.6"
                />
              )
            })}
          </svg>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-[var(--gold-primary)]/10 to-transparent rounded-xl pointer-events-none" />
      </motion.div>
      <p className="text-center mt-4 text-sm text-[var(--text-muted)]">
        {config.type.charAt(0).toUpperCase() + config.type.slice(1)} Guitar - {config.bodyShape}
      </p>
    </div>
  )
}

