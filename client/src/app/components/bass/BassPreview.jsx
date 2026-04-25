import { useMemo, useRef } from 'react'
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
      data-export-layer="true"
    />
  )
}

const getBridgeByStrings = (bridgesByModel, bridgeKey, strings = '4') => {
  if (!bridgesByModel) return null
  if (bridgesByModel[bridgeKey]) return bridgesByModel[bridgeKey]
  const wantsFive = String(strings) === '5'
  const fiveCandidates = ['extended5', 'standard5']
  const fourCandidates = ['standard', 'standard4', 'cosmos']
  const candidateKeys = wantsFive ? fiveCandidates : fourCandidates
  return candidateKeys.map(key => bridgesByModel[key]).find(Boolean) ?? Object.values(bridgesByModel)[0] ?? null
}

const getBackplateByStrings = (platesByModel, plateKey, strings = '4') => {
  if (!platesByModel) return null
  if (platesByModel[plateKey]) return platesByModel[plateKey]
  const wantsFive = String(strings) === '5'
  if (wantsFive && platesByModel.extended) return platesByModel.extended
  return platesByModel.standard ?? Object.values(platesByModel)[0] ?? null
}

const resolvePickupLayers = (resolvedConfig) => {
  const strings = resolvedConfig.strings ?? '4'
  const preferStyle = resolvedConfig.pickupTypeStyle ?? 'j'
  const preferBridgeTone = resolvedConfig.pickups === 'active' ? 'creme' : 'black'
  const baseOptions = { strings, preferTokens: [preferStyle, preferBridgeTone] }
  const bridgePickup = bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'pickups', {
    ...baseOptions,
    preferTokens: [preferStyle, 'bridge', preferBridgeTone],
  })
  const neckPickup = bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'pickups', {
    ...baseOptions,
    preferTokens: [preferStyle, 'neck', preferBridgeTone],
  })
  return {
    bridgePickup,
    neckPickup: neckPickup && neckPickup !== bridgePickup ? neckPickup : null,
  }
}

