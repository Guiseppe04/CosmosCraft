import { useEffect, useMemo, useRef } from 'react'
import { CircleDot } from 'lucide-react'
import {
  bassBuilder,
  BASS_NECK_FRETS,
  BASS_NECK_MASK,
  BASS_NECK_NUT,
  bassAsset,
  resolveBassVariant,
} from '../../lib/bassBuilderData.js'

const DEBUG = Boolean(import.meta.env.DEV)

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
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    WebkitMaskImage: `url(${maskSrc})`,
    maskImage: `url(${maskSrc})`,
    // Force alpha-based masking so preview matches export's destination-in alpha behavior.
    WebkitMaskMode: 'alpha',
    maskMode: 'alpha',
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
      data-layer-src={src || ''}
      data-layer-mask={maskSrc || ''}
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
  const sharedBase = {
    strings,
    requiredTokens: ['pickups', 'bass'],
    rejectTokens: ['mask'],
    preferTokens: [preferStyle, preferBridgeTone],
  }

  const sharedBridgePickup = bassBuilder.resolveSharedAsset('pickups/bass', {
    ...sharedBase,
    preferTokens: [preferStyle, 'bridge', preferBridgeTone],
  })
  const sharedNeckPickup = bassBuilder.resolveSharedAsset('pickups/bass', {
    ...sharedBase,
    preferTokens: [preferStyle, 'neck', preferBridgeTone],
  })

  const baseOptions = { strings, preferTokens: [preferStyle, preferBridgeTone] }
  const bridgePickup = sharedBridgePickup || bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'pickups', {
    ...baseOptions,
    preferTokens: [preferStyle, 'bridge', preferBridgeTone],
  })
  const neckPickup = sharedNeckPickup || bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'pickups', {
    ...baseOptions,
    preferTokens: [preferStyle, 'neck', preferBridgeTone],
  })
  return {
    bridgePickup,
    neckPickup: neckPickup && neckPickup !== bridgePickup ? neckPickup : null,
  }
}

const resolveHeadstockStyleForStrings = (headstockStyle, strings = '4') => {
  const rawStyle = String(headstockStyle || 'ch').trim().toLowerCase()
  const styleAliases = {
    classic: 'ch',
    standard: 'ch',
    'classic-headstock': 'ch',
    'classic reverse': 'chr',
    'classic-reverse': 'chr',
    classicreverse: 'chr',
    'gt-4': 'gt4',
    'gt-4r': 'gt4r',
    'gt4-reverse': 'gt4r',
    gt4reverse: 'gt4r',
    hl: 'headless',
  }
  const style = styleAliases[rawStyle] || rawStyle
  const wantsFive = String(strings) === '5'
  if (style === 'headless') return 'headless'
  if (!wantsFive) return style

  if (style === 'gt4') return 'gt5'
  if (style === 'gt4r') return 'gt5r'
  return style
}

