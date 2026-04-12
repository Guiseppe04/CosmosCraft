import { useMemo, useRef, useState } from 'react'
import { CircleDot } from 'lucide-react'
import {
  bassBuilder,
  BASS_NECK_FRETS,
  BASS_NECK_MASK,
  BASS_NECK_NUT,
  resolveBassVariant,
} from '../../lib/bassBuilderData.js'

const DEBUG = true // Toggle for debug logging

const layerStyle = (src, extra = {}) => {
  if (!src) return null
  return {
    backgroundImage: `url(${src})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    ...extra,
  }
}

const maskedLayerStyle = (maskSrc, extra = {}) => {
  if (!maskSrc) return null
  return {
    backgroundColor: 'transparent',
    WebkitMaskImage: `url(${maskSrc})`,
    maskImage: `url(${maskSrc})`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    ...extra,
  }
}

function BassLayer({ src, maskSrc, style, className = '', layerName = '' }) {
  // STRICT VALIDATION: Ensure source exists
  if (!src && !maskSrc) {
    if (DEBUG) console.warn(`[BassLayer] Missing source for ${layerName}`)
    return null
  }

  const computedStyle = maskSrc ? maskedLayerStyle(maskSrc, style) : layerStyle(src, style)
  
  // If style computation failed, don't render
  if (!computedStyle) return null

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 pointer-events-none select-none ${className}`}
      style={computedStyle}
      data-layer={layerName}
    />
  )
}