function BassPreview({ config, view, onViewChange }) {
  const previewRef = useRef(null)

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
      strings: config.strings ?? '4',
      pickguard: config.pickguard ?? 'none',
      knobs: config.knobs ?? 'black',
      pickups: config.pickups ?? 'standard',
      pickupTypeStyle: config.pickupTypeStyle ?? 'j',
      pickupConfig: config.pickupConfig ?? 'j',
      bridge: config.bridge ?? 'standard',
      inlays: config.inlays ?? 'pearl',
      headstockStyle: config.headstockStyle ?? 'ch',
      logo: config.logo ?? 'standard',
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
      bodyFinish: resolvedConfig.bodyFinish && typeof resolvedConfig.bodyFinish === 'string' && resolvedConfig.bodyFinish.startsWith('#')
        ? { color: resolvedConfig.bodyFinish, texture: null }
        : bassBuilder.BODY_FINISH_OPTIONS[resolvedConfig.bodyFinish],
      neck: bassBuilder.NECK_OPTIONS[resolvedConfig.neck],
      fretboard: bassBuilder.FRETBOARD_OPTIONS[resolvedConfig.fretboard],
      headstockWood: bassBuilder.HEADSTOCK_WOOD_OPTIONS[resolvedConfig.headstockWood],
      hardware: bassBuilder.HARDWARE_OPTIONS[resolvedConfig.hardware],
      bridge: getBridgeByStrings(
        bassBuilder.BRIDGE_OPTIONS[resolvedConfig.bassType],
        resolvedConfig.bridge,
        resolvedConfig.strings,
      ),
      inlay: bassBuilder.INLAY_OPTIONS[resolvedConfig.inlays],
      backplate: getBackplateByStrings(
        bassBuilder.BACKPLATE_OPTIONS[resolvedConfig.bassType],
        resolvedConfig.backplate,
        resolvedConfig.strings,
      ),
      controlPlate: bassBuilder.CONTROL_PLATE_OPTIONS[resolvedConfig.controlPlate],
      bodyAssets: bassBuilder.BODY_LAYER_ASSETS[resolvedConfig.bassType],
      frontBodyMask: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'front',
        'masks',
        { strings: resolvedConfig.strings, preferTokens: ['bodymask'] },
      ) || bodyModel.bodySrc,
      rearBodyMask: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'back',
        'masks',
        { strings: resolvedConfig.strings, preferTokens: ['bodymask'] },
      ),
      rearNeckMask: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'back',
        'masks',
        { strings: resolvedConfig.strings, preferTokens: ['bodyneckmask', 'neck'] },
      ),
      rearNeckFinish: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'back',
        'shadows_highlights',
        { strings: resolvedConfig.strings, preferTokens: ['multiply'] },
      ),
      rearGloss: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'back',
        'shadows_highlights',
        { strings: resolvedConfig.strings, preferTokens: ['gloss'] },
      ),
      rearStrap: bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType,
        'back',
        'strap buttons/standard',
        resolvedConfig.strings,
        resolvedConfig.hardware,
      ),
      rearStrapLocks: bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType,
        'back',
        'strap buttons/straplocks',
        resolvedConfig.strings,
        resolvedConfig.hardware,
      ),
      rearNeckBolts: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'back',
        'neck bolts',
        { strings: resolvedConfig.strings, preferTokens: ['neck', 'bolts'] },
      ),
      rearFerrules: bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType,
        'back',
        'string ferrules/standard',
        resolvedConfig.strings,
        resolvedConfig.hardware,
      ),
      rearBridge: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType,
        'back',
        'bridges',
        { strings: resolvedConfig.strings, preferTokens: ['standard'] },
      ),
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
    resolvedAssets.pickupLayers = resolvePickupLayers(resolvedConfig)

    if (DEBUG) console.log('[ASSET RESOLUTION]', resolvedAssets)
    return resolvedAssets
  }, [resolvedConfig])

  const colorKey = assets.hardware?.color ?? 'chrome'

  // ===== LAYERED RENDERING SYSTEM =====
  // Front view layers
  const frontLayers = useMemo(() => {
    const layers = []

    // Body + Finish
    if (assets.frontBodyMask) {
      layers.push({
        name: 'body-wood',
        maskSrc: assets.frontBodyMask,
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
        maskSrc: assets.frontBodyMask,
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
        maskSrc: assets.frontBodyMask,
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
    if (assets.pickupLayers?.bridgePickup) {
      layers.push({
        name: 'pickup-bridge',
        src: assets.pickupLayers.bridgePickup,
        style: { zIndex: 11, opacity: 0.9 },
      })
    }
    if (assets.pickupLayers?.neckPickup) {
      layers.push({
        name: 'pickup-neck',
        src: assets.pickupLayers.neckPickup,
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
    const strapSrc = assets.bodyAssets?.front?.strap?.[colorKey]
      || assets.bodyAssets?.front?.strap?.chrome
      || bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType,
        'front',
        'strap buttons/standard',
        resolvedConfig.strings,
        colorKey,
      )
    if (strapSrc) {
      layers.push({
        name: 'strap',
        src: strapSrc,
        style: { zIndex: 15, opacity: 0.95 },
      })
    }

    // Shadow effects - applied last for depth
    const frontShadow = assets.bodyAssets?.front?.shadows || bassBuilder.resolveCatalogAsset(
      resolvedConfig.bassType,
      'front',
      'shadows_highlights',
      { strings: resolvedConfig.strings, preferTokens: ['edge', 'shadow'] },
    )
    if (frontShadow) {
      layers.push({
        name: 'shadows',
        src: frontShadow,
        style: { zIndex: 20, opacity: 1, mixBlendMode: 'multiply' },
      })
    }

    // Gloss/Highlight effects
    const frontGloss = assets.bodyAssets?.front?.gloss || bassBuilder.resolveCatalogAsset(
      resolvedConfig.bassType,
      'front',
      'shadows_highlights',
      { strings: resolvedConfig.strings, preferTokens: ['gloss'] },
    )
    if (frontGloss) {
      layers.push({
        name: 'gloss',
        src: frontGloss,
        style: { zIndex: 21, opacity: 0.9, mixBlendMode: 'screen' },
      })
    }

    if (DEBUG) console.log('[FRONT LAYERS]', layers.map(l => l.name))
    return layers
  }, [assets, colorKey, resolvedConfig.bassType, resolvedConfig.pickguard, resolvedConfig.strings])

  // Rear view layers with strict validation
  const rearLayers = useMemo(() => {
    const layers = []

    // Rear body base - strictly from /back mask
    if (assets.rearBodyMask && assets.bodyWood?.texture) {
      layers.push({
        name: 'rear-body-wood',
        maskSrc: assets.rearBodyMask,
        style: {
          backgroundImage: `url(${assets.bodyWood.texture})`,
          opacity: 1,
          zIndex: 1,
        },
      })
    }

    if (assets.bodyFinish?.texture) {
      layers.push({
        name: 'rear-body-finish-texture',
        maskSrc: assets.rearBodyMask,
        style: {
          backgroundImage: `url(${assets.bodyFinish.texture})`,
          opacity: 1,
          mixBlendMode: 'normal',
          zIndex: 2,
        },
      })
    } else if (assets.bodyFinish?.color) {
      layers.push({
        name: 'rear-body-finish-color',
        maskSrc: assets.rearBodyMask,
        style: {
          backgroundColor: assets.bodyFinish.color,
          opacity: 1,
          zIndex: 2,
        },
      })
    }

    // Rear neck region from /back mask assets
    if (assets.rearNeckMask && assets.neck?.src) {
      layers.push({
        name: 'rear-neck-wood',
        maskSrc: assets.rearNeckMask,
        style: {
          backgroundImage: `url(${assets.neck.src})`,
          filter: assets.neck.filter,
          opacity: 0.98,
          zIndex: 3,
        },
      })
    }

    if (assets.rearNeckMask && assets.rearNeckFinish) {
      layers.push({
        name: 'rear-neck-finish',
        maskSrc: assets.rearNeckMask,
        style: {
          backgroundImage: `url(${assets.rearNeckFinish})`,
          opacity: 0.92,
          mixBlendMode: 'multiply',
          zIndex: 4,
        },
      })
    }

    if (assets.rearNeckBolts) {
      layers.push({
        name: 'rear-neck-bolts',
        src: assets.rearNeckBolts,
        style: { zIndex: 5, opacity: 0.95 },
      })
    }

    if (assets.rearFerrules) {
      layers.push({
        name: 'rear-ferrules',
        src: assets.rearFerrules,
        style: { zIndex: 6, opacity: 0.95 },
      })
    }

    if (assets.rearBridge) {
      layers.push({
        name: 'rear-bridge',
        src: assets.rearBridge,
        style: { zIndex: 7, opacity: 0.95 },
      })
    }

    const isHeadless = resolvedConfig.bassType === 'vader'
    if (isHeadless && assets.bodyAssets?.back?.neckCap) {
      layers.push({
        name: 'rear-neck-cap',
        src: assets.bodyAssets.back.neckCap,
        style: { zIndex: 8, opacity: 0.95 },
      })
    } else if (assets.headstockWood?.texture && assets.rearNeckMask) {
      layers.push({
        name: 'rear-headstock-wood',
        maskSrc: assets.rearNeckMask,
        style: {
          backgroundImage: `url(${assets.headstockWood.texture})`,
          opacity: 0.95,
          zIndex: 8,
        },
      })
    }

    // Backplate
    if (assets.backplate?.src) {
      layers.push({
        name: 'backplate',
        src: assets.backplate.src,
        style: { zIndex: 9, opacity: 0.95 },
      })
    } else if (DEBUG) {
      console.warn('[REAR] Backplate asset missing')
    }

    if (assets.rearStrap) {
      layers.push({
        name: 'rear-strap',
        src: assets.rearStrap,
        style: { zIndex: 10, opacity: 0.95 },
      })
    }

    if (assets.rearStrapLocks) {
      layers.push({
        name: 'rear-straplocks',
        src: assets.rearStrapLocks,
        style: { zIndex: 11, opacity: 0.95 },
      })
    }

    // Shadow effects - rear view
    if (assets.bodyAssets?.back?.shadows || assets.rearNeckFinish) {
      layers.push({
        name: 'rear-shadows',
        src: assets.bodyAssets?.back?.shadows || assets.rearNeckFinish,
        style: { zIndex: 20, opacity: 0.85, mixBlendMode: 'multiply' },
      })
    }

    // Gloss effects - rear view
    if (assets.bodyAssets?.back?.gloss || assets.rearGloss) {
      layers.push({
        name: 'rear-gloss',
        src: assets.bodyAssets?.back?.gloss || assets.rearGloss,
        style: { zIndex: 21, opacity: 0.8, mixBlendMode: 'screen' },
      })
    }

    if (DEBUG) console.log('[REAR LAYERS]', layers.map(l => l.name))
    return layers
  }, [assets, resolvedConfig.bassType])

  // Transform calculations
  const previewLayout = bassBuilder.PREVIEW_LAYOUTS[resolvedConfig.bassType] ?? { scale: 0.93, x: 0, y: 26 }
  const previewScale = view === 'rear' ? previewLayout.scale * 0.98 : previewLayout.scale
  const previewFlip = 'scaleX(1)'

  if (DEBUG && view) {
    console.log(`[VIEW CHANGE] ${view} - scale: ${previewScale}, flip: ${previewFlip}`)
  }

  return (
    <div className="w-full" ref={previewRef}>
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
              data-export-stage="true"
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