function BassPreview({ config, view, onViewChange, modelImageSrc }) {
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

    const isFiveString = String(resolvedConfig.strings) === '5'
    const normalizedHeadstockStyle = String(resolvedConfig.headstockStyle || 'ch').trim().toLowerCase()
    const preferredRearNeckMaskToken = isFiveString ? '22f' : '20f'
    const effectiveHeadstockStyle = resolveHeadstockStyleForStrings(normalizedHeadstockStyle, resolvedConfig.strings)
    const isHeadless = effectiveHeadstockStyle === 'headless' || resolvedConfig.bassType === 'vader'
    const preferredFrontFretToken = isHeadless ? '24-fret' : (isFiveString ? '22-fret' : '20-fret')
    const preferredFrontProfileToken = isHeadless ? 'flat-bottom' : 'round-bottom'
    const stringCountToken = `${resolvedConfig.strings}-string`
    const headstockBasePath = `all-models/headstocks/bass/${stringCountToken}`
    const validHeadstockStyles = new Set(['ch', 'chr', 'gt4', 'gt4r', 'gt5', 'gt5r'])
    const canUseDirectHeadstockPaths = validHeadstockStyles.has(effectiveHeadstockStyle)
    const exactStyleFileToken = `/${effectiveHeadstockStyle}.png`
    const exactStyleFolderToken = `/${effectiveHeadstockStyle}/`
    const resolvedHeadstockMask = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/${effectiveHeadstockStyle}/masks/mask.png`)
      : null
    const resolvedHeadstockTuners = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/${effectiveHeadstockStyle}/tuners/${resolvedConfig.hardware}.png`)
      : null
    const resolvedHeadstockLogo = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/${effectiveHeadstockStyle}/logos/bl.png`)
      : null
    const resolvedHeadstockStrings = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/string-overlays/${effectiveHeadstockStyle}.png`)
      : null

    const headlessInlayPreset = {
      whiteDots: { family: 'id', material: 'white-pearl' },
      luminlay: { family: 'id', material: 'luminlay' },
      blackDots: { family: 'ib', material: 'white-pearl' },
      diamondLuminlay: { family: 'idia', material: 'luminlay' },
      diamondWhite: { family: 'idia', material: 'white-pearl' },
    }[resolvedConfig.inlays]

    const resolvedAssets = {
      bodyModel,
      bodyWood: bassBuilder.BODY_WOOD_OPTIONS[resolvedConfig.bodyWood],
      bodyFinish: resolvedConfig.bodyFinish && typeof resolvedConfig.bodyFinish === 'string' && resolvedConfig.bodyFinish.startsWith('#')
        ? { color: resolvedConfig.bodyFinish, texture: null }
        : bassBuilder.BODY_FINISH_OPTIONS[resolvedConfig.bodyFinish],
      neck: bassBuilder.NECK_OPTIONS[resolvedConfig.neck],
      fretboard: bassBuilder.FRETBOARD_OPTIONS[resolvedConfig.fretboard],
      frontNeckMask: (
        bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'masks', 'mask'],
          rejectTokens: ['neck-thru'],
          preferTokens: [preferredFrontFretToken, preferredFrontProfileToken, 'standard', 'mask'],
        })
        // Fallback keeps existing behavior for any model/string combo that lacks a dedicated front mask.
        || bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'neck-thru-mask'],
          preferTokens: ['neck-thru-mask'],
        })
        || BASS_NECK_MASK
      ),
      frontFretboardMask: bassBuilder.resolveSharedAsset('necks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['front', 'masks', 'mask'],
        rejectTokens: ['neck-thru'],
        preferTokens: [preferredFrontFretToken, preferredFrontProfileToken, 'standard', 'mask'],
      }) || BASS_NECK_MASK,
      frontHeadstockMask: resolvedHeadstockMask || bassBuilder.resolveSharedAsset('headstocks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['masks', 'mask', exactStyleFolderToken],
        preferTokens: [effectiveHeadstockStyle, 'mask', exactStyleFolderToken],
      }),
      frontFrets: {
        stainless: bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'frets'],
          preferTokens: [preferredFrontFretToken, 'stainless'],
        }) || BASS_NECK_FRETS.stainless,
        gold: bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'frets'],
          preferTokens: [preferredFrontFretToken, 'gold'],
        }) || BASS_NECK_FRETS.gold,
      },
      frontNut: {
        white: bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'nut'],
          preferTokens: [preferredFrontFretToken, 'white'],
        }) || BASS_NECK_NUT.white,
        black: bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'nut'],
          preferTokens: [preferredFrontFretToken, 'black'],
        }) || BASS_NECK_NUT.black,
      },
      headstockWood: bassBuilder.HEADSTOCK_WOOD_OPTIONS[resolvedConfig.headstockWood],
      headstockTuners: resolvedHeadstockTuners || (isHeadless ? null : bassBuilder.resolveSharedAsset('headstocks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['tuners', exactStyleFolderToken],
        preferTokens: [effectiveHeadstockStyle, resolvedConfig.hardware, 'tuners', exactStyleFolderToken],
      })),
      headstockLogo: resolvedHeadstockLogo || (isHeadless ? null : bassBuilder.resolveSharedAsset('headstocks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['logos', 'bl', exactStyleFolderToken],
        rejectTokens: ['left-handed'],
        preferTokens: [effectiveHeadstockStyle, 'logos', exactStyleFolderToken],
      })),
      headstockStringOverlay: resolvedHeadstockStrings || (isHeadless ? null : bassBuilder.resolveSharedAsset('headstocks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['string-overlays', exactStyleFileToken],
        preferTokens: [effectiveHeadstockStyle, 'string-overlays', exactStyleFileToken],
      })),
      headstockTrussCover: isHeadless ? null : bassBuilder.resolveSharedAsset('headstocks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['truss-cover'],
        preferTokens: ['black', 'truss-cover'],
      }),
      hardware: bassBuilder.HARDWARE_OPTIONS[resolvedConfig.hardware],
      bridge: getBridgeByStrings(
        bassBuilder.BRIDGE_OPTIONS[resolvedConfig.bassType],
        resolvedConfig.bridge,
        resolvedConfig.strings,
      ),
      inlay: (() => {
        const baseInlay = bassBuilder.INLAY_OPTIONS[resolvedConfig.inlays]
        if (!isHeadless || !headlessInlayPreset) return baseInlay

        const resolvedHeadlessInlay = bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'inlays'],
          preferTokens: [
            preferredFrontFretToken,
            preferredFrontProfileToken,
            'standard',
            headlessInlayPreset.family,
            headlessInlayPreset.material,
          ],
        })

        if (!resolvedHeadlessInlay) return baseInlay
        return { ...(baseInlay || {}), src: resolvedHeadlessInlay }
      })(),
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
      rearNeckMask: (
        bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['back', 'masks', 'neck-mask'],
          preferTokens: [preferredRearNeckMaskToken, effectiveHeadstockStyle, 'neck-mask', 'back', 'masks'],
        })
        || bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['back', 'masks'],
          preferTokens: ['neck-thru-mask', 'neckthrumask'],
        })
        || BASS_NECK_MASK
      ),
      rearNeckFinish: bassBuilder.resolveSharedAsset('necks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['back'],
        preferTokens: ['neck finish', 'multiply', effectiveHeadstockStyle],
      }) || bassBuilder.resolveCatalogAsset(
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
      isHeadless,
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
  const bodyModelSrc = modelImageSrc || assets.bodyModel?.bodySrc || null

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
    if (assets.neck?.src && assets.frontNeckMask) {
      layers.push({
        name: 'neck',
        maskSrc: assets.frontNeckMask,
        style: {
          backgroundImage: `url(${assets.neck.src})`,
          filter: assets.neck.filter,
          opacity: 0.98,
          zIndex: 3,
        },
      })
    }

    if (assets.fretboard?.src && (assets.frontFretboardMask || assets.frontNeckMask)) {
      layers.push({
        name: 'fretboard',
        maskSrc: assets.frontFretboardMask || assets.frontNeckMask,
        style: {
          backgroundImage: `url(${assets.fretboard.src})`,
          opacity: 0.94,
          mixBlendMode: 'multiply',
          zIndex: 4,
        },
      })
    }

    // Frets
    if (assets.frontFrets?.stainless) {
      layers.push({
        name: 'frets',
        src: assets.frontFrets.stainless,
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
    if (!assets.isHeadless && assets.frontNut?.[nutColor]) {
      layers.push({
        name: 'nut',
        src: assets.frontNut[nutColor],
        style: { zIndex: 7, opacity: 0.9 },
      })
    }

    // Headstock wood
    if (!assets.isHeadless && assets.headstockWood?.texture && (assets.frontHeadstockMask || assets.frontNeckMask)) {
      layers.push({
        name: 'headstock-wood',
        maskSrc: assets.frontHeadstockMask || assets.frontNeckMask,
        style: {
          backgroundImage: `url(${assets.headstockWood.texture})`,
          opacity: 0.95,
          zIndex: 8,
        },
      })
    } else if (!assets.isHeadless && DEBUG) {
      console.warn('[HEADSTOCK] Missing headstock asset')
    }

    if (!assets.isHeadless && assets.headstockStringOverlay) {
      layers.push({
        name: 'headstock-strings',
        src: assets.headstockStringOverlay,
        style: { zIndex: 8.3, opacity: 0.95 },
      })
    }
    if (!assets.isHeadless && assets.headstockTuners) {
      layers.push({
        name: 'headstock-tuners',
        src: assets.headstockTuners,
        style: { zIndex: 8.4, opacity: 0.97 },
      })
    }
    if (!assets.isHeadless && assets.headstockTrussCover) {
      layers.push({
        name: 'headstock-truss-cover',
        src: assets.headstockTrussCover,
        style: { zIndex: 8.2, opacity: 0.95 },
      })
    }

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
    const strapSrc = bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType,
        'front',
        'strap buttons/standard',
        resolvedConfig.strings,
        colorKey,
      )
      || assets.bodyAssets?.front?.strap?.[colorKey]
      || assets.bodyAssets?.front?.strap?.chrome
    if (strapSrc) {
      layers.push({
        name: 'strap',
        src: strapSrc,
        style: { zIndex: 15, opacity: 0.95 },
      })
    }

    // Shadow effects - applied last for depth
    const frontShadow = bassBuilder.resolveCatalogAsset(
      resolvedConfig.bassType,
      'front',
      'shadows_highlights',
      { strings: resolvedConfig.strings, preferTokens: ['edge', 'shadow'] },
    ) || assets.bodyAssets?.front?.shadows
    if (frontShadow) {
      layers.push({
        name: 'shadows',
        src: frontShadow,
        style: { zIndex: 20, opacity: 1, mixBlendMode: 'multiply' },
      })
    }

    // Gloss/Highlight effects
    const frontGloss = bassBuilder.resolveCatalogAsset(
      resolvedConfig.bassType,
      'front',
      'shadows_highlights',
      { strings: resolvedConfig.strings, preferTokens: ['gloss'] },
    ) || assets.bodyAssets?.front?.gloss
    if (frontGloss) {
      layers.push({
        name: 'gloss',
        src: frontGloss,
        style: { zIndex: 21, opacity: 0.9, mixBlendMode: 'screen' },
      })
    }

    if (DEBUG) console.log('[FRONT LAYERS]', layers.map(l => l.name))
    return layers
  }, [assets, colorKey, resolvedConfig.pickguard])

  // Rear view layers with strict validation
  const rearLayers = useMemo(() => {
    const layers = []
    const rearBodyMask = assets.rearBodyMask || assets.bodyModel?.bodySrc

    // Body base
    if (rearBodyMask && assets.bodyWood?.texture) {
      layers.push({
        name: 'rear-body-wood',
        maskSrc: rearBodyMask,
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
        maskSrc: rearBodyMask,
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
        maskSrc: rearBodyMask,
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

    const isRearHeadless = assets.isHeadless || resolvedConfig.bassType === 'vader'
    if (isRearHeadless && assets.bodyAssets?.back?.neckCap) {
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
    if (assets.rearNeckFinish || assets.bodyAssets?.back?.shadows) {
      layers.push({
        name: 'rear-shadows',
        src: assets.rearNeckFinish || assets.bodyAssets?.back?.shadows,
        style: { zIndex: 20, opacity: 0.85, mixBlendMode: 'multiply' },
      })
    }

    // Gloss effects - rear view
    if (assets.rearGloss || assets.bodyAssets?.back?.gloss) {
      layers.push({
        name: 'rear-gloss',
        src: assets.rearGloss || assets.bodyAssets?.back?.gloss,
        style: { zIndex: 21, opacity: 0.8, mixBlendMode: 'screen' },
      })
    }

    if (DEBUG) console.log('[REAR LAYERS]', layers.map(l => l.name))
    return layers
  }, [assets])

  // Transform calculations
  const previewLayout = bassBuilder.PREVIEW_LAYOUTS[resolvedConfig.bassType] ?? { scale: 0.93, x: 0, y: 26 }
  const previewScale = view === 'rear' ? previewLayout.scale * 0.98 : previewLayout.scale
  const previewFlip = 'scaleX(1)'

  if (DEBUG && view) {
    console.log(`[VIEW CHANGE] ${view} - scale: ${previewScale}, flip: ${previewFlip}`)
  }

  useEffect(() => {
    if (!DEBUG || !previewRef.current) return
    const stage = previewRef.current.querySelector('[data-export-stage="true"]')
    if (!stage) {
      console.warn('[BASS PREVIEW DEBUG] Missing export stage in preview DOM')
      return
    }

    const layerNodes = Array.from(stage.querySelectorAll('[data-layer]'))
    const rows = layerNodes.map((node) => {
      const style = window.getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return {
        name: node.getAttribute('data-layer') || '',
        src: node.getAttribute('data-layer-src') || style.backgroundImage || '',
        mask: node.getAttribute('data-layer-mask') || style.maskImage || style.webkitMaskImage || '',
        zIndex: style.zIndex,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        opacity: style.opacity,
        display: style.display,
        visibility: style.visibility,
        transform: style.transform,
      }
    })

    const payload = {
      view,
      stage: {
        width: Math.round(stage.getBoundingClientRect().width),
        height: Math.round(stage.getBoundingClientRect().height),
      },
      layers: rows,
    }
    console.log('[BASS PREVIEW DEBUG] Rendered layer diagnostics', payload)
  }, [view, frontLayers, rearLayers])

  return (
    <div className="w-full" ref={previewRef}>
      <div className="relative mx-auto w-full">
        <div className="relative overflow-visible rounded-xl">
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
                isolation: 'isolate',
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
