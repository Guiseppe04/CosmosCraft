/**
 * Dynamic Asset Resolver
 * 
 * Automatically resolves asset paths based on category, model, and option selections.
 * Supports both Cloudinary CDN and local file fallback.
 * 
 * Local folder structure (public/builder/):
 *   electric_assets/builder/all-models/{shared-asset-type}/
 *   electric_assets/builder/{model}/bodies|back|shadows_highlights/...
 *   electric_assets/builder/{model}/buttons/{option-type}-buttons/
 * 
 * When VITE_CLOUDINARY_CLOUD_NAME is set, assets are served from Cloudinary.
 * Otherwise, assets are served from the local /builder/electric_assets/builder/ directory.
 */
import { NECK_REAR_FINISH_OPTIONS } from './guitarBuilderData.js'
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) 
  ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME 
  : ''

const USE_CLOUDINARY = Boolean(CLOUD_NAME) 

/**
 * Resolve an asset path using either Cloudinary or local files
 */
// After
export function resolveAssetPath(subPath) {
  if (USE_CLOUDINARY) {
    // Cloudinary mirrors the local folder structure exactly:
    // cosmoscraft_assets/electric_assets/builder/{dc|delos|all-models}/...
    if (subPath.startsWith('electric_assets/')) {
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/${subPath}`
    }
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/electric_assets/builder/${subPath}`
  }
  // Local fallback - serve from public/builder/electric_assets/builder/
  return `/builder/${subPath}`
}

export const cloudImage = (root, path) => {
  if (USE_CLOUDINARY) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${root}/${path}`
  }
  // For backwards compatibility with existing cloudImage calls
  return `/builder/${path}`
}

export const asset = path => resolveAssetPath(path)

/**
 * Get the base asset path for a given category and model
 */
export function getModelAssetPath(category, model) {
  return `${category}_assets/builder/${model}`
}

/**
 * Resolve a shared asset path (from models/all-models/)
 *
 * Shared wood/finish layer assets are canonicalized under the DC collection
 * so every guitar body uses the same all-models texture atlas and stays
 * visually aligned with the DC reference preview.
 */
export function resolveSharedAsset(category, model, assetType, ...subPaths) {
  const base = `${category}_assets/builder/all-models`
  const path = [base, assetType, ...subPaths]
    .filter(Boolean)
    .join('/')
  return asset(path)
}

/**
 * Resolve a model-specific asset path (from models/{model}/)
 */
export function resolveModelAsset(category, model, assetType, ...subPaths) {
  const base = getModelAssetPath(category, model)
  const path = [base, assetType, ...subPaths]
    .filter(Boolean)
    .join('/')
  return asset(path)
}

/**
 * Resolve a button preview image path
 */
export function resolveButtonAsset(category, model, optionType, fileName) {
  const base = getModelAssetPath(category, model)
  const path = [base, 'buttons', `${optionType}-buttons`, fileName]
    .filter(Boolean)
    .join('/')
  return asset(path)
}

/**
 * Resolve a body wood texture path
 */
// Normalize an option value (which may be camelCase, e.g. "birdseyeMaple")
// to the kebab-case filename used on disk / Cloudinary ("birdseye-maple").
const toKebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export function resolveBodyWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'body-woods', `${toKebab(woodKey)}.png`)
}

/**
 * Resolve a fingerboard wood texture path
 */
export function resolveFingerboardWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'fingerboard-woods', `${toKebab(woodKey)}.png`)
}

/**
 * Resolve a neck wood texture path
 */
export function resolveNeckWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'neck-woods', `${toKebab(woodKey)}.png`)
}

/**
 * Resolve a headstock wood texture path
 */
export function resolveHeadstockWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'headstock-woods', `${toKebab(woodKey)}.png`)
}

/**
 * Resolve a top wood texture path
 * Loads from: electric_assets/dc_assets/models/all-models/woods-colors/top-woods/{woodKey}.png
 */
export function resolveTopWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'top-woods', `${toKebab(woodKey)}.png`)
}

/**
 * Resolve a color/finish texture path
 * Finish type determines folder:
 *   metallic -> woods-colors/colors/metallics/{finishKey}.png
 *   translucent -> woods-colors/colors/transluscents/{finishKey}.png
 *   sparkle -> woods-colors/colors/sparkle/{finishKey}.png
 *   fade -> woods-colors/colors/fades/{finishKey}.png
 *   solid -> woods-colors/colors/solids/{finishKey}.png
 */
export function resolveFinishAsset(category, model, finishType, finishKey) {
  // Map finishType to actual folder name
  const folderMap = {
    metallic: 'metallics',
    translucent: 'transluscents',
    sparkle: 'sparkle',
    fade: 'fades',
    burst: 'bursts',
    solid: 'solids',
  }
  const folder = folderMap[finishType] || finishType
  return resolveSharedAsset(category, model, 'woods-colors', 'colors', folder, `${finishKey}.png`)
}
export function resolveBurstMask(category, model, burstKey) {
  const burstMaskMap = {
    delos: {
      blackBurst: 'delos/bodies/front/masks/black-burst-mask.png',
      whiteBurst: 'delos/bodies/front/masks/burstmask.png',
    },
    dc: {
      blackBurst: 'dc/bodies/front/masks/bvdmask.png',
      whiteBurst: 'dc/bodies/front/masks/bvdmask.png',
    },
  }
  
  const modelMap = burstMaskMap[model]
  // After
  if (modelMap && modelMap[burstKey]) {
    return asset(`${category}_assets/builder/${modelMap[burstKey]}`)
  }
  
  // Fallback to default resolution
  return resolveModelAsset(category, model, 'bodies', 'front', 'masks', `${burstKey === 'blackBurst' || burstKey === 'whiteBurst' ? 'bvdmask' : 'burstmask'}.png`)
}
/**
 * Resolve a body mask path
 */
export function resolveBodyMask(category, model) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'masks', 'bodymask.png')
}

/**
 * Resolve a body back mask path
 */
export function resolveBodyBackMask(category, model) {
  return resolveModelAsset(category, model, 'back', 'bodymask.png')
}

/**
 * Resolve shadows/highlights for a model
 */
export function resolveShadows(category, model) {
  return resolveModelAsset(category, model, 'shadows_highlights', 'edge-shadow.png')
}

export function resolveGloss(category, model) {
  return resolveModelAsset(category, model, 'shadows_highlights', 'gloss.png')
}

/**
 * Resolve a top coat overlay asset
 * Top coat overlays are loaded from the back/shadows_highlights/ folder
 * and rendered above the finish layer.
 * 
 * Path: {category}_assets/{model}_assets/models/{model}/back/shadows_highlights/{topCoatKey}.png
 */
export function resolveTopCoatAsset(category, model, topCoatKey, neckRearFinish) {
  const neckFinish = neckRearFinish || 'tungOil'
  
  const pathMap = {
    tungOil: {
      clearGloss: 'gloss-tung-oil',
      tungOil: 'op',
      satinMatte: 'matte-tung-oil',
    },
    clearSatin: {
      clearGloss: 'gloss-matte',
      satinMatte: 'matte',
    },
    clearGloss: {
      clearGloss: 'gloss',
    },
    paintedGloss: {
      clearGloss: 'gloss',
    },
    paintedSatin: {
      satinMatte: 'matte',
    },
    none: {
      clearGloss: 'gloss',
      tungOil: 'op',
      satinMatte: 'gloss-matte',
    }
  }
  
  const finishMap = pathMap[neckFinish] || pathMap.none
  const fileKey = finishMap[topCoatKey] || topCoatKey
  
  return resolveModelAsset(category, model, 'back', 'shadows_highlights', `${fileKey}.png`)
}

/**
 * Resolve a bridge asset
 */
export function resolveBridgeAsset(category, model, bridgeKey, colorKey) {
  return resolveSharedAsset(category, model, 'bridges', '6', 'standard', bridgeKey, `${colorKey}.png`)
}

/**
 * Resolve a headstock mask
 */
export function resolveHeadstockMask(category, model, headstockKey) {
  return resolveSharedAsset(category, model, 'headstocks', '6', 'masks', headstockKey, 'mask.png')
}

/**
 * Resolve a headstock tuner asset
 */
export function resolveHeadstockTuners(category, model, headstockKey, colorKey) {
  return resolveSharedAsset(category, model, 'headstocks', '6', 'tuners', headstockKey, `${colorKey}.png`)
}

/**
 * Resolve a headstock string overlay
 */
export function resolveHeadstockStrings(category, model, headstockKey) {
  return resolveSharedAsset(category, model, 'headstocks', '6', 'string-overlays', 'standard', `${headstockKey}.png`)
}

/**
 * Resolve a headstock truss cover
 */
export function resolveTrussCover(category, model, colorKey) {
  return resolveSharedAsset(category, model, 'headstocks', '6', 'truss-cover', `${colorKey}.png`)
}

/**
 * Resolve a neck mask
 */
export function resolveNeckMask(category, model) {
  return resolveSharedAsset(category, model, 'necks', '6-string', 'front', '24-fret-front', 'standard', 'masks', 'mask.png')
}

/**
 * Resolve fret assets
 */
export function resolveFrets(category, model, fretType) {
  return resolveSharedAsset(category, model, 'necks', '6-string', 'front', '24-fret-front', 'standard', 'frets', `${fretType}.png`)
}

/**
 * Resolve nut assets
 */
export function resolveNut(category, model, nutColor) {
  return resolveSharedAsset(category, model, 'necks', '6-string', 'front', '24-fret-front', 'standard', 'nut', `${nutColor}.png`)
}

/**
 * Resolve inlay assets
 * New structure: inlays/{shape}/{material}.png
 * Shape folders: ib (blocks), id (dots), idia (diamonds)
 */
export function resolveInlay(category, model, inlayKey, materialKey = null) {
  const shapeFolders = {
    dots: 'id',
    diamonds: 'idia',
    blocks: 'ib',
  }

  const normalizeShape = (shape) => {
    if (!shape) return 'dots'
    const normalized = String(shape).trim().toLowerCase()
    if (normalized === 'dot') return 'dots'
    if (normalized === 'diamond') return 'diamonds'
    if (normalized === 'box' || normalized === 'block' || normalized === 'blocks') return 'blocks'
    if (['dots', 'diamonds', 'blocks'].includes(normalized)) return normalized
    return 'dots'
  }

  const normalizeMaterial = (material) => {
    if (!material) return 'white-pearl'
    const normalized = String(material).trim().toLowerCase().replace(/_/g, '-')
    const map = {
      pearl: 'white-pearl',
      'white-pearl': 'white-pearl',
      black: 'black',
      green: 'green',
      luminlay: 'luminlay',
      pink: 'pink',
      red: 'red',
      abalone: 'abalone',
    }
    return map[normalized] || normalized
  }

  let shape = 'dots'
  let material = 'white-pearl'

  if (materialKey) {
    shape = normalizeShape(inlayKey)
    material = normalizeMaterial(materialKey)
  } else if (typeof inlayKey === 'string') {
    const rawKey = inlayKey.trim().toLowerCase().replace(/_/g, '-')
    const prefixMatch = rawKey.match(/^(id|idia|ib)-?(.*)$/)

    if (prefixMatch) {
      const prefix = prefixMatch[1]
      material = normalizeMaterial(prefixMatch[2] || 'white-pearl')
      shape = prefix === 'idia' ? 'diamonds' : prefix === 'ib' ? 'blocks' : 'dots'
    } else if (['dots', 'diamonds', 'blocks'].includes(rawKey)) {
      shape = rawKey
      material = 'white-pearl'
    } else {
      material = normalizeMaterial(rawKey)
    }
  }

  const folder = shapeFolders[shape] || 'id'
  const filename = `${folder}${material}.png`
  return resolveSharedAsset(category, model, 'necks', '6-string', 'front', '24-fret-front', 'standard', 'inlays', folder, filename)
}

/**
 * Resolve a neck rear finish overlay
 */
export function resolveNeckRearFinishAsset(category, model, finishKey) {
  const option = NECK_REAR_FINISH_OPTIONS[finishKey]
  const filename = option?.fileKey ? `${option.fileKey}.png` : `${finishKey}.png`
  return resolveModelAsset(category, model, 'back', 'shadows_highlights', filename)
}

/**
 * Resolve rear neck/headstock assets
 */
export function resolveBackNeckAsset(category, model, assetName) {
  return resolveSharedAsset(category, model, 'back', 'necks', '6-string', 'back', `${assetName}.png`)
}

/**
 * Resolve backplate assets
 */
export function resolveBackplateAsset(category, model, backplateKey) {
  return resolveModelAsset(category, model, 'back', 'backplates', `${backplateKey}.png`)
}

/**
 * Resolve output jack assets
 */
export function resolveOutputJackAsset(category, model, jackKey) {
  return resolveModelAsset(category, model, 'back', 'output-jacks', `${jackKey}.png`)
}

/**
 * Resolve strap button assets (back)
 */
export function resolveBackStrapButtonAsset(category, model, buttonKey) {
  return resolveModelAsset(category, model, 'back', 'strap buttons', `${buttonKey}.png`)
}

/**
 * Resolve string ferrule assets
 */
export function resolveStringFerrulesAsset(category, model, ferruleKey) {
  return resolveModelAsset(category, model, 'back', 'string ferrules', `${ferruleKey}.png`)
}

/**
 * Resolve front body knob assets
 */
export function resolveKnobAsset(category, model, knobKey) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'knobs', `${knobKey}.png`)
}

/**
 * Knobs are TWO composited layers, not one flat image per style+color
 * (same pattern as the pickup route/body/poles stack elsewhere in this file):
 *   - hardware base layer (bottom): color of the knob base/screw showing through
 *   - knob style layer (top): the style cap/overlay, colorless/transparent PNG
 *
 * NOTE: The `hardware/` subfolder does not yet exist on disk for DC — the
 * existing DC knob assets are flat (`knobs/{knobKey}.png`) with the hardware
 * color already baked in. `resolveKnobHardwareBase` is provided for forward
 * compatibility; GuitarPreview currently relies on the style overlay alone.
 */
export function resolveKnobHardwareBase(category, model, hardwareColor) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'knobs', `${hardwareColor}.png`)
}
export function resolveKnobStyleOverlay(category, model, knobKey) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'knobs', `${knobKey}.png`)
}

/**
 * Resolve a tremolo cover, which depends on bridge type (hipshot vs floyd).
 * Path: models/{model}/back/backplates/{coverFileKey}.png
 * coverFileKey is passed in fully resolved (e.g. 'ebony-trem-cover', 'floyd-rfm')
 * since the filename doesn't follow a clean {bridge}-{color} pattern.
 */
export function resolveTremoloCoverAsset(category, model, coverFileKey) {
  if (coverFileKey === 'ebony-trem-cover' && USE_CLOUDINARY) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/ebony-trem-cover_m4apux.png`
  }
  return resolveModelAsset(category, model, 'back', 'backplates', `${coverFileKey}.png`)
}