function BassPreview({ config, view, onViewChange }) {
  const previewRef = useRef(null)
  const [renderDebug, setRenderDebug] = useState(DEBUG)

  // ===== CONFIG VALIDATION & RESOLUTION =====
  const resolvedConfig = useMemo(() => {
    const resolved = {
      bassType: config.bassType ?? 'vader',
      bodyWood: config.bodyWood ?? 'maple',
      bodyFinish: config.bodyFinish ?? 'none',
      neck: config.neck ?? 'maple',
      fretboard: config.fretboard ?? 'rosewood',
      headstockWood: config.headstockWood ?? 'maple',
      hardware: config.hardware ?? 'chrome',
      pickguard: config.pickguard ?? 'none',
      knobs: config.knobs ?? 'black',
      pickups: config.pickups ?? 'standard',
      bridge: config.bridge ?? 'standard',
      inlays: config.inlays ?? 'pearl',
      backplate: config.backplate ?? 'standard',
      pickupScrews: config.pickupScrews ?? 'black',
      controlPlate: config.controlPlate ?? 'black',
    }
    
    if (DEBUG) console.log('[RESOLVED CONFIG]', resolved)
    return resolved
  }, [config])

  // ===== ASSET RESOLUTION WITH VALIDATION =====
  const assets = useMemo(() => {
    const bodyModel = bassBuilder.BODY_OPTIONS[resolvedConfig.bassType]
    if (!bodyModel) {
      console.error(`[ASSET ERROR] Body model not found: ${resolvedConfig.bassType}`)
      return {}
    }

    const resolvedAssets = {
      bodyModel,
      bodyWood: bassBuilder.BODY_WOOD_OPTIONS[resolvedConfig.bodyWood],
      bodyFinish: bassBuilder.BODY_FINISH_OPTIONS[resolvedConfig.bodyFinish],
      neck: bassBuilder.NECK_OPTIONS[resolvedConfig.neck],
      fretboard: bassBuilder.FRETBOARD_OPTIONS[resolvedConfig.fretboard],
      headstockWood: bassBuilder.HEADSTOCK_WOOD_OPTIONS[resolvedConfig.headstockWood],
      hardware: bassBuilder.HARDWARE_OPTIONS[resolvedConfig.hardware],
      bridge: bassBuilder.BRIDGE_OPTIONS[resolvedConfig.bassType]?.[resolvedConfig.bridge],
      inlay: bassBuilder.INLAY_OPTIONS[resolvedConfig.inlays],
      backplate: bassBuilder.BACKPLATE_OPTIONS[resolvedConfig.backplate],
      controlPlate: bassBuilder.CONTROL_PLATE_OPTIONS[resolvedConfig.controlPlate],
      bodyAssets: bassBuilder.BODY_LAYER_ASSETS[resolvedConfig.bassType],
    }

    // Validate model-specific options
    const pickguardsByModel = bassBuilder.PICKGUARD_OPTIONS[resolvedConfig.bassType]
    if (pickguardsByModel) {
      resolvedAssets.pickguard = pickguardsByModel[resolvedConfig.pickguard]
    }

    const knobsByModel = bassBuilder.KNOB_OPTIONS[resolvedConfig.bassType]
    if (knobsByModel) {
      resolvedAssets.knobs = knobsByModel[resolvedConfig.knobs]
    }

    const logosByModel = bassBuilder.LOGO_OPTIONS[resolvedConfig.bassType]
    if (logosByModel) {
      resolvedAssets.logo = logosByModel[resolvedConfig.logo]
    }

    const pickupScrewsByModel = bassBuilder.PICKUP_SCREW_OPTIONS[resolvedConfig.bassType]
    if (pickupScrewsByModel) {
      resolvedAssets.pickupScrews = pickupScrewsByModel[resolvedConfig.pickupScrews]
    }

    if (DEBUG) console.log('[ASSET RESOLUTION]', resolvedAssets)
    return resolvedAssets
  }, [resolvedConfig])

  const colorKey = assets.hardware?.color ?? 'chrome'

  // ===== LAYERED RENDERING SYSTEM =====
  // Front view layers
  const frontLayers = useMemo(() => {
    const layers = []

    // Body + Finish
    if (assets.bodyModel?.bodySrc) {
      layers.push({
        name: 'body-wood',
        maskSrc: assets.bodyModel.bodySrc,
        style: {
          backgroundImage: assets.bodyWood?.texture ? `url(${assets.bodyWood.texture})` : undefined,
          opacity: 1,
          mixBlendMode: 'normal',
          zIndex: 1,
        },
      })
    }

    if (assets.bodyFinish?.texture) {
      layers.push({
        name: 'body-finish-texture',
        maskSrc: assets.bodyModel?.bodySrc,
        style: {
          backgroundImage: `url(${assets.bodyFinish.texture})`,
          opacity: 1,
          mixBlendMode: 'normal',
          zIndex: 2,
        },
      })
    } else if (assets.bodyFinish?.color) {
      layers.push({
        name: 'body-finish-color',
        maskSrc: assets.bodyModel?.bodySrc,
        style: {
          backgroundColor: assets.bodyFinish.color,
          opacity: 1,
          zIndex: 2,
        },
      })
    }

    // Neck + Fretboard
    if (assets.neck?.src && BASS_NECK_MASK) {
      layers.push({
        name: 'neck',
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${assets.neck.src})`,
          filter: assets.neck.filter,
          opacity: 0.98,
          zIndex: 3,
        },
      })
    }

    if (assets.fretboard?.src && BASS_NECK_MASK) {
      layers.push({
        name: 'fretboard',
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${assets.fretboard.src})`,
          opacity: 0.94,
          mixBlendMode: 'multiply',
          zIndex: 4,
        },
      })
    }

    // Frets
    if (BASS_NECK_FRETS.stainless) {
      layers.push({
        name: 'frets',
        src: BASS_NECK_FRETS.stainless,
        style: { zIndex: 5, opacity: 0.85 },
      })
    }

    // Inlays - CRITICAL FIX: Only render if exists
    if (assets.inlay?.src) {
      layers.push({
        name: 'inlays',
        src: assets.inlay.src,
        style: { zIndex: 6, opacity: 1, filter: 'brightness(1.15) contrast(1.1)' },
      })
    } else if (DEBUG) {
      console.warn('[INLAY] Missing inlay asset')
    }

    // Nut
    const nutColor = colorKey === 'black' ? 'black' : 'white'
    if (BASS_NECK_NUT[nutColor]) {
      layers.push({
        name: 'nut',
        src: BASS_NECK_NUT[nutColor],
        style: { zIndex: 7, opacity: 0.9 },
      })
    }

    // Headstock wood
    if (assets.headstockWood?.texture && BASS_NECK_MASK) {
      layers.push({
        name: 'headstock-wood',
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${assets.headstockWood.texture})`,
          opacity: 0.95,
          zIndex: 8,
        },
      })
    } else if (DEBUG) {
      console.warn('[HEADSTOCK] Missing headstock asset')
    }

    // Logo - Removed as per instructions
    // if (assets.logo?.src) {
    //   layers.push({
    //     name: 'logo',
    //     src: assets.logo.src,
    //     style: { zIndex: 8.5, opacity: 0.95 },
    //   })
    // }

    // Pickguard - directly on body
    if (resolvedConfig.pickguard !== 'none' && assets.pickguard?.src) {
      layers.push({
        name: 'pickguard',
        src: assets.pickguard.src,
        style: { zIndex: 9, opacity: 0.95 },
      })
    } else if (resolvedConfig.pickguard !== 'none' && DEBUG) {
      console.warn(`[PICKGUARD] Asset not found for ${resolvedConfig.pickguard}`)
    }

    // Pickup screws
    if (resolvedConfig.pickguard !== 'none' && assets.pickupScrews?.src) {
      layers.push({
        name: 'pickup-screws',
        src: assets.pickupScrews.src,
        style: { zIndex: 10, opacity: 0.9 },
      })
    }

    // Pickups
    if (assets.bodyAssets?.pickups) {
      layers.push({
        name: 'pickups',
        src: assets.bodyAssets.pickups,
        style: { zIndex: 11, opacity: 0.9 },
      })
    }

    // Control plate - under the knobs, on top of pickguard, only for JB
    if (resolvedConfig.bassType === 'jb' && assets.controlPlate?.src) {
      layers.push({
        name: 'control-plate',
        src: assets.controlPlate.src,
        style: { zIndex: 12, opacity: 0.9 },
      })
    }

    // Knobs - above pickguard/control plate
    if (assets.knobs?.src) {
      layers.push({
        name: 'knobs',
        src: assets.knobs.src,
        style: { zIndex: 13, opacity: 0.95 },
      })
    }

    // Bridge and Strings - TOPMOST over pickguard, pickups, knobs
    const bridgeSrc = resolveBassVariant(assets.bridge?.assets, colorKey)
    if (bridgeSrc) {
      layers.push({
        name: 'bridge',
        src: bridgeSrc,
        style: { zIndex: 14, opacity: 0.95 },
      })
    }

    // Strap/Buttons
    const strapSrc = resolveBassVariant(assets.bodyAssets?.strap, colorKey)
    if (strapSrc) {
      layers.push({
        name: 'strap',
        src: strapSrc,
        style: { zIndex: 15, opacity: 0.95 },
      })
    }

    // Shadow effects - applied last for depth
    if (assets.bodyAssets?.shadows) {
      layers.push({
        name: 'shadows',
        src: assets.bodyAssets.shadows,
        style: { zIndex: 20, opacity: 1, mixBlendMode: 'multiply' },
      })
    }

    // Gloss/Highlight effects
    if (assets.bodyAssets?.gloss) {
      layers.push({
        name: 'gloss',
        src: assets.bodyAssets.gloss,
        style: { zIndex: 21, opacity: 0.9, mixBlendMode: 'screen' },
      })
    }

    if (DEBUG) console.log('[FRONT LAYERS]', layers.map(l => l.name))
    return layers
  }, [assets, colorKey, resolvedConfig.pickguard])

  // Rear view layers with strict validation
  const rearLayers = useMemo(() => {
    const layers = []

    // Body base
    if (assets.bodyModel?.bodySrc && assets.bodyWood?.texture) {
      layers.push({
        name: 'rear-body',
        maskSrc: assets.bodyModel.bodySrc,
        style: {
          backgroundImage: `url(${assets.bodyWood.texture})`,
          opacity: 1,
          zIndex: 1,
        },
      })
    }

    // Neck - rear view
    if (assets.neck?.src && BASS_NECK_MASK) {
      layers.push({
        name: 'rear-neck',
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${assets.neck.src})`,
          filter: assets.neck.filter,
          opacity: 0.98,
          zIndex: 2,
        },
      })
    }

    // Fretboard - rear view
    if (assets.fretboard?.src && BASS_NECK_MASK) {
      layers.push({
        name: 'rear-fretboard',
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${assets.fretboard.src})`,
          opacity: 0.94,
          mixBlendMode: 'multiply',
          zIndex: 3,
        },
      })
    }

    // Headstock wood - rear view
    if (assets.headstockWood?.texture && BASS_NECK_MASK) {
      layers.push({
        name: 'rear-headstock-wood',
        maskSrc: BASS_NECK_MASK,
        style: {
          backgroundImage: `url(${assets.headstockWood.texture})`,
          opacity: 0.95,
          zIndex: 4,
        },
      })
    }

    // Backplate
    if (assets.backplate?.src) {
      layers.push({
        name: 'backplate',
        src: assets.backplate.src,
        style: { zIndex: 5, opacity: 0.95 },
      })
    } else if (DEBUG) {
      console.warn('[REAR] Backplate asset missing')
    }

    // Shadow effects - rear view
    if (assets.bodyAssets?.shadows) {
      layers.push({
        name: 'rear-shadows',
        src: assets.bodyAssets.shadows,
        style: { zIndex: 20, opacity: 0.6, mixBlendMode: 'multiply' },
      })
    }

    // Gloss effects - rear view
    if (assets.bodyAssets?.gloss) {
      layers.push({
        name: 'rear-gloss',
        src: assets.bodyAssets.gloss,
        style: { zIndex: 21, opacity: 0.7, mixBlendMode: 'screen' },
      })
    }

    if (DEBUG) console.log('[REAR LAYERS]', layers.map(l => l.name))
    return layers
  }, [assets])

  // Transform calculations
  const previewLayout = bassBuilder.PREVIEW_LAYOUTS[resolvedConfig.bassType] ?? { scale: 0.93, x: 0, y: 26 }
  const previewScale = view === 'rear' ? previewLayout.scale * 0.98 : previewLayout.scale
  const previewFlip = view === 'rear' ? 'scaleX(-1)' : 'scaleX(1)'

  if (DEBUG && view) {
    console.log(`[VIEW CHANGE] ${view} - scale: ${previewScale}, flip: ${previewFlip}`)
  }

  return (
    <div className="w-full" ref={previewRef}>
      {/* DEBUG OVERLAY */}
      {renderDebug && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.8)',
            color: '#0f0',
            padding: '8px',
            fontSize: '11px',
            fontFamily: 'monospace',
            maxWidth: '250px',
            maxHeight: '200px',
            overflow: 'auto',
            borderRadius: '4px',
          }}
        >
          <div>VIEW: {view}</div>
          <div>BASS: {resolvedConfig.bassType}</div>
          <div>PICKGUARD: {resolvedConfig.pickguard}</div>
          <div>FINISH: {resolvedConfig.bodyFinish}</div>
          <div onClick={() => setRenderDebug(false)} style={{ cursor: 'pointer', marginTop: '4px', color: '#f00' }}>
            [close]
          </div>
        </div>
      )}

      <div className="relative mx-auto w-full">
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a1a] via-[#0f0f0f] to-[#0a0a0a]" />

          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-radial from-white/10 via-transparent to-transparent opacity-40" />
            <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-gradient-radial from-[#d4af37]/5 via-transparent to-transparent opacity-50" />
            <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-gradient-radial from-white/5 via-transparent to-transparent opacity-30" />
          </div>

          <div className="relative flex items-center justify-center py-8">
            <div
              className="relative aspect-[16/7] w-full max-w-[1000px] transition-transform duration-500 ease-out"
              style={{
                transform: `translate(${previewLayout.x}px, ${previewLayout.y}px) scale(${previewScale}) ${previewFlip}`,
                transformOrigin: '50% 50%',
              }}
            >
              {/* FRONT VIEW */}
              {view === 'front' &&
                frontLayers.map((layer) => (
                  <BassLayer
                    key={layer.name}
                    src={layer.src ?? undefined}
                    maskSrc={layer.maskSrc ?? undefined}
                    style={layer.style}
                    layerName={layer.name}
                  />
                ))}

              {/* REAR VIEW */}
              {view === 'rear' &&
                rearLayers.map((layer) => (
                  <BassLayer
                    key={layer.name}
                    src={layer.src ?? undefined}
                    maskSrc={layer.maskSrc ?? undefined}
                    style={layer.style}
                    layerName={layer.name}
                  />
                ))}
            </div>
          </div>

          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-6 bg-gradient-to-b from-transparent via-black/30 to-black/50 blur-xl" />
        </div>
      </div>
    </div>
  )
}

export default BassPreview