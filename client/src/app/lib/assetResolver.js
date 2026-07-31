/**
 * Dynamic Asset Resolver
 * 
 * Automatically resolves asset paths based on category, model, and option selections.
 * Supports both Cloudinary CDN and local file fallback.
 * 
 * Folder structure:
 *   {category}_assets/{model}_assets/
 *     buttons/{option-type}-buttons/
 *     models/all-models/{shared-asset-type}/
 *     models/{model}/{model-specific-asset-type}/
 * 
 * When VITE_CLOUDINARY_CLOUD_NAME is set, assets are served from Cloudinary.
 * Otherwise, assets are served from the local /builder/ directory.
 */

const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) 
  ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME 
  : ''

const USE_CLOUDINARY = Boolean(CLOUD_NAME) && !import.meta.env.DEV

/**
 * Resolve an asset path using either Cloudinary or local files
 */
export function resolveAssetPath(subPath) {
  if (USE_CLOUDINARY) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/${subPath}`
  }
  // Local fallback - serve from public/builder/
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
  return `${category}_assets/${model}_assets`
}

/**
 * Resolve a shared asset path (from models/all-models/)
 */
export function resolveSharedAsset(category, model, assetType, ...subPaths) {
  const base = getModelAssetPath(category, model)
  const path = [base, 'models', 'all-models', assetType, ...subPaths]
    .filter(Boolean)
    .join('/')
  return asset(path)
}

/**
 * Resolve a model-specific asset path (from models/{model}/)
 */
export function resolveModelAsset(category, model, assetType, ...subPaths) {
  const base = getModelAssetPath(category, model)
  const path = [base, 'models', model, assetType, ...subPaths]
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
export function resolveBodyWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'body-woods', `${woodKey}.png`)
}

/**
 * Resolve a fingerboard wood texture path
 */
export function resolveFingerboardWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'fingerboard-woods', `${woodKey}.png`)
}

/**
 * Resolve a neck wood texture path
 */
export function resolveNeckWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'neck-woods', `${woodKey}.png`)
}

/**
 * Resolve a headstock wood texture path
 */
export function resolveHeadstockWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'headstock-woods', `${woodKey}.png`)
}

/**
 * Resolve a top wood texture path
 * Loads from: electric_assets/dc_assets/models/all-models/woods-colors/top-woods/{woodKey}.png
 */
export function resolveTopWoodAsset(category, model, woodKey) {
  return resolveSharedAsset(category, model, 'woods-colors', 'top-woods', `${woodKey}.png`)
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
export function resolveTopCoatAsset(category, model, topCoatKey) {
  return resolveModelAsset(category, model, 'back', 'shadows_highlights', `${topCoatKey}.png`)
}

/**
 * Resolve a bridge asset
 */
export function resolveBridgeAsset(category, model, bridgeKey, colorKey) {
  return resolveSharedAsset(category, model, 'bridges', '6', 'standard', bridgeKey, `${bridgeKey}-${colorKey}.png`)
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
export function resolveInlay(category, model, inlayKey) {
  return resolveSharedAsset(category, model, 'necks', '6-string', 'front', '24-fret-front', 'standard', 'inlays', `${inlayKey}.png`)
}

/**
 * Resolve a neck rear finish overlay
 */
export function resolveNeckRearFinishAsset(category, model, finishKey) {
  return resolveModelAsset(category, model, 'back', 'shadows_highlights', `${finishKey}.png`)
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
export function resolvePickupRoute(category, model, pickupType, colorKey, position) {
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-routes', pickupType, `${colorKey}-${position}.png`)
}

export function resolvePickupBody(category, model, pickupType, colorKey, position) {
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pickup-bodies', pickupType, `${colorKey}-${position}.png`)
}

export function resolvePickupPoles(category, model, pickupType, colorKey, position) {
  return resolveSharedAsset(category, model, 'pickups', '6-string', '24-frets', 'standard', 'pole-pieces', pickupType, `${colorKey}-${position}.png`)
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
    neck: () => resolveNeckWoodAsset(category, model, value),
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
  resolveBodySpecificAsset,
  resolveNeckRearFinishAsset,
  resolveBackNeckAsset,
  resolveBackplateAsset,
  resolveOutputJackAsset,
  resolveBackStrapButtonAsset,
  resolveStringFerrulesAsset,
  resolveKnobAsset,
  resolveSwitchAsset,
  resolveBodyFrontMaskAsset,
  resolveBodyStrapButtonAsset,
  getButtonPreview,
  resolveOptionPreview,
}