/**
 * Resolve strap button assets (front + back), keyed by style and hardware color.
 */
export function resolveStrapButtonBack(category, model, styleFolder, hardwareColor) {
  return resolveModelAsset(category, model, 'back', 'strap buttons', styleFolder, `${hardwareColor}.png`)
}
export function resolveStrapButtonFront(category, model, styleFolder, hardwareColor) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'strap buttons', styleFolder, `${hardwareColor}.png`)
}

/**
 * Resolve tuner button style overlay (White Pearloid / Black), keyed by headstock shape.
 * Path: all-models/headstocks/6/tuners/{headstockShape}/{styleKey}-buttons.png
 */
export function resolveTunerButtonStyle(category, model, headstockShape, styleKey) {
  return resolveSharedAsset(category, model, 'headstocks', '6', 'tuners', headstockShape, `${styleKey}-buttons.png`)
}

const FRONT_TO_REAR_HEADSTOCK_MAP = {
  h33:  'headstock2',
  h33r: 'headstock3',
  gt6:  'headstock14',
  gt6r: 'headstock13',
  '6inr': 'headstock5',
  '624': 'headstock4',
  '6in': 'headstock6',
  '6kr': '6kr',
}

export function resolveRearTunerAsset(category, model, frontHeadstockShape, hardwareColor) {
  const rearShape = FRONT_TO_REAR_HEADSTOCK_MAP[frontHeadstockShape]
  if (!rearShape) return null
  return resolveSharedAsset(category, model, 'back', 'necks', '6-string', 'back', '6-string-neck-thru-back', rearShape, 'tuners', 'locking', `${hardwareColor}.png`)
}

