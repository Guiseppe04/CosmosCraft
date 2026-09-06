import { useEffect, useMemo, useRef } from 'react'
import { CircleDot } from 'lucide-react'
import {
  bassBuilder,
  bassAsset,
  BASS_NECK_FRETS,
  BASS_NECK_MASK,
  BASS_NECK_NUT,
  resolveBassVariant,
  VADER_PICKUP_OPTIONS,
  VADER_STRAP_BUTTON_OPTIONS,
  VADER_ELECTRONICS_CAVITY_COVER_OPTIONS,
  BASS_KNOB_OPTIONS,
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

function BassLayer({ src, maskSrc, style, className = '', layerName = '', protectedLayer = false }) {
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
      data-sticker-protected={protectedLayer ? 'true' : 'false'}
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

const resolveVaderPickupLayers = (resolvedConfig) => {
  const bridgeKey = resolvedConfig.vaderBridgePickup || 'radiumHumbucker'
  const neckKey = resolvedConfig.vaderNeckPickup || 'none'
  const bridgeOpt = VADER_PICKUP_OPTIONS[bridgeKey]
  const neckOpt = VADER_PICKUP_OPTIONS[neckKey]
  const colorMode = resolvedConfig.vaderPickupColor || 'none'
  const rgbColor = resolvedConfig.vaderPickupColorRgb || '#000000'

  const layers = []

  if (bridgeOpt?.bridgeAsset) {
    const bridgeSrc = bassAsset(bridgeOpt.bridgeAsset)
    const bridgeMask = bridgeOpt.bridgeMask ? bassAsset(bridgeOpt.bridgeMask) : null

    layers.push({
      name: 'pickup-bridge',
      src: bridgeSrc,
      style: {
        zIndex: 121,
        opacity: 0.9,
        ...(bridgeOpt.positionOffset ? { transform: bridgeOpt.positionOffset } : {}),
      },
      protectedLayer: true,
    })

    if (colorMode === 'custom' && bridgeOpt.supportsColor && bridgeMask) {
      layers.push({
        name: 'pickup-bridge-color',
        maskSrc: bridgeMask,
        style: {
          zIndex: 122,
          backgroundColor: rgbColor,
          mixBlendMode: 'color',
        },
        protectedLayer: true,
      })
    }
  }

  if (neckOpt?.neckAsset && neckKey !== 'none') {
    const neckSrc = bassAsset(neckOpt.neckAsset)
    const neckMask = neckOpt.neckMask ? bassAsset(neckOpt.neckMask) : null

    layers.push({
      name: 'pickup-neck',
      src: neckSrc,
      style: { zIndex: 123, },
      protectedLayer: true,
    })

    if (colorMode === 'custom' && neckOpt.supportsColor && neckMask) {
      layers.push({
        name: 'pickup-neck-color',
        maskSrc: neckMask,
        style: {
          zIndex: 124,
          backgroundColor: rgbColor,
          mixBlendMode: 'color',
        },
        protectedLayer: true,
      })
    }
  }

  return layers
}

const resolvePickupLayers = (resolvedConfig) => {
  if (resolvedConfig.bassType === 'vader') {
    return resolveVaderPickupLayers(resolvedConfig)
  }
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

function BassPreview({ config, view, onViewChange, modelImageSrc, stickerOverlay = null, stickerMaskSrc = null, stageRef = null }) {
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
      inlayShape: config.inlayShape ?? 'dots',
      inlayMaterial: config.inlayMaterial ?? 'motherOfPearl',
      headstockStyle: config.headstockStyle ?? 'ch',
      headstockShape: config.headstockShape ?? '6in',
      neckRearFinish: config.neckRearFinish ?? 'tungOil',
      trussRodCover: config.trussRodCover ?? 'black',
      electronicsType: config.electronicsType ?? 'passive',
      pickupColor: config.pickupColor ?? 'bobbins',
      pickupColorVariant: config.pickupColorVariant ?? 'black',
      pickupPoleColor: config.pickupPoleColor ?? 'black',
      controls: config.controls ?? 'off',
      saddle: config.saddle ?? 'chrome',
      nut: config.nut ?? 'blackGraphTech',
      tuning: config.tuning ?? 'eStandard',
      stringBrand: config.stringBrand ?? 'elixir1046',
      outputJack: config.outputJack ?? 'off',
      strapButtons: config.strapButtons ?? 'standard',
      tunerButtons: config.tunerButtons ?? 'none',
      electronicsCavityCover: config.electronicsCavityCover ?? 'black',
      logo: config.logo ?? 'standard',
      backplate: config.backplate ?? 'standard',
      pickupScrews: config.pickupScrews ?? 'black',
      controlPlate: config.controlPlate ?? 'black',
      topWood: config.topWood ?? 'none',
      finishType: config.finishType ?? 'solid',
      topCoat: config.topCoat ?? 'clearGloss',
      burstEdges: config.burstEdges ?? 'none',
      threePieceBody: config.threePieceBody ?? 'off',
      finishColor: config.finishColor ?? 'none',
      vaderBridgePickup: config.vaderBridgePickup ?? 'radiumHumbucker',
      vaderNeckPickup: config.vaderNeckPickup ?? 'radiumHumbucker',
      vaderPickupColor: config.vaderPickupColor ?? 'none',
      vaderPickupColorRgb: config.vaderPickupColorRgb ?? '#000000',
      vaderKnobs: config.vaderKnobs ?? 'hardwareColor',
      vaderStrapButtons: config.vaderStrapButtons ?? 'standard',
      vaderElectronicsCavityCover: config.vaderElectronicsCavityCover ?? 'black',
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

    const inlayShapeConfig = bassBuilder.INLAY_SHAPE_OPTIONS?.[resolvedConfig.inlayShape]
    const inlayMaterialConfig = bassBuilder.INLAY_MATERIAL_OPTIONS?.[resolvedConfig.inlayMaterial]
    const inlayShapeFolder = inlayShapeConfig?.folder || 'id'
    const inlayMaterialCode = inlayMaterialConfig?.code || 'id'

// Confirmed suffixes so far — extend this once you check the other material folders
const INLAY_MATERIAL_SUFFIX = {
  motherOfPearl: 'white-pearl',
  luminlay: 'luminlay',
  green: 'white-pearl',   // TODO: confirm real suffix
  pink: 'white-pearl',    // TODO: confirm real suffix
  red: 'white-pearl',     // TODO: confirm real suffix
  white: 'white-pearl',   // TODO: confirm real suffix
  black: 'white-pearl',   // TODO: confirm real suffix
  abalone: 'white-pearl', // TODO: confirm real suffix
}
const materialSuffix = INLAY_MATERIAL_SUFFIX[resolvedConfig.inlayMaterial] || 'white-pearl'

const inlayMaskSrc = bassBuilder.resolveSharedAsset('necks/bass', {
  strings: resolvedConfig.strings,
  requiredTokens: ['front', 'inlays', inlayShapeFolder, materialSuffix],
  preferTokens: [preferredFrontFretToken, preferredFrontProfileToken, 'standard', inlayShapeFolder, materialSuffix],
}) || bassAsset(
  `all-models/necks/bass/${stringCountToken}/front/${preferredFrontFretToken}/standard/${preferredFrontProfileToken}/inlays/${inlayShapeFolder}/${inlayShapeFolder}${materialSuffix}.png`
)
const inlayMaterialPath = bassAsset(`all-models/necks/bass/inlay-material/${inlayMaterialCode}.png`)
const inlay = {
  maskSrc: inlayMaskSrc,
  materialSrc: inlayMaterialPath,
  label: `${inlayShapeConfig?.label || 'Dots'} / ${inlayMaterialConfig?.label || 'Mother of Pearl'}`,
}

    const resolvedAssets = {
      bodyModel,
      bodyWood: bassBuilder.BODY_WOOD_OPTIONS[resolvedConfig.bodyWood],
      bodyFinish: resolvedConfig.bodyFinish && typeof resolvedConfig.bodyFinish === 'string' && resolvedConfig.bodyFinish.startsWith('#')
        ? { color: resolvedConfig.bodyFinish, texture: null }
        : bassBuilder.BODY_FINISH_OPTIONS[resolvedConfig.bodyFinish],
      topWood: bassBuilder.TOP_WOOD_OPTIONS?.[resolvedConfig.topWood] || null,
      topWoodMask: resolvedConfig.bassType === 'vader'
        ? bassAsset('bass/vader/front/masks/topwoodmask.png')
        : null,
      bodyMask: resolvedConfig.bassType === 'vader'
        ? bassAsset('bass/vader/front/masks/bodymask.png')
        : null,
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
        || bassAsset('all-models/necks/bass/4-string/front/neck-thru-mask.png')
        || BASS_NECK_MASK
      ),
      frontFretboardMask: (
        bassBuilder.resolveSharedAsset('necks/bass', {
          strings: resolvedConfig.strings,
          requiredTokens: ['front', 'masks', 'mask'],
          rejectTokens: ['neck-thru'],
          preferTokens: [preferredFrontFretToken, preferredFrontProfileToken, 'standard', 'mask'],
        })
        || bassAsset('all-models/necks/bass/4-string/front/24-fret/standard/flat-bottom/masks/mask.png')
        || BASS_NECK_MASK
      ),
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
      inlay,
      backplate: getBackplateByStrings(
        bassBuilder.BACKPLATE_OPTIONS[resolvedConfig.bassType],
        resolvedConfig.bassType === 'vader'
          ? (resolvedConfig.vaderBridgePickup === 'fishmanFluence' ? 'acf' : 'standard')
          : resolvedConfig.backplate,
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

    if (resolvedConfig.bassType === 'vader') {
      const vaderKnobEntry = BASS_KNOB_OPTIONS.vader[resolvedConfig.vaderKnobs]
      if (vaderKnobEntry) resolvedAssets.knobs = vaderKnobEntry

      const strapOpt = VADER_STRAP_BUTTON_OPTIONS[resolvedConfig.vaderStrapButtons]
      if (strapOpt) {
        resolvedAssets.strapButtons = strapOpt
      }

      const cavityOpt = VADER_ELECTRONICS_CAVITY_COVER_OPTIONS[resolvedConfig.vaderElectronicsCavityCover]
      if (cavityOpt) resolvedAssets.electronicsCavityCover = cavityOpt
    }

    const pickupScrewsByModel = bassBuilder.PICKUP_SCREW_OPTIONS[resolvedConfig.bassType]
    if (pickupScrewsByModel) resolvedAssets.pickupScrews = pickupScrewsByModel[resolvedConfig.pickupScrews]

    resolvedAssets.pickupLayers = resolvedConfig.bassType === 'vader'
      ? resolveVaderPickupLayers(resolvedConfig)
      : resolvePickupLayers(resolvedConfig)

    if (DEBUG) console.log('[ASSET RESOLUTION]', resolvedAssets)
    return resolvedAssets
  }, [resolvedConfig])

  const colorKey = assets.hardware?.color ?? 'chrome'

  const frontLayers = useMemo(() => {
    const layers = []
    const bodyMask = assets.bodyMask || assets.bodyModel?.bodySrc

    if (assets.bodyModel?.bodySrc) {
      layers.push({ name: 'body-wood', maskSrc: bodyMask, style: { backgroundImage: assets.bodyWood?.texture ? `url(${assets.bodyWood.texture})` : undefined, opacity: 1, mixBlendMode: 'normal', zIndex: 1 } })
    }
    if (resolvedConfig.bassType === 'vader' && resolvedConfig.threePieceBody === 'on') {
      const threePieceMask = bassAsset('bass/vader/front/masks/three-piece-body-mask.png')
      if (threePieceMask) {
        layers.push({
          name: 'three-piece-body',
          maskSrc: threePieceMask,
          style: { backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 2, },
          protectedLayer: true,
        })
      }
    }
    if (assets.topWood?.texture && assets.topWoodMask) {
      layers.push({ name: 'top-wood', maskSrc: assets.topWoodMask, style: { backgroundImage: `url(${assets.topWood.texture})`, opacity: 1, mixBlendMode: 'normal', zIndex: 3 }, protectedLayer: true })
    }
    if (assets.bodyFinish?.texture) {
      layers.push({ name: 'body-finish-texture', maskSrc: bodyMask, style: { backgroundImage: `url(${assets.bodyFinish.texture})`, opacity: 1, mixBlendMode: 'normal', zIndex: 4 } })
    } else if (assets.bodyFinish?.color) {
      layers.push({ name: 'body-finish-color', maskSrc: bodyMask, style: { backgroundColor: assets.bodyFinish.color, opacity: 1, zIndex: 2 } })
    }
    if (assets.neck?.src && assets.frontNeckMask) {
      layers.push({ name: 'neck', maskSrc: assets.frontNeckMask, style: { backgroundImage: `url(${assets.neck.src})`, filter: assets.neck.filter, zIndex: 100 }, protectedLayer: true })
    }
    if (assets.fretboard?.src && (assets.frontFretboardMask || assets.frontNeckMask)) {
      layers.push({ name: 'fretboard', maskSrc: assets.frontFretboardMask || assets.frontNeckMask, style: { backgroundImage: `url(${assets.fretboard.src})`, zIndex: 101 }, protectedLayer: true })
    }
    if (assets.frontFrets?.stainless) {
      layers.push({ name: 'frets', src: assets.frontFrets.stainless, style: { zIndex: 102 }, protectedLayer: true })
    }
    if (assets.inlay?.maskSrc && assets.inlay?.materialSrc) {
      layers.push({
        name: 'inlay',
        maskSrc: assets.inlay.maskSrc,
        style: { backgroundImage: `url(${assets.inlay.materialSrc})`, zIndex: 103, opacity: 1 },
        protectedLayer: true,
      })
    }
    const nutColor = colorKey === 'black' ? 'black' : 'white'
    if (!assets.isHeadless && assets.frontNut?.[nutColor]) {
      layers.push({ name: 'nut', src: assets.frontNut[nutColor], style: { zIndex: 104 }, protectedLayer: true })
    }
    if (!assets.isHeadless && assets.headstockWood?.texture && (assets.frontHeadstockMask || assets.frontNeckMask)) {
      layers.push({ name: 'headstock-wood', maskSrc: assets.frontHeadstockMask || assets.frontNeckMask, style: { backgroundImage: `url(${assets.headstockWood.texture})`, opacity: 0.95, zIndex: 105 }, protectedLayer: true })
    }
    if (!assets.isHeadless && assets.headstockStringOverlay) {
      layers.push({
        name: 'headstock-strings',
        src: assets.headstockStringOverlay,
        style: {
          zIndex: 106,
          opacity: 1,
          filter: 'brightness(1.22) contrast(1.32) drop-shadow(0 0 0.45px rgba(0,0,0,0.85))',
        },
        protectedLayer: true,
      })
    }
    if (!assets.isHeadless && assets.headstockLogo) {
      layers.push({ name: 'headstock-logo', src: assets.headstockLogo, style: { zIndex: 107, opacity: 1, filter: 'brightness(1.12) contrast(1.18)' }, protectedLayer: true })
    }
    if (!assets.isHeadless && assets.headstockTuners) {
      layers.push({ name: 'headstock-tuners', src: assets.headstockTuners, style: { zIndex: 108 }, protectedLayer: true })
    }
    if (!assets.isHeadless && assets.headstockTrussCover) {
      layers.push({ name: 'headstock-truss-cover', src: assets.headstockTrussCover, style: { zIndex: 109, opacity: 1, filter: 'brightness(1.1) contrast(1.2)' }, protectedLayer: true })
    }
    if (resolvedConfig.pickguard !== 'none' && assets.pickguard?.src) {
      layers.push({ name: 'pickguard', src: assets.pickguard.src, style: { zIndex: 9 }, protectedLayer: true })
    }
    if (resolvedConfig.pickguard !== 'none' && assets.pickupScrews?.src) {
      layers.push({ name: 'pickup-screws', src: assets.pickupScrews.src, style: { zIndex: 120 }, protectedLayer: true })
    }
    if (Array.isArray(assets.pickupLayers)) {
      assets.pickupLayers.forEach((layer) => {
        if (layer.src) {
          layers.push({ name: layer.name, src: layer.src, style: layer.style, protectedLayer: layer.protectedLayer })
        } else if (layer.maskSrc) {
          layers.push({ name: layer.name, maskSrc: layer.maskSrc, style: layer.style, protectedLayer: layer.protectedLayer })
        }
      })
    } else {
      if (assets.pickupLayers?.bridgePickup) {
        layers.push({ name: 'pickup-bridge', src: assets.pickupLayers.bridgePickup, style: { zIndex: 121 }, protectedLayer: true })
      }
      if (assets.pickupLayers?.neckPickup) {
        layers.push({ name: 'pickup-neck', src: assets.pickupLayers.neckPickup, style: { zIndex: 122 }, protectedLayer: true })
      }
    }
    if (resolvedConfig.bassType === 'jb' && assets.controlPlate?.src) {
      layers.push({ name: 'control-plate', src: assets.controlPlate.src, style: { zIndex: 123 }, protectedLayer: true })
    }
        if (resolvedConfig.bassType === 'vader' && assets.knobs) {
      const knobType = assets.knobs.type
      if (knobType === 'hardwareColor' && assets.knobs.src) {
        layers.push({
          name: 'knobs',
          src: assets.knobs.src,
          style: {
            zIndex: 124,
            filter:
              colorKey === 'black' ? 'brightness(0.35) saturate(0)' :
              colorKey === 'gold' ? 'sepia(1) saturate(3) hue-rotate(-15deg) brightness(1.05)' :
              'none', // chrome — no filter, use the photo as-is
          },
          protectedLayer: true,
        })
      } else if (knobType === 'overlay' && assets.knobs.src) {
        layers.push({ name: 'knobs', src: assets.knobs.src, style: { zIndex: 124 }, protectedLayer: true })
        if (assets.knobs.overlaySrc) {
          layers.push({ name: 'knobs-overlay', src: assets.knobs.overlaySrc, style: { zIndex: 125 }, protectedLayer: true })
        }
      } else if (knobType === 'solid' && assets.knobs.src) {
        layers.push({ name: 'knobs', src: assets.knobs.src, style: { zIndex: 124 }, protectedLayer: true })
      }
    }
    const bridgeSrc = resolveBassVariant(assets.bridge?.assets, colorKey)
    if (bridgeSrc) {
      layers.push({ name: 'bridge', src: bridgeSrc, style: { zIndex: 125 }, protectedLayer: true })
    }
    const strapSrc = resolvedConfig.bassType === 'vader'
      ? assets.strapButtons?.frontSrc?.(colorKey)
      : (bassBuilder.resolveCatalogVariant(resolvedConfig.bassType, 'front', 'strap buttons/standard', resolvedConfig.strings, colorKey)
        || assets.bodyAssets?.front?.strap?.[colorKey]
        || assets.bodyAssets?.front?.strap?.chrome)
    if (strapSrc) {
      layers.push({ name: 'strap', src: strapSrc, style: { zIndex: 126 }, protectedLayer: true })
    }

    // Vader top coat layers (composited from the three-layer gloss/raw-tone/matte stack)
    if (resolvedConfig.bassType === 'vader') {
      const topCoatBaseMap = {
        clearGloss: { file: 'gloss' },
        tungOil: { file: 'raw-tone' },
        satinMatte: { file: 'matte' },
      }
      const topCoatSpec = topCoatBaseMap[resolvedConfig.topCoat] || topCoatBaseMap.clearGloss
      const topCoatBaseSrc = bassAsset(`bass/vader/front/shadows_highlights/${topCoatSpec.file}.png`)
      const edgeShadowSrc = bassAsset('bass/vader/front/shadows_highlights/edge-shadow.png')
      const multiplySrc = bassAsset('bass/vader/front/shadows_highlights/multiply.png')
      const coatMask = bodyMask

      // Sits ABOVE body wood/finish but BELOW all hardware (neck starts at 100,
      // pickguard at 9, bridge/strap/knobs up to 126). This is a wood-finish
      // effect, not a "varnish over the hardware" effect — it must render
      // before anything that's mounted on top of the body.
      if (topCoatBaseSrc) {
        layers.push({ name: 'top-coat-base', maskSrc: coatMask, style: { backgroundImage: `url(${topCoatBaseSrc})`, zIndex: 7 } })
      }
      if (edgeShadowSrc) {
        layers.push({ name: 'top-coat-edge', maskSrc: coatMask, style: { backgroundImage: `url(${edgeShadowSrc})`, zIndex: 7 } })
      }
      if (multiplySrc) {
        layers.push({ name: 'top-coat-multiply', maskSrc: coatMask, style: { backgroundImage: `url(${multiplySrc})`, zIndex: 7 } })
      }
    }

    // Vader burst edges (front+rear effect, applied to both views)
    if (resolvedConfig.bassType === 'vader' && resolvedConfig.burstEdges && resolvedConfig.burstEdges !== 'none') {
      const burstMap = {
        blackBurst: { mask: bassAsset('bass/vader/front/masks/black-burst-mask.png'), color: 'rgb(0, 0, 0)' },
        whiteBurst: { mask: bassAsset('bass/vader/front/masks/black-burst-mask.png'), color: 'rgb(255, 255, 255)' },
        translucentBlackBurst: { mask: bassAsset('bass/vader/front/masks/burstmask.png'), color: 'rgba(0,0,0,0.65)' },
        reverseTranslucentBlackBurst: null, // front only handled below; rear skips it
      }
      const burstSpec = burstMap[resolvedConfig.burstEdges]
      if (burstSpec?.mask) {
        layers.push({
          name: `burst-edges-${resolvedConfig.burstEdges}`,
          maskSrc: burstSpec.mask,
          style: { backgroundColor: burstSpec.color, zIndex: 6, mixBlendMode: resolvedConfig.burstEdges === 'translucentBlackBurst' ? 'multiply' : 'normal', opacity: 1 },
          protectedLayer: true,
        })
      }
    }

    // Vader uses the new explicit top coat stack — skip the legacy dynamic gloss/shadow
    // so changing Top Coat in the UI actually changes the visual.
    if (resolvedConfig.bassType !== 'vader') {
      const frontShadow = bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'shadows_highlights', { strings: resolvedConfig.strings, preferTokens: ['edge', 'shadow'] }) || assets.bodyAssets?.front?.shadows
      if (frontShadow) {
        layers.push({ name: 'shadows', src: frontShadow, style: { zIndex: 200 } })
      }
      const frontGloss = bassBuilder.resolveCatalogAsset(resolvedConfig.bassType, 'front', 'shadows_highlights', { strings: resolvedConfig.strings, preferTokens: ['gloss'] }) || assets.bodyAssets?.front?.gloss
      if (frontGloss) {
        layers.push({ name: 'gloss', src: frontGloss, style: { zIndex: 201, opacity: 0.9, mixBlendMode: 'screen' } })
      }
    }

    const orderedLayers = sortLayersByZIndex(layers)
    if (DEBUG) console.log('[FRONT LAYERS]', orderedLayers.map(l => l.name))
    return orderedLayers
  }, [assets, colorKey, resolvedConfig.pickguard, resolvedConfig.topCoat, resolvedConfig.burstEdges, resolvedConfig.threePieceBody, resolvedConfig.vaderBridgePickup, resolvedConfig.vaderNeckPickup, resolvedConfig.vaderPickupColor, resolvedConfig.vaderPickupColorRgb, resolvedConfig.vaderKnobs, resolvedConfig.vaderStrapButtons, resolvedConfig.hardware])

  const rearLayers = useMemo(() => {
    const layers = []
    const rearBodyMask = assets.rearBodyMask || assets.bodyModel?.bodySrc
    const rearNeckMask = assets.rearNeckMask || BASS_NECK_MASK
    const rearHeadstockMask = assets.rearHeadstockMask || rearNeckMask

    // Rear neck wood sits BEHIND the body so the body wood/finish can cover
    // the part of the neck that visually goes under the body. The neck only
    // shows where it extends past the body's silhouette.
    if (rearNeckMask && assets.neck?.src) {
      layers.push({ name: 'rear-neck-wood', maskSrc: rearNeckMask, style: { backgroundImage: `url(${assets.neck.src})`, filter: assets.neck.filter, opacity: 0.98, zIndex: 0 }, protectedLayer: true })
    }
    if (rearBodyMask && assets.bodyWood?.texture) {
      layers.push({ name: 'rear-body-wood', maskSrc: rearBodyMask, style: { backgroundImage: `url(${assets.bodyWood.texture})`, opacity: 1, zIndex: 1 } })
    }
    if (resolvedConfig.bassType === 'vader' && resolvedConfig.threePieceBody === 'on') {
      const threePieceMask = bassAsset('bass/vader/back/masks/three-piece-body-mask.png')
      if (threePieceMask) {
        layers.push({
          name: 'rear-three-piece-body',
          maskSrc: threePieceMask,
          style: { backgroundColor: 'rgba(0,0,0,0.25)', zIndex: 1.25, mixBlendMode: 'multiply' },
          protectedLayer: true,
        })
      }
    }
    if (assets.bodyFinish?.texture) {
      layers.push({ name: 'rear-body-finish-texture', maskSrc: rearBodyMask, style: { backgroundImage: `url(${assets.bodyFinish.texture})`, opacity: 1, mixBlendMode: 'normal', zIndex: 2 } })
    } else if (assets.bodyFinish?.color) {
      layers.push({ name: 'rear-body-finish-color', maskSrc: rearBodyMask, style: { backgroundColor: assets.bodyFinish.color, opacity: 1, zIndex: 2 } })
    }
    if (rearNeckMask && assets.rearNeckFinish) {
      layers.push({ name: 'rear-neck-finish', maskSrc: rearNeckMask, style: { backgroundImage: `url(${assets.rearNeckFinish})`, opacity: 0.92, mixBlendMode: 'multiply', zIndex: 101 }, protectedLayer: true })
    }
    if (assets.rearNeckBolts) {
      layers.push({ name: 'rear-neck-bolts', src: assets.rearNeckBolts, style: { zIndex: 4, opacity: 0.95 }, protectedLayer: true })
    }
    if (assets.rearFerrules) {
      layers.push({ name: 'rear-ferrules', src: assets.rearFerrules, style: { zIndex: 4, opacity: 0.95 }, protectedLayer: true })
    }
    if (assets.rearBridge) {
      layers.push({ name: 'rear-bridge', src: assets.rearBridge, style: { zIndex: 104, opacity: 0.95 }, protectedLayer: true })
    }
    const isRearHeadless = assets.isHeadless || resolvedConfig.bassType === 'vader'
    if (isRearHeadless && assets.bodyAssets?.back?.neckCap) {
      layers.push({ name: 'rear-neck-cap', src: assets.bodyAssets.back.neckCap, style: { zIndex: 105, opacity: 0.95 }, protectedLayer: true })
    } else if (assets.headstockWood?.texture && rearHeadstockMask) {
      layers.push({ name: 'rear-headstock-wood', maskSrc: rearHeadstockMask, style: { backgroundImage: `url(${assets.headstockWood.texture})`, opacity: 0.95, zIndex: 105 }, protectedLayer: true })
    }
    if (!isRearHeadless && rearHeadstockMask && assets.rearHeadstockFinish) {
      layers.push({ name: 'rear-headstock-finish', maskSrc: rearHeadstockMask, style: { backgroundImage: `url(${assets.rearHeadstockFinish})`, opacity: 0.85, mixBlendMode: 'multiply', zIndex: 106 }, protectedLayer: true })
    }
    if (!isRearHeadless && assets.rearHeadstockTuners) {
      layers.push({ name: 'rear-headstock-tuners', src: assets.rearHeadstockTuners, style: { zIndex: 107, opacity: 0.97 }, protectedLayer: true })
    }
    if (assets.backplate?.src) {
      layers.push({ name: 'backplate', src: assets.backplate.src, style: { zIndex: 108, opacity: 0.95 }, protectedLayer: true })
    }
    if (resolvedConfig.bassType === 'vader' && assets.electronicsCavityCover?.src) {
      layers.push({ name: 'electronics-cavity-cover', src: assets.electronicsCavityCover.src, style: { zIndex: 109, opacity: 0.95 }, protectedLayer: true })
    }
    if (resolvedConfig.bassType === 'vader' && assets.strapButtons?.backSrc?.(colorKey)) {
      layers.push({ name: 'rear-strap', src: assets.strapButtons.backSrc(colorKey), style: { zIndex: 110, opacity: 0.95 }, protectedLayer: true })
    }

    if (resolvedConfig.bassType === 'vader') {
      const rearTopCoatBaseMap = {
        clearGloss: { file: 'gloss-tung-oil' },
        rawTone: { file: 'op' },
        tungOil: { file: 'op' },
        satinMatte: { file: 'matte-tung-oil' },
      }
      const topCoatSpec = rearTopCoatBaseMap[resolvedConfig.topCoat] || rearTopCoatBaseMap.clearGloss
      const topCoatBaseSrc = bassAsset(`bass/vader/back/shadows_highlights/${topCoatSpec.file}.png`)
      const edgeShadowSrc = bassAsset('bass/vader/back/shadows_highlights/edge-shadow.png')
      const multiplySrc = bassAsset('bass/vader/back/shadows_highlights/multiply.png')
      const coatMask = rearBodyMask

      // Same reordering as front: below rear-strap (110), backplate (108),
      // headstock finish (105-109), above body wood/finish (1-2).
      if (topCoatBaseSrc) {
        layers.push({ name: 'rear-top-coat-base', maskSrc: coatMask, style: { backgroundImage: `url(${topCoatBaseSrc})`, zIndex: 3 } })
      }
      if (edgeShadowSrc) {
        layers.push({ name: 'rear-top-coat-edge', maskSrc: coatMask, style: { backgroundImage: `url(${edgeShadowSrc})`, zIndex: 3 } })
      }
      if (multiplySrc) {
        layers.push({ name: 'rear-top-coat-multiply', maskSrc: coatMask, style: { backgroundImage: `url(${multiplySrc})`, zIndex: 3 } })
      }
    }

    // Vader burst edges for rear (skip reverse — front only)
    if (resolvedConfig.bassType === 'vader' && resolvedConfig.burstEdges && resolvedConfig.burstEdges !== 'none' && resolvedConfig.burstEdges !== 'reverseTranslucentBlackBurst') {
      const burstMap = {
        blackBurst: { mask: bassAsset('bass/vader/back/masks/black-burst-mask.png'), color: 'rgba(0,0,0,0.85)' },
        whiteBurst: { mask: bassAsset('bass/vader/back/masks/black-burst-mask.png'), color: 'rgba(255,255,255,0.85)' },
        translucentBlackBurst: { mask: bassAsset('bass/vader/back/masks/burstmask.png'), color: 'rgba(0,0,0,0.65)' },
      }
      const burstSpec = burstMap[resolvedConfig.burstEdges]
      if (burstSpec?.mask) {
        layers.push({
          name: `rear-burst-edges-${resolvedConfig.burstEdges}`,
          maskSrc: burstSpec.mask,
          style: { backgroundColor: burstSpec.color, zIndex: 100, mixBlendMode: resolvedConfig.burstEdges === 'translucentBlackBurst' ? 'multiply' : 'normal', opacity: 1 },
          protectedLayer: true,
        })
      }
    }

    // Vader uses the new explicit top coat stack — skip the legacy dynamic rear gloss/shadow
    if (resolvedConfig.bassType !== 'vader') {
      if (assets.rearNeckFinish || assets.bodyAssets?.back?.shadows) {
        layers.push({ name: 'rear-shadows', src: assets.rearNeckFinish || assets.bodyAssets?.back?.shadows, style: { zIndex: 200, opacity: 0.85, mixBlendMode: 'multiply' } })
      }
      if (assets.rearGloss || assets.bodyAssets?.back?.gloss) {
        layers.push({ name: 'rear-gloss', src: assets.rearGloss || assets.bodyAssets?.back?.gloss, style: { zIndex: 201, opacity: 0.8, mixBlendMode: 'screen' } })
      }
    }

    const orderedLayers = sortLayersByZIndex(layers)
    if (DEBUG) console.log('[REAR LAYERS]', orderedLayers.map(l => l.name))
    return orderedLayers
  }, [assets, resolvedConfig.topCoat, resolvedConfig.burstEdges, resolvedConfig.threePieceBody, resolvedConfig.vaderBridgePickup, resolvedConfig.vaderElectronicsCavityCover, resolvedConfig.vaderStrapButtons])

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
                ref={stageRef}
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
                    protectedLayer={layer.protectedLayer}
                  />
                ))}
                {view === 'front' && stickerOverlay && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-[25] pointer-events-none select-none"
                    style={stickerMaskSrc ? {
                      WebkitMaskImage: `url(${stickerMaskSrc})`,
                      maskImage: `url(${stickerMaskSrc})`,
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                      WebkitMaskMode: 'alpha',
                      maskMode: 'alpha',
                    } : undefined}
                    data-sticker-clip-mask-src={stickerMaskSrc || ''}
                  >
                    {stickerOverlay}
                  </div>
                )}
                {view === 'rear' && rearLayers.map((layer) => (
                  <BassLayer
                    key={layer.name}
                    src={layer.src ?? undefined}
                    maskSrc={layer.maskSrc ?? undefined}
                    style={layer.style}
                    layerName={layer.name}
                    protectedLayer={layer.protectedLayer}
                  />
                ))}
                {view === 'rear' && stickerOverlay && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 z-[25] pointer-events-none select-none"
                    style={stickerMaskSrc ? {
                      WebkitMaskImage: `url(${stickerMaskSrc})`,
                      maskImage: `url(${stickerMaskSrc})`,
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                      WebkitMaskMode: 'alpha',
                      maskMode: 'alpha',
                    } : undefined}
                    data-sticker-clip-mask-src={stickerMaskSrc || ''}
                  >
                    {stickerOverlay}
                  </div>
                )}
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
