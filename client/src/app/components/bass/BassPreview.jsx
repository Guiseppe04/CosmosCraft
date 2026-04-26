import { useEffect, useMemo, useRef } from 'react'
import { CircleDot } from 'lucide-react'
import {
  bassBuilder,
  bassAsset,
  BASS_NECK_FRETS,
  BASS_NECK_MASK,
  BASS_NECK_NUT,
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
  if (!src && !maskSrc) {
    if (DEBUG) console.warn(`[BassLayer] Missing source for ${layerName}`)
    return null
  }

  const computedStyle = maskSrc ? maskedLayerStyle(maskSrc, style) : layerStyle(src, style)
  
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

const sortLayersByZIndex = (layers = []) =>
  [...layers].sort((a, b) => {
    const aZ = Number(a?.style?.zIndex ?? 0)
    const bZ = Number(b?.style?.zIndex ?? 0)
    return aZ - bZ
  })

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
    const rearNeckBasePath = `all-models/necks/bass/${stringCountToken}/back`
    const rearMaskBasePath = `${rearNeckBasePath}/masks`
    const validHeadstockStyles = new Set(['ch', 'chr', 'gt4', 'gt4r', 'gt5', 'gt5r'])
    const canUseDirectHeadstockPaths = validHeadstockStyles.has(effectiveHeadstockStyle)
    const exactStyleFileToken = `/${effectiveHeadstockStyle}.png`
    const exactStyleFolderToken = `/${effectiveHeadstockStyle}/`
    const resolveHeadstockAssetWithFallback = ({ requiredTokens = [], preferTokens = [], rejectTokens = [] }) => (
      bassBuilder.resolveSharedAsset('headstocks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens,
        preferTokens,
        rejectTokens,
      })
    )
    // NOTE: bassAsset() must NOT be called from BassPreview.jsx — import.meta.url
    // resolves relative to this component file, not to bassBuilderData.js, so all
    // bassAsset() paths produce broken URLs here. Use resolveSharedAsset() exclusively;
    // it uses pre-resolved glob URLs from the build-time index and always works.
    const resolvedHeadstockMask = !isHeadless && canUseDirectHeadstockPaths
      ? (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['masks', 'mask', exactStyleFolderToken],
          preferTokens: [effectiveHeadstockStyle, 'mask'],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['masks', 'mask'],
          preferTokens: [effectiveHeadstockStyle, 'mask', exactStyleFolderToken],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['masks', 'mask'],
          preferTokens: ['mask'],
        })
      )
      : null
    const resolvedHeadstockTuners = !isHeadless && canUseDirectHeadstockPaths
      ? (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['tuners', exactStyleFolderToken],
          preferTokens: [effectiveHeadstockStyle, resolvedConfig.hardware],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['tuners'],
          preferTokens: [effectiveHeadstockStyle, resolvedConfig.hardware, exactStyleFolderToken],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['tuners'],
          preferTokens: [resolvedConfig.hardware],
        })
      )
      : null
    const resolvedHeadstockLogo = !isHeadless && canUseDirectHeadstockPaths
      ? (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['logos', 'bl', exactStyleFolderToken],
          rejectTokens: ['left-handed'],
          preferTokens: [effectiveHeadstockStyle],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['logos', 'bl'],
          rejectTokens: ['left-handed'],
          preferTokens: [effectiveHeadstockStyle, exactStyleFolderToken],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['logos', 'bl'],
          rejectTokens: ['left-handed'],
          preferTokens: ['bl'],
        })
      )
      : null
    const resolvedHeadstockStrings = !isHeadless && canUseDirectHeadstockPaths
      ? (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['string-overlays', exactStyleFileToken],
          preferTokens: [effectiveHeadstockStyle],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['string-overlays'],
          preferTokens: [effectiveHeadstockStyle, exactStyleFileToken],
        })
        || resolveHeadstockAssetWithFallback({
          requiredTokens: ['string-overlays'],
          preferTokens: [effectiveHeadstockStyle],
        })
      )
      : null
    const headstockStaticMask = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/${effectiveHeadstockStyle}/masks/mask.png`)
      : null
    const headstockStaticTuners = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/${effectiveHeadstockStyle}/tuners/${resolvedConfig.hardware}.png`)
      : null
    const headstockStaticLogo = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/${effectiveHeadstockStyle}/logos/bl.png`)
      : null
    const headstockStaticStrings = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${headstockBasePath}/string-overlays/${effectiveHeadstockStyle}.png`)
      : null
    const headstockStaticTrussCover = !isHeadless
      ? bassAsset(`${headstockBasePath}/truss-cover/black.png`)
      : null
    const rearNeckStaticMask = bassAsset(`${rearMaskBasePath}/${isFiveString ? 'neck-mask-22f.png' : 'neck-mask-20f.png'}`)
    const rearNeckStaticMaskGeneric = bassAsset(`${rearMaskBasePath}/neck-mask.png`)
    const rearHeadstockStaticMask = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${rearMaskBasePath}/${effectiveHeadstockStyle}.png`)
      : null
    const rearHeadstockStaticTuners = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${rearNeckBasePath}/${effectiveHeadstockStyle}/tuners/standard/${resolvedConfig.hardware}.png`)
      : null
    const rearHeadstockStaticFinish = !isHeadless && canUseDirectHeadstockPaths
      ? bassAsset(`${rearNeckBasePath}/${effectiveHeadstockStyle}/finish/multiply.png`)
      : null
    const rearNeckStaticFinish = bassAsset(`${rearNeckBasePath}/neck finish/new-multiply-${isFiveString ? '22f' : '20f'}.png`)

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
      frontHeadstockMask: resolvedHeadstockMask || resolveHeadstockAssetWithFallback({
        requiredTokens: ['masks', 'mask', exactStyleFolderToken],
        preferTokens: [effectiveHeadstockStyle, 'mask', exactStyleFolderToken],
      }) || resolveHeadstockAssetWithFallback({
        requiredTokens: ['masks', 'mask'],
        preferTokens: [effectiveHeadstockStyle, 'mask'],
      }) || headstockStaticMask,
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
      headstockTuners: resolvedHeadstockTuners || (isHeadless ? null : (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['tuners', exactStyleFolderToken],
          preferTokens: [effectiveHeadstockStyle, resolvedConfig.hardware, 'tuners', exactStyleFolderToken],
        }) || resolveHeadstockAssetWithFallback({
          requiredTokens: ['tuners'],
          preferTokens: [effectiveHeadstockStyle, resolvedConfig.hardware],
        }) || headstockStaticTuners
      )),
      headstockLogo: resolvedHeadstockLogo || (isHeadless ? null : (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['logos', 'bl', exactStyleFolderToken],
          rejectTokens: ['left-handed'],
          preferTokens: [effectiveHeadstockStyle, 'logos', exactStyleFolderToken],
        }) || resolveHeadstockAssetWithFallback({
          requiredTokens: ['logos', 'bl'],
          rejectTokens: ['left-handed'],
          preferTokens: [effectiveHeadstockStyle, 'logos'],
        }) || headstockStaticLogo
      )),
      headstockStringOverlay: resolvedHeadstockStrings || (isHeadless ? null : (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['string-overlays', exactStyleFileToken],
          preferTokens: [effectiveHeadstockStyle, 'string-overlays', exactStyleFileToken],
        }) || resolveHeadstockAssetWithFallback({
          requiredTokens: ['string-overlays'],
          preferTokens: [effectiveHeadstockStyle, exactStyleFileToken],
        }) || headstockStaticStrings
      )),
      headstockTrussCover: isHeadless ? null : (
        resolveHeadstockAssetWithFallback({
          requiredTokens: ['truss-cover'],
          preferTokens: ['black', 'truss-cover'],
        }) || resolveHeadstockAssetWithFallback({
          requiredTokens: ['truss-cover'],
          preferTokens: ['truss-cover'],
        }) || headstockStaticTrussCover
      ),
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
        resolvedConfig.bassType, 'front', 'masks',
        { strings: resolvedConfig.strings, preferTokens: ['bodymask'] },
      ) || bodyModel.bodySrc,
      rearBodyMask: (
        bassBuilder.resolveCatalogAsset(
          resolvedConfig.bassType, 'back', 'masks',
          { strings: resolvedConfig.strings, preferTokens: ['bodymask'] },
        )
        || bassBuilder.BODY_LAYER_ASSETS[resolvedConfig.bassType]?.back?.mask
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
        || rearNeckStaticMask
        || rearNeckStaticMaskGeneric
        || BASS_NECK_MASK
      ),
      rearHeadstockMask: (
        !isHeadless && (
          bassBuilder.resolveSharedAsset('necks/bass', {
            strings: resolvedConfig.strings,
            requiredTokens: ['back', 'masks'],
            preferTokens: [effectiveHeadstockStyle],
          })
          || rearHeadstockStaticMask
        )
      ),
      rearHeadstockTuners: (
        !isHeadless && (
          bassBuilder.resolveSharedAsset('necks/bass', {
            strings: resolvedConfig.strings,
            requiredTokens: ['back', 'tuners', 'standard'],
            preferTokens: [effectiveHeadstockStyle, resolvedConfig.hardware],
          })
          || rearHeadstockStaticTuners
        )
      ),
      rearHeadstockFinish: (
        !isHeadless && (
          bassBuilder.resolveSharedAsset('necks/bass', {
            strings: resolvedConfig.strings,
            requiredTokens: ['back', 'finish'],
            preferTokens: [effectiveHeadstockStyle, 'multiply'],
          })
          || rearHeadstockStaticFinish
        )
      ),
      rearNeckFinish: bassBuilder.resolveSharedAsset('necks/bass', {
        strings: resolvedConfig.strings,
        requiredTokens: ['back'],
        preferTokens: ['neck finish', 'multiply', effectiveHeadstockStyle],
      }) || bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType, 'back', 'shadows_highlights',
        { strings: resolvedConfig.strings, preferTokens: ['multiply'] },
      ) || rearNeckStaticFinish,
      rearGloss: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType, 'back', 'shadows_highlights',
        { strings: resolvedConfig.strings, preferTokens: ['gloss'] },
      ),
      rearStrap: bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType, 'back', 'strap buttons/standard',
        resolvedConfig.strings, resolvedConfig.hardware,
      ),
      rearStrapLocks: bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType, 'back', 'strap buttons/straplocks',
        resolvedConfig.strings, resolvedConfig.hardware,
      ),
      rearNeckBolts: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType, 'back', 'neck bolts',
        { strings: resolvedConfig.strings, preferTokens: ['neck', 'bolts'] },
      ),
      rearFerrules: bassBuilder.resolveCatalogVariant(
        resolvedConfig.bassType, 'back', 'string ferrules/standard',
        resolvedConfig.strings, resolvedConfig.hardware,
      ),
      rearBridge: bassBuilder.resolveCatalogAsset(
        resolvedConfig.bassType, 'back', 'bridges',
        { strings: resolvedConfig.strings, preferTokens: ['standard'] },
      ),
      isHeadless,
    }

    const pickguardsByModel = bassBuilder.PICKGUARD_OPTIONS[resolvedConfig.bassType]
    if (pickguardsByModel) resolvedAssets.pickguard = pickguardsByModel[resolvedConfig.pickguard]

    const knobsByModel = bassBuilder.KNOB_OPTIONS[resolvedConfig.bassType]
    if (knobsByModel) resolvedAssets.knobs = knobsByModel[resolvedConfig.knobs]

    const logosByModel = bassBuilder.LOGO_OPTIONS[resolvedConfig.bassType]
    if (logosByModel) resolvedAssets.logo = logosByModel[resolvedConfig.logo]

    const pickupScrewsByModel = bassBuilder.PICKUP_SCREW_OPTIONS[resolvedConfig.bassType]
    if (pickupScrewsByModel) resolvedAssets.pickupScrews = pickupScrewsByModel[resolvedConfig.pickupScrews]

    resolvedAssets.pickupLayers = resolvePickupLayers(resolvedConfig)

    if (DEBUG) console.log('[ASSET RESOLUTION]', resolvedAssets)
    return resolvedAssets
  }, [resolvedConfig])

  const colorKey = assets.hardware?.color ?? 'chrome'

  const frontLayers = useMemo(() => {
    const layers = []

    if (assets.bodyModel?.bodySrc) {
      layers.push({ name: 'body-wood', maskSrc: assets.bodyModel.bodySrc, style: { backgroundImage: assets.bodyWood?.texture ? `url(${assets.bodyWood.texture})` : undefined, opacity: 1, mixBlendMode: 'normal', zIndex: 1 } })
    }
    if (assets.bodyFinish?.texture) {
      layers.push({ name: 'body-finish-texture', maskSrc: assets.bodyModel?.bodySrc, style: { backgroundImage: `url(${assets.bodyFinish.texture})`, opacity: 1, mixBlendMode: 'normal', zIndex: 2 } })
    } else if (assets.bodyFinish?.color) {
      layers.push({ name: 'body-finish-color', maskSrc: assets.bodyModel?.bodySrc, style: { backgroundColor: assets.bodyFinish.color, opacity: 1, zIndex: 2 } })
    }
    if (assets.neck?.src && assets.frontNeckMask) {
      layers.push({ name: 'neck', maskSrc: assets.frontNeckMask, style: { backgroundImage: `url(${assets.neck.src})`, filter: assets.neck.filter, opacity: 0.98, zIndex: 3 } })
    }
    if (assets.fretboard?.src && (assets.frontFretboardMask || assets.frontNeckMask)) {
      layers.push({ name: 'fretboard', maskSrc: assets.frontFretboardMask || assets.frontNeckMask, style: { backgroundImage: `url(${assets.fretboard.src})`, opacity: 0.94, mixBlendMode: 'multiply', zIndex: 4 } })
    }
    if (assets.frontFrets?.stainless) {
      layers.push({ name: 'frets', src: assets.frontFrets.stainless, style: { zIndex: 5, opacity: 0.85 } })
    }
    if (assets.inlay?.src) {
      layers.push({ name: 'inlays', src: assets.inlay.src, style: { zIndex: 6, opacity: 1, filter: 'brightness(1.15) contrast(1.1)' } })
    }
    const nutColor = colorKey === 'black' ? 'black' : 'white'
    if (!assets.isHeadless && assets.frontNut?.[nutColor]) {
      layers.push({ name: 'nut', src: assets.frontNut[nutColor], style: { zIndex: 7, opacity: 0.9 } })
    }
    if (!assets.isHeadless && assets.headstockWood?.texture && (assets.frontHeadstockMask || assets.frontNeckMask)) {
      layers.push({ name: 'headstock-wood', maskSrc: assets.frontHeadstockMask || assets.frontNeckMask, style: { backgroundImage: `url(${assets.headstockWood.texture})`, opacity: 0.95, zIndex: 8 } })
    }
    if (!assets.isHeadless && assets.headstockStringOverlay) {
      layers.push({
        name: 'headstock-strings',
        src: assets.headstockStringOverlay,
        style: {
          zIndex: 8.3,
          opacity: 1,
          filter: 'brightness(1.22) contrast(1.32) drop-shadow(0 0 0.45px rgba(0,0,0,0.85))',
        },
      })
    }
    if (!assets.isHeadless && assets.headstockLogo) {
      layers.push({ name: 'headstock-logo', src: assets.headstockLogo, style: { zIndex: 8.35, opacity: 1, filter: 'brightness(1.12) contrast(1.18)' } })
    }
    if (!assets.isHeadless && assets.headstockTuners) {
      layers.push({ name: 'headstock-tuners', src: assets.headstockTuners, style: { zIndex: 8.4, opacity: 0.97 } })
    }
    if (!assets.isHeadless && assets.headstockTrussCover) {
      layers.push({ name: 'headstock-truss-cover', src: assets.headstockTrussCover, style: { zIndex: 8.2, opacity: 1, filter: 'brightness(1.1) contrast(1.2)' } })
    }
    if (resolvedConfig.pickguard !== 'none' && assets.pickguard?.src) {
      layers.push({ name: 'pickguard', src: assets.pickguard.src, style: { zIndex: 9, opacity: 0.95 } })
    }
    if (resolvedConfig.pickguard !== 'none' && assets.pickupScrews?.src) {
      layers.push({ name: 'pickup-screws', src: assets.pickupScrews.src, style: { zIndex: 10, opacity: 0.9 } })
    }
    if (assets.pickupLayers?.bridgePickup) {
      layers.push({ name: 'pickup-bridge', src: assets.pickupLayers.bridgePickup, style: { zIndex: 11, opacity: 0.9 } })
    }
    if (assets.pickupLayers?.neckPickup) {
      layers.push({ name: 'pickup-neck', src: assets.pickupLayers.neckPickup, style: { zIndex: 11, opacity: 0.9 } })
    }
    if (resolvedConfig.bassType === 'jb' && assets.controlPlate?.src) {
      layers.push({ name: 'control-plate', src: assets.controlPlate.src, style: { zIndex: 12, opacity: 0.9 } })
    }
    if (assets.knobs?.src) {
      layers.push({ name: 'knobs', src: assets.knobs.src, style: { zIndex: 13, opacity: 0.95 } })
    }
    const bridgeSrc = resolveBassVariant(assets.bridge?.assets, colorKey)
    if (bridgeSrc) {
      layers.push({ name: 'bridge', src: bridgeSrc, style: { zIndex: 14, opacity: 0.95 } })
    }
    const strapSrc = bassBuilder.resolveCatalogVariant(resolvedConfig.bassType, 'front', 'strap buttons/standard', resolvedConfig.strings, colorKey)
      || assets.bodyAssets?.front?.strap?.[colorKey]
      || assets.bodyAssets?.front?.strap?.chrome
    if (strapSrc) {
      layers.push({ name: 'strap', src: strapSrc, style: { zIndex: 15, opacity: 0.95 } })
    }
    const frontShadow = bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'shadows_highlights', { strings: resolvedConfig.strings, preferTokens: ['edge', 'shadow'] }) || assets.bodyAssets?.front?.shadows
    if (frontShadow) {
      layers.push({ name: 'shadows', src: frontShadow, style: { zIndex: 20, opacity: 1, mixBlendMode: 'multiply' } })
    }
    const frontGloss = bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'shadows_highlights', { strings: resolvedConfig.strings, preferTokens: ['gloss'] }) || assets.bodyAssets?.front?.gloss
    if (frontGloss) {
      layers.push({ name: 'gloss', src: frontGloss, style: { zIndex: 21, opacity: 0.9, mixBlendMode: 'screen' } })
    }

    const orderedLayers = sortLayersByZIndex(layers)
    if (DEBUG) console.log('[FRONT LAYERS]', orderedLayers.map(l => l.name))
    return orderedLayers
  }, [assets, colorKey, resolvedConfig.pickguard])

  const rearLayers = useMemo(() => {
    const layers = []
    const rearBodyMask = assets.rearBodyMask || assets.bodyModel?.bodySrc
    const rearNeckMask = assets.rearNeckMask || BASS_NECK_MASK
    const rearHeadstockMask = assets.rearHeadstockMask || rearNeckMask

    if (rearBodyMask && assets.bodyWood?.texture) {
      layers.push({ name: 'rear-body-wood', maskSrc: rearBodyMask, style: { backgroundImage: `url(${assets.bodyWood.texture})`, opacity: 1, zIndex: 1 } })
    }
    if (assets.bodyFinish?.texture) {
      layers.push({ name: 'rear-body-finish-texture', maskSrc: rearBodyMask, style: { backgroundImage: `url(${assets.bodyFinish.texture})`, opacity: 1, mixBlendMode: 'normal', zIndex: 2 } })
    } else if (assets.bodyFinish?.color) {
      layers.push({ name: 'rear-body-finish-color', maskSrc: rearBodyMask, style: { backgroundColor: assets.bodyFinish.color, opacity: 1, zIndex: 2 } })
    }
    if (rearNeckMask && assets.neck?.src) {
      layers.push({ name: 'rear-neck-wood', maskSrc: rearNeckMask, style: { backgroundImage: `url(${assets.neck.src})`, filter: assets.neck.filter, opacity: 0.98, zIndex: 3 } })
    }
    if (rearNeckMask && assets.rearNeckFinish) {
      layers.push({ name: 'rear-neck-finish', maskSrc: rearNeckMask, style: { backgroundImage: `url(${assets.rearNeckFinish})`, opacity: 0.92, mixBlendMode: 'multiply', zIndex: 4 } })
    }
    if (assets.rearNeckBolts) {
      layers.push({ name: 'rear-neck-bolts', src: assets.rearNeckBolts, style: { zIndex: 5, opacity: 0.95 } })
    }
    if (assets.rearFerrules) {
      layers.push({ name: 'rear-ferrules', src: assets.rearFerrules, style: { zIndex: 6, opacity: 0.95 } })
    }
    if (assets.rearBridge) {
      layers.push({ name: 'rear-bridge', src: assets.rearBridge, style: { zIndex: 7, opacity: 0.95 } })
    }
    const isRearHeadless = assets.isHeadless || resolvedConfig.bassType === 'vader'
    if (isRearHeadless && assets.bodyAssets?.back?.neckCap) {
      layers.push({ name: 'rear-neck-cap', src: assets.bodyAssets.back.neckCap, style: { zIndex: 8, opacity: 0.95 } })
    } else if (assets.headstockWood?.texture && rearHeadstockMask) {
      layers.push({ name: 'rear-headstock-wood', maskSrc: rearHeadstockMask, style: { backgroundImage: `url(${assets.headstockWood.texture})`, opacity: 0.95, zIndex: 8 } })
    }
    if (!isRearHeadless && rearHeadstockMask && assets.rearHeadstockFinish) {
      layers.push({ name: 'rear-headstock-finish', maskSrc: rearHeadstockMask, style: { backgroundImage: `url(${assets.rearHeadstockFinish})`, opacity: 0.85, mixBlendMode: 'multiply', zIndex: 8.2 } })
    }
    if (!isRearHeadless && assets.rearHeadstockTuners) {
      layers.push({ name: 'rear-headstock-tuners', src: assets.rearHeadstockTuners, style: { zIndex: 8.4, opacity: 0.97 } })
    }
    if (assets.backplate?.src) {
      layers.push({ name: 'backplate', src: assets.backplate.src, style: { zIndex: 9, opacity: 0.95 } })
    }
    if (assets.rearStrap) {
      layers.push({ name: 'rear-strap', src: assets.rearStrap, style: { zIndex: 10, opacity: 0.95 } })
    }
    if (assets.rearStrapLocks) {
      layers.push({ name: 'rear-straplocks', src: assets.rearStrapLocks, style: { zIndex: 11, opacity: 0.95 } })
    }
    if (assets.rearNeckFinish || assets.bodyAssets?.back?.shadows) {
      layers.push({ name: 'rear-shadows', src: assets.rearNeckFinish || assets.bodyAssets?.back?.shadows, style: { zIndex: 20, opacity: 0.85, mixBlendMode: 'multiply' } })
    }
    if (assets.rearGloss || assets.bodyAssets?.back?.gloss) {
      layers.push({ name: 'rear-gloss', src: assets.rearGloss || assets.bodyAssets?.back?.gloss, style: { zIndex: 21, opacity: 0.8, mixBlendMode: 'screen' } })
    }

    const orderedLayers = sortLayersByZIndex(layers)
    if (DEBUG) console.log('[REAR LAYERS]', orderedLayers.map(l => l.name))
    return orderedLayers
  }, [assets])

  const previewLayout = bassBuilder.PREVIEW_LAYOUTS[resolvedConfig.bassType] ?? { scale: 0.93, x: 0, y: 26 }
  const previewScale = view === 'rear' ? previewLayout.scale * 0.98 : previewLayout.scale

  useEffect(() => {
    if (!DEBUG || !previewRef.current) return
    const stage = previewRef.current.querySelector('[data-export-stage="true"]')
    if (!stage) return
    const layerNodes = Array.from(stage.querySelectorAll('[data-layer]'))
    const rows = layerNodes.map((node) => {
      const style = window.getComputedStyle(node)
      const rect = node.getBoundingClientRect()
      return { name: node.getAttribute('data-layer') || '', src: node.getAttribute('data-layer-src') || style.backgroundImage || '', mask: node.getAttribute('data-layer-mask') || style.maskImage || style.webkitMaskImage || '', zIndex: style.zIndex, width: Math.round(rect.width), height: Math.round(rect.height), opacity: style.opacity }
    })
    console.log('[BASS PREVIEW DEBUG]', { view, layers: rows })
  }, [view, frontLayers, rearLayers])

  return (
    <div className="w-full" ref={previewRef}>
      <div className="relative mx-auto w-full">
        <div className="relative rounded-xl" style={{ overflow: 'visible' }}>
          {/* Background fills only the visible card area */}
          <div
            className="absolute rounded-xl"
            style={{
              inset: 0,
              background: 'linear-gradient(to bottom, #1a1a1a, #0f0f0f, #0a0a0a)',
              zIndex: 0,
            }}
          />

          {/* Ambient glow — clipped to card, behind everything */}
          <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-gradient-radial from-white/10 via-transparent to-transparent opacity-40" />
            <div className="absolute top-0 left-1/4 w-[300px] h-[300px] bg-gradient-radial from-[#d4af37]/5 via-transparent to-transparent opacity-50" />
            <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-gradient-radial from-white/5 via-transparent to-transparent opacity-30" />
          </div>

          {/*
            KEY FIX: The stage wrapper uses overflow:visible and has horizontal padding
            so the guitar has room to breathe on both sides without being clipped.
            The stage itself is positioned relative so its absolute-inset children
            paint within it — but since overflow is visible they can spill out and
            still be seen (headstock tuners on the right, bridge on the left).
          */}
          <div
            className="relative flex items-center justify-center py-8"
            style={{ overflow: 'visible', zIndex: 1 }}
          >
            {/*
              Outer scroll-guard: a fixed-height box that is slightly wider than
              the stage so the tuners are never clipped by the parent column/card.
              We do NOT put overflow:hidden here.
            */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '1100px',   /* wider than the 1000px stage to give headstock room */
                paddingInline: '40px',
                boxSizing: 'border-box',
                overflow: 'visible',
              }}
            >
              <div
                data-export-stage="true"
                style={{
                  position: 'relative',
                  /* Use the same 16:7 ratio the export canvas uses */
                  aspectRatio: '16 / 7',
                  width: '100%',
                  maxWidth: '960px',
                  margin: '0 auto',
                  overflow: 'visible',   /* layers that extend past stage bounds remain visible */
                  isolation: 'isolate',
                  transform: `translate(${previewLayout.x}px, ${previewLayout.y}px) scale(${previewScale}) scaleX(1)`,
                  transformOrigin: '50% 50%',
                  transition: 'transform 500ms ease-out',
                }}
              >
                {view === 'front' && frontLayers.map((layer) => (
                  <BassLayer
                    key={layer.name}
                    src={layer.src ?? undefined}
                    maskSrc={layer.maskSrc ?? undefined}
                    style={layer.style}
                    layerName={layer.name}
                  />
                ))}
                {view === 'rear' && rearLayers.map((layer) => (
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
          </div>

          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2/3 h-6 bg-gradient-to-b from-transparent via-black/30 to-black/50 blur-xl" style={{ zIndex: 1 }} />
        </div>
      </div>
    </div>
  )
}

export default BassPreview