export function resolveRearHeadstockMask(category, model, frontHeadstockShape) {
  const rearShape = FRONT_TO_REAR_HEADSTOCK_MAP[frontHeadstockShape]
  if (!rearShape) return null
  return resolveSharedAsset(category, model, 'back', 'necks', '6-string', 'back', '6-string-neck-thru-back', rearShape, 'mask.png')
}

export function resolveRearBodyMask(category, model) {
  if (model === 'delos') {
    return resolveModelAsset(category, model, 'back', 'masks', 'bodymask.png')
  }
  if (model === 'dc') {
    return resolveModelAsset(category, model, 'back', 'masks', 'noneckbodymask.png')
  }
  return resolveModelAsset(category, model, 'back', 'masks', 'bodymask.png')
}

/**
 * Resolve output jack asset by hardware color (spec keys it by hardware color, not a jack "type").
 */
export function resolveOutputJackByColor(category, model, hardwareColor) {
  return resolveModelAsset(category, model, 'back', 'output-jacks', `${hardwareColor}.png`)
}

/**
 * Electronics cavity cover backplate screws overlay — always included alongside
 * whichever cover color is selected.
 */
export function resolveBackplateScrews(category, model) {
  return resolveModelAsset(category, model, 'back', 'backplates', 'backplate-screws.png')
}

/**
 * Resolve front body switch assets
 */
export function resolveSwitchAsset(category, model, switchKey) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'switches', `${switchKey}.png`)
}

/**
 * Resolve front body mask assets
 */
export function resolveBodyFrontMaskAsset(category, model, maskKey) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'masks', `${maskKey}.png`)
}

/**
 * Resolve front body strap button assets
 */
export function resolveBodyStrapButtonAsset(category, model, buttonKey) {
  return resolveModelAsset(category, model, 'bodies', 'front', 'strap buttons', `${buttonKey}.png`)
}

/**
 * Resolve pickup assets
 */
// Responsible for resolving humbucker pickup route asset paths (bridge.png / neck.png)
export function resolvePickupRoute(category, model, pickupType, colorKey, position) {
  if (pickupType === 'humbucker') {
    return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-routes', pickupType, `${position}.png`)
  }
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-routes', pickupType, `${colorKey}-${position}.png`)
}

// Responsible for resolving pickup body asset paths (covered pickups)
export function resolvePickupBody(category, model, pickupType, colorKey, position) {
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-bodies', pickupType, `${colorKey}-${position}.png`)
}

// Responsible for resolving pole piece asset paths (open/covered, singlecoil/humbucker)
export function resolvePickupPoles(category, model, pickupType, coverType, colorKey, position) {
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pole-pieces', pickupType, coverType,`${colorKey}-${position}.png`)
}

// Responsible for resolving bobbin color asset paths for open bobbins.
// Option values do not match the on-disk file keys for multi-color bobbins, so map
// them to the correct {color}-{position}.png filename under .../pickup-bodies/open/bobbins/.
const BOBBIN_COLOR_FILE_KEY = {
  black: 'black',
  white: 'white',
  cream: 'creme',
  'racing-green': 'green',
  'white-black': 'white-black',
  'black-cream': 'creme-black',
  'racing-green-black': 'black-green',
}
export function resolvePickupBobbinColor(category, model, colorKey, position) {
  const fileKey = BOBBIN_COLOR_FILE_KEY[colorKey] ?? colorKey
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-bodies', 'open', 'bobbins', `${fileKey}-${position}.png`)
}

// Responsible for resolving bobbin mask asset paths for painted/wooden bobbins
export function resolvePickupBobbinMask(category, model, position) {
  const maskMap = {
    neck: 'coil-mask-neck',
    middle: 'coil-mask-middle-single',
    bridge: 'coil-mask-bridge',
    'middle-single': 'coil-mask-middle-single-route',
  }
  const mask = maskMap[position] || `coil-mask-${position}`
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-bodies', mask + '.png')
}

// Responsible for resolving Fluence active pickup mask asset paths
export function resolveFluenceMask(category, model, position) {
  const maskMap = {
    bridge: 'fluence-bridge-mask',
    neck: 'fluence-neck-mask',
  }
  const mask = maskMap[position] || `${position}-mask`
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-bodies', 'covered', `${mask}.png`)
}

// Responsible for resolving single coil body asset paths
export function resolveSingleCoilBody(category, model, colorKey, position) {
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-bodies', 'singlecoil', `${colorKey}-${position}.png`)
}

/**
 * Resolve a body-specific asset (knobs, pickguard, strap buttons, switch)
 */
export function resolveBodySpecificAsset(category, model, assetType, fileName) {
  return resolveModelAsset(category, model, 'bodies', 'front', assetType, fileName)
}

/**
 * Get the button preview image for a given option type and value
 */
export function getButtonPreview(category, model, optionType, value) {
  const buttonFileName = `${value}.png`
  return resolveButtonAsset(category, model, optionType, buttonFileName)
}

/**
 * Main resolver: given a category, model, option key, and value,
 * returns the appropriate preview image URL if available.
 */
export function resolveOptionPreview(category, model, optionKey, value) {
  if (!category || !model || !optionKey || !value) return null

  const previewMap = {
    bodyWood: () => resolveBodyWoodAsset(category, model, value),
    fingerboardWood: () => resolveFingerboardWoodAsset(category, model, value),
    fretboard: () => resolveFingerboardWoodAsset(category, model, value),
    neckWood: () => resolveNeckWoodAsset(category, model, value),
    headstockWood: () => resolveHeadstockWoodAsset(category, model, value),
    topWood: () => resolveTopWoodAsset(category, model, value),
    bridge: () => getButtonPreview(category, model, 'bridge', value),
    hardware: () => getButtonPreview(category, model, 'hardware-color', value),
    hardwareColor: () => getButtonPreview(category, model, 'hardware-color', value),
    knobs: () => resolveKnobAsset(category, model, value),
    headstock: () => getButtonPreview(category, model, 'headstock-shape', value),
    headstockShape: () => getButtonPreview(category, model, 'headstock-shape', value),
    inlays: () => resolveInlay(category, model, value),
    inlayShape: () => getButtonPreview(category, model, 'inlay-shape', value),
    inlayMaterial: () => getButtonPreview(category, model, 'inlay-material', value),
    pickupColor: () => getButtonPreview(category, model, 'pickup-color', value),
    pickupBobbin: () => getButtonPreview(category, model, 'pickup', value),
    pickupColor: () => getButtonPreview(category, model, 'pickup-color', value),
    polePieces: () => getButtonPreview(category, model, 'pole-pieces', value),
    topCoat: () => getButtonPreview(category, model, 'top-coat', value),
    trussRodCover: () => getButtonPreview(category, model, 'truss-cover', value),
    cavityColor: () => getButtonPreview(category, model, 'cavity-color', value),
  }

  const resolver = previewMap[optionKey]
  if (resolver) return resolver()
  
  // Try button preview as fallback
  return getButtonPreview(category, model, optionKey, value)
}

export default {
  cloudImage,
  asset,
  getModelAssetPath,
  resolveSharedAsset,
  resolveModelAsset,
  resolveButtonAsset,
  resolveBodyWoodAsset,
  resolveFingerboardWoodAsset,
  resolveNeckWoodAsset,
  resolveHeadstockWoodAsset,
  resolveTopWoodAsset,
  resolveBodyWoodAsset,
  resolveFinishAsset,
  resolveTopCoatAsset,
  resolveBodyMask,
  resolveBodyBackMask,
  resolveShadows,
  resolveGloss,
  resolveBridgeAsset,
  resolveHeadstockMask,
  resolveHeadstockTuners,
  resolveHeadstockStrings,
  resolveTrussCover,
  resolveNeckMask,
  resolveFrets,
  resolveNut,
  resolveInlay,
   resolvePickupRoute,
   resolvePickupBody,
   resolvePickupPoles,
   resolvePickupBobbinColor,
   resolvePickupBobbinMask,
   resolveFluenceMask,
   resolveSingleCoilBody,
   resolveBodySpecificAsset,
  resolveNeckRearFinishAsset,
  resolveBackNeckAsset,
  resolveBackplateAsset,
   resolveOutputJackAsset,
   resolveOutputJackByColor,
   resolveBackStrapButtonAsset,
   resolveStringFerrulesAsset,
   resolveKnobAsset,
   resolveKnobHardwareBase,
   resolveKnobStyleOverlay,
   resolveSwitchAsset,
   resolveBodyFrontMaskAsset,
   resolveBodyStrapButtonAsset,
   resolveStrapButtonBack,
   resolveStrapButtonFront,
    resolveTunerButtonStyle,
    resolveRearTunerAsset,
    resolveRearHeadstockMask,
    resolveRearBodyMask,
   resolveBackplateScrews,
   resolveTremoloCoverAsset,
  getButtonPreview,
  resolveOptionPreview,
}