// Repointed to Cloudinary collection: cosmoscraft_assets/customization_assets/builder
// (local /builder/bass_models/* files no longer exist)
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME : ''
const USE_CLOUDINARY = Boolean(CLOUD_NAME)

export const cloudImage = (root, path) => {
  if (!USE_CLOUDINARY) {
    return `/builder/customization_assets/${String(path || '').replace(/^\/+/, '')}`
  }
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${root}/${path}`
}

export const bassAsset = (path) => {
  const cleanPath = String(path || '').replace(/^\/+/, '')
  const encodedPath = encodeURI(cleanPath) // encodeURI preserves '/', encodes spaces and other unsafe chars
  if (!USE_CLOUDINARY) {
    return `/builder/customization_assets/${encodedPath}`
  }
  return cloudImage('cosmoscraft_assets/customization_assets/builder', encodedPath)
}

export const bassWoodAsset = (path) => {
  const cleanPath = String(path || '').replace(/^\/+/, '')
  const encodedPath = encodeURI(cleanPath)
  if (!USE_CLOUDINARY) {
    return `/builder/customization_assets/${encodedPath}`
  }
  return cloudImage('cosmoscraft_assets/customization_assets/builder', encodedPath)
}
// Resolve a model-specific bass asset under customization_assets/builder/bass/{model}/
export const bassModelAsset = (model, ...subPaths) => {
  const tail = subPaths.filter(Boolean).join('/')
  return bassAsset(`bass/${model}/${tail}`)
}

const specs = () => ({ size: '', dimensions: '', material: '', notes: '' })
// Reuse the new customization schema from the electric builder.
// Bass-conditional: STRING_COUNT_OPTIONS (6/7/8) is omitted (bass uses 4/5/6).
import {
  DEXTERITY_OPTIONS,
  STRING_COUNT_OPTIONS,
  MULTISCALE_OPTIONS,
  SCALE_LENGTH_OPTIONS,
  CASE_OPTIONS,
  TOP_WOOD_OPTIONS,
  FINISH_TYPE_OPTIONS,
  TOP_COAT_OPTIONS,
  BURST_FINISH_OPTIONS,
  NECK_CONSTRUCTION_OPTIONS,
  FRET_OPTIONS,
  NECK_REAR_FINISH_OPTIONS,
  HEADSTOCK_SHAPE_OPTIONS,
  TRUSS_ROD_COVER_OPTIONS,
  ELECTRONICS_TYPE_OPTIONS,
  PICKUP_CONFIGURATION_OPTIONS,
  PICKUP_MODEL_BRIDGE_OPTIONS,
  PICKUP_MODEL_MIDDLE_OPTIONS,
  PICKUP_MODEL_NECK_OPTIONS,
  PICKUP_COLOR_OPTIONS,
  PICKUP_POLE_COLOR_OPTIONS,
  CONTROLS_OPTIONS,
  SADDLE_OPTIONS,
  NUT_OPTIONS,
  TUNING_OPTIONS,
  TUNING_DISCLAIMER,
  STRING_BRAND_OPTIONS,
  OUTPUT_JACK_OPTIONS,
  STRAP_BUTTON_OPTIONS,
  TUNER_BUTTON_OPTIONS,
   ELECTRONICS_CAVITY_COVER_OPTIONS,
   TREMOLO_COVER_OPTIONS_BY_BRIDGE,
   KNOB_STYLE_OPTIONS,
} from './guitarBuilderData.js'

export {
  DEXTERITY_OPTIONS,
  MULTISCALE_OPTIONS,
  STRING_COUNT_OPTIONS,
  SCALE_LENGTH_OPTIONS,
  CASE_OPTIONS,
  TOP_WOOD_OPTIONS,
  FINISH_TYPE_OPTIONS,
  TOP_COAT_OPTIONS,
  BURST_FINISH_OPTIONS,
  NECK_CONSTRUCTION_OPTIONS,
  FRET_OPTIONS,
  NECK_REAR_FINISH_OPTIONS,
  HEADSTOCK_SHAPE_OPTIONS,
  TRUSS_ROD_COVER_OPTIONS,
  ELECTRONICS_TYPE_OPTIONS,
  PICKUP_CONFIGURATION_OPTIONS,
  PICKUP_MODEL_BRIDGE_OPTIONS,
  PICKUP_MODEL_MIDDLE_OPTIONS,
  PICKUP_MODEL_NECK_OPTIONS,
  PICKUP_COLOR_OPTIONS,
  PICKUP_POLE_COLOR_OPTIONS,
  CONTROLS_OPTIONS,
  SADDLE_OPTIONS,
  NUT_OPTIONS,
  TUNING_OPTIONS,
  TUNING_DISCLAIMER,
  STRING_BRAND_OPTIONS,
  OUTPUT_JACK_OPTIONS,
  STRAP_BUTTON_OPTIONS,
  TUNER_BUTTON_OPTIONS,
  ELECTRONICS_CAVITY_COVER_OPTIONS,
  TREMOLO_COVER_OPTIONS_BY_BRIDGE,
  KNOB_STYLE_OPTIONS,
}

export const BASS_SCALE_LENGTH_OPTIONS = {
  '34': { label: '34"', note: 'Standard bass scale', price: 0, specs: specs() },
  '35': { label: '35"', note: 'Extended scale (5-string)', price: 0, specs: specs() },
  '30': { label: '30"', note: 'Short scale', price: 0, specs: specs() },
  '32': { label: '32"', note: 'Short scale', price: 0, specs: specs() },
}

// Keep catalog logic optional: core rendering uses static `bassAsset(...)` paths
// so bass previews work even if no external builder folder exists.
const RAW_BASS_ASSET_MODULES = {}
const RAW_SHARED_BASS_ASSET_MODULES = {}

const createEmptyCatalog = () => ({ all: [], front: {}, back: {} })
const DEFAULT_BASS_MODELS = ['vader', 'pb', 'jb']
const ROOT_CATEGORY_KEY = '__root'

const normalizeSegment = (segment = '') => String(segment).trim().toLowerCase().replace(/\\/g, '/')
const getStem = (assetPath = '') => {
  const fileName = String(assetPath).split('/').pop() || ''
  return fileName.replace(/\.[^.]+$/, '').toLowerCase()
}

const toCatalogRelativePath = (globPath = '') => {
  const normalized = normalizeSegment(globPath)
  const marker = '/builder/bass_models/'
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex === -1) return null
  return normalized.slice(markerIndex + marker.length)
}

const ensureModelCatalog = (catalogs, model) => {
  if (!catalogs[model]) {
    catalogs[model] = createEmptyCatalog()
  }
  return catalogs[model]
}

const BASS_MODEL_ENTRY_INDEX = {}
const SHARED_BASS_ENTRY_INDEX = []

for (const [globPath, importedUrl] of Object.entries(RAW_BASS_ASSET_MODULES)) {
  const relativePath = toCatalogRelativePath(globPath)
  if (!relativePath) continue

  const segments = relativePath.split('/').filter(Boolean)
  if (segments.length < 4 || segments[0] !== 'bass') continue

  const model = segments[1]
  const view = segments[2]
  if (view !== 'front' && view !== 'back') continue

  const fileName = segments[segments.length - 1]
  const categorySegments = segments.slice(3, -1)
  const category = categorySegments.length ? categorySegments.join('/') : ROOT_CATEGORY_KEY

  const modelCatalog = ensureModelCatalog(BASS_MODEL_ENTRY_INDEX, model)
  if (!modelCatalog[view][category]) {
    modelCatalog[view][category] = []
  }

  const assetUrl = typeof importedUrl === 'string' ? importedUrl : bassAsset(relativePath)
  const entry = {
    relativePath,
    fileName,
    stem: getStem(relativePath),
    url: assetUrl,
  }

  modelCatalog[view][category].push(entry)
  modelCatalog.all.push(entry)
}

for (const [globPath, importedUrl] of Object.entries(RAW_SHARED_BASS_ASSET_MODULES)) {
  const relativePath = toCatalogRelativePath(globPath)
  if (!relativePath) continue

  const segments = relativePath.split('/').filter(Boolean)
  if (segments.length < 2 || segments[0] !== 'all-models') continue

  const fileName = segments[segments.length - 1]
  const assetUrl = typeof importedUrl === 'string' ? importedUrl : bassAsset(relativePath)
  SHARED_BASS_ENTRY_INDEX.push({
    relativePath,
    fileName,
    stem: getStem(relativePath),
    url: assetUrl,
  })
}

for (const model of DEFAULT_BASS_MODELS) {
  ensureModelCatalog(BASS_MODEL_ENTRY_INDEX, model)
}

const mapViewEntriesToUrls = (viewCatalog) =>
  Object.fromEntries(
    Object.entries(viewCatalog).map(([category, entries]) => [category, entries.map(entry => entry.url)]),
  )

export const BASS_MODEL_CATALOG = Object.fromEntries(
  Object.entries(BASS_MODEL_ENTRY_INDEX).map(([model, catalog]) => [
    model,
    {
      all: catalog.all.map(entry => entry.url),
      front: mapViewEntriesToUrls(catalog.front),
      back: mapViewEntriesToUrls(catalog.back),
    },
  ]),
)

export const BASS_SHARED_ASSET_CATALOG = {
  all: SHARED_BASS_ENTRY_INDEX.map(entry => entry.url),
}

const getCatalogEntries = (model, view, category = '') => {
  const normalizedModel = normalizeSegment(model)
  const normalizedView = normalizeSegment(view)
  const normalizedCategory = normalizeSegment(category)
  const modelCatalog = BASS_MODEL_ENTRY_INDEX[normalizedModel]
  if (!modelCatalog) return []

  const viewCatalog = modelCatalog[normalizedView]
  if (!viewCatalog) return []
  if (!normalizedCategory) {
    return Object.values(viewCatalog).flat()
  }

  const entries = viewCatalog[normalizedCategory]
  return Array.isArray(entries) ? entries : []
}

function resolveBassCatalogAsset(model, view, category = '', options = {}) {
  const { strings, preferTokens = [] } = options
  const entries = getCatalogEntries(model, view, category)
  if (!entries.length) return null

  const normalizedTokens = preferTokens.map(t => normalizeSegment(t)).filter(Boolean)
  const stringToken = strings ? String(strings) : null
  const stringTokenMatcher = stringToken
    ? new RegExp(`(?:^|[\\/_-])${stringToken}(?:$|[\\/_\\.-])`)
    : null
  const hasAnyStringToken = /(?:^|[\\/_-])(4|5|6)(?:$|[\\/_\\.-])/

  const scored = entries
    .filter(entry => {
      if (!stringTokenMatcher) return true
      const searchTarget = `${entry.relativePath} ${entry.stem}`
      if (!hasAnyStringToken.test(searchTarget)) return true
      return stringTokenMatcher.test(searchTarget)
    })
    .map(entry => {
      const searchTarget = `${entry.relativePath} ${entry.stem}`
      const tokenScore = normalizedTokens.reduce((score, token) => (searchTarget.includes(token) ? score + 1 : score), 0)
      return { entry, tokenScore }
    })
    .sort((a, b) => b.tokenScore - a.tokenScore)

  return scored[0]?.entry?.url ?? entries[0]?.url ?? null
}

function resolveBassCatalogVariant(model, view, category = '', strings, colorKey, preferTokens = []) {
  const tokens = [...preferTokens]
  if (colorKey) tokens.push(colorKey)
  return resolveBassCatalogAsset(model, view, category, { strings, preferTokens: tokens })
}

const hasStringToken = (value) => /(?:^|[\\/_-])(4|5|6)(?:$|[\\/_\\.-])/.test(value)

function resolveSharedBassAsset(scope = '', options = {}) {
  const {
    strings,
    preferTokens = [],
    requiredTokens = [],
    rejectTokens = [],
  } = options

  const normalizedScope = normalizeSegment(scope)
  const normalizedPrefer = preferTokens.map(t => normalizeSegment(t)).filter(Boolean)
  const normalizedRequired = requiredTokens.map(t => normalizeSegment(t)).filter(Boolean)
  const normalizedReject = rejectTokens.map(t => normalizeSegment(t)).filter(Boolean)
  const stringToken = strings ? String(strings) : null
  const stringTokenMatcher = stringToken
    ? new RegExp(`(?:^|[\\/_-])${stringToken}(?:$|[\\/_\\.-])`)
    : null

  const scopedEntries = SHARED_BASS_ENTRY_INDEX.filter((entry) =>
    !normalizedScope || entry.relativePath.includes(`/${normalizedScope}/`) || entry.relativePath.endsWith(`/${normalizedScope}`),
  )
  if (!scopedEntries.length) return null

  const filtered = scopedEntries.filter((entry) => {
    const searchTarget = `${entry.relativePath} ${entry.stem}`
    if (normalizedRequired.some(token => !searchTarget.includes(token))) return false
    if (normalizedReject.some(token => searchTarget.includes(token))) return false

    if (stringTokenMatcher) {
      if (!hasStringToken(searchTarget)) return true
      return stringTokenMatcher.test(searchTarget)
    }
    return true
  })
  if (!filtered.length) return null

  const scored = filtered
    .map((entry) => {
      const searchTarget = `${entry.relativePath} ${entry.stem}`
      const tokenScore = normalizedPrefer.reduce(
        (score, token) => (searchTarget.includes(token) ? score + 1 : score),
        0,
      )
      return { entry, tokenScore }
    })
    .sort((a, b) => b.tokenScore - a.tokenScore)

  return scored[0]?.entry?.url ?? filtered[0]?.url ?? null
}

function mapCatalogByStem(model, view, category = '') {
  const entries = getCatalogEntries(model, view, category)
  return entries.reduce((acc, entry) => {
    acc[entry.stem] = entry.url
    return acc
  }, {})
}

function pickColorVariants(model, view, category = '', strings) {
  const colorKeys = ['chrome', 'black', 'gold']
  const variants = colorKeys.reduce((acc, color) => {
    const variantPath = resolveBassCatalogVariant(model, view, category, strings, color)
    if (variantPath) acc[color] = variantPath
    return acc
  }, {})
  return Object.keys(variants).length ? variants : null
}

export const BASS_DEFAULT_CONFIG = {
  bassType: 'vader',
  bodyWood: 'alder',
  bodyFinish: 'none',
  neck: 'plainMaple',
  fingerboardRadius: 'bass14inch',
  fretboard: 'rosewood',
  headstockWood: 'maple',
  headstockStyle: 'ch',
  neckStyle: 'roundBottom',
  inlays: 'whiteDots',
  frets: 'stainlessMedJumbo',
  neckRearFinish: 'tungOilNeck',
  bridge: 'standard',
  pickguard: 'none',
  knobs: 'black',
  pickups: 'standard',
  pickupTypeStyle: 'j',
  hardware: 'chrome',
  strings: '4',
  pickupConfig: 'j',
  logo: 'standard',
  backplate: 'standard',
  pickupScrews: 'black',
  controlPlate: 'black',
  // --- New customization options ---
  dexterity: 'right',
  multiscale: 'off',
  scaleLength: '34',
  case: 'none',
  bevel: 'off',
  topWood: 'none',
  topCoat: 'clearGloss',
  burstFinish: 'none',
  neckConstruction: '1piece',
  inlayShape: 'dots',
  inlayMaterial: 'motherOfPearl',
   headstockShape: '6in',
  trussRodCover: 'black',
  electronicsType: 'passive',
   pickupConfiguration: 'hh',
  bridgePickupModel: 'beryllium',
  middlePickupModel: 'none',
  neckPickupModel: 'beryllium',
    pickupColor: 'bobbins',
    pickupColorVariant: 'black',
    pickupPaintedColor: '#000000',
    pickupWoodType: 'black',
    pickupPoleColor: 'black',
    vaderBridgePickup: 'radiumHumbucker',
    vaderNeckPickup: 'radiumHumbucker',
    vaderPickupColor: 'none',
    vaderPickupColorRgb: '#000000',
    vaderKnobs: 'hardwareColor',
    vaderStrapButtons: 'standard',
    vaderElectronicsCavityCover: 'black',
    controls: 'off',
    saddle: 'chrome',
    nut: 'blackGraphTech',
    tuning: 'eStandard',
    stringBrand: 'elixir1046',
    outputJack: 'off',
    strapButtons: 'standard',
    tunerButtons: 'none',
    electronicsCavityCover: 'black',
    tremoloCover: null,
    // Vader-specific finish/wood options
    finishColor: 'none',
    threePieceBody: 'off',
    burstEdges: 'none',
}

export const BASS_TYPE_OPTIONS = [
  { id: 'vader', label: 'Vader', note: 'Modern aggressive bass shape' },
  { id: 'pb', label: 'Precision', note: 'Classic P-bass style' },
  { id: 'jb', label: 'Jazz', note: 'Modern J-bass style' },
]

// Base price in PHP (Philippine Peso) - approximately 1500 USD equivalent
export const BASS_BASE_PRICE = 35000

export const BASS_BODY_OPTIONS = {
  vader: {
    label: 'Vader',
    note: 'Modern aggressive bass shape',
    bodySrc: resolveBassCatalogAsset('vader', 'front', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('vader', 'front/masks/bodymask.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  pb: {
    label: 'Precision',
    note: 'Classic precision shape',
    bodySrc: resolveBassCatalogAsset('pb', 'front', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('pb', 'front/masks/bodymask.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  jb: {
    label: 'Jazz',
    note: 'Modern jazz shape',
    bodySrc: resolveBassCatalogAsset('jb', 'front', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('jb', 'front/masks/bodymask.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}


export const BASS_BODY_WOOD_OPTIONS = {
  alder: {
    label: 'Alder',
    note: 'Bright even grain',
    texture: bassAsset('all-models/woods-colors/bass/body-woods/ald.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  blackLimba: {
    label: 'Black Limba',
    note: 'Warm resonant grain',
    texture: bassAsset('all-models/woods-colors/bass/body-woods/lmb.png'),
    price: 4499, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  mahogany: {
    label: 'Mahogany',
    note: 'Alt ash grain pattern',
    texture: bassAsset('all-models/woods-colors/bass/body-woods/mah.png'),
    price: 4499, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  swampAsh: {
    label: 'Swamp Ash',
    note: 'Rich warm tone',
    texture: bassAsset('all-models/woods-colors/bass/body-woods/ash2.png'),
    price: 7199, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  walnut: {
    label: 'Walnut',
    note: 'Deep dark wood',
    texture: bassAsset('all-models/woods-colors/bass/body-woods/wal.png'),
    price: 6599, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedSwampAsh: {
    label: 'Roasted Swamp Ash',
    note: 'Dark roasted finish',
    texture: bassAsset('all-models/woods-colors/bass/body-woods/ash1.png'),
    price: 7799, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_TOP_WOOD_OPTIONS = {
  none: {
    label: 'None',
    note: 'No top wood',
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  'antique-ash': {
    label: 'Antique Ash',
    note: 'Vintage ash top',
    texture: bassAsset('all-models/woods-colors/top-woods/antique-ash.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  'blacked-out-ash': {
    label: 'Blacked Out Ash',
    note: 'Dark ash top',
    texture: bassAsset('all-models/woods-colors/top-woods/blacked-out-ash.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  kalantas: {
    label: 'Kalantas',
    note: 'Exotic kalantas top',
    texture: bassAsset('all-models/woods-colors/top-woods/kalantas-wood.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  kamagong: {
    label: 'Kamagong',
    note: 'Dense kamagong top',
    texture: bassAsset('all-models/woods-colors/top-woods/kamagong-wood.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  mango: {
    label: 'Mango Wood',
    note: 'Tropical mango top',
    texture: bassAsset('all-models/woods-colors/top-woods/mango-wood.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  narra: {
    label: 'Narra',
    note: 'Premium narra top',
    texture: bassAsset('all-models/woods-colors/top-woods/narra-wood.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  'ph-mahogany': {
    label: 'Philippine Mahogany',
    note: 'Classic mahogany top',
    texture: bassAsset('all-models/woods-colors/top-woods/ph-mahogany.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  'swamp-ash': {
    label: 'Swamp Ash',
    note: 'Light swamp ash top',
    texture: bassAsset('all-models/woods-colors/top-woods/swamp-ash.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_BODY_FINISH_OPTIONS = {
  none: {
    label: 'None',
    note: 'Raw wood texture',
    texture: null,
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  // Solid Colors
  black: {
    label: 'Jet Black',
    note: 'Opaque black finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/black.png'),
    color: '#1a1a1a',
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  white: {
    label: 'Classic White',
    note: 'Clean opaque finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/white-white.png'),
    color: '#f5f5f5',
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  classicWhite: {
    label: 'Classic White',
    note: 'Pure white finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/classic-white.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  bloodRed: {
    label: 'Blood Red',
    note: 'Deep crimson finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/blood-red.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ferrariRed: {
    label: 'Ferrari Red',
    note: 'Iconic racing red',
    texture: bassAsset('all-models/woods-colors/colors/solids/ferrari-red.png'),
    price: 2400, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  deepPink: {
    label: 'Deep Pink',
    note: 'Rich pink finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/deep-pink.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  hotPink: {
    label: 'Hot Pink',
    note: 'Vibrant pink tone',
    texture: bassAsset('all-models/woods-colors/colors/solids/hot-pink.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  lightPink: {
    label: 'Light Pink',
    note: 'Pastel pink finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/light-pink.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  royalBlue: {
    label: 'Royal Blue',
    note: 'Deep royal blue',
    texture: bassAsset('all-models/woods-colors/colors/solids/royal-blue.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  lightBlue: {
    label: 'Light Blue',
    note: 'Soft sky blue',
    texture: bassAsset('all-models/woods-colors/colors/solids/light-blue.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  grabberBlue: {
    label: 'Grabber Blue',
    note: 'Classic grabber blue',
    texture: bassAsset('all-models/woods-colors/colors/solids/grabber-blue.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  primerGray: {
    label: 'Primer Gray',
    note: 'Industrial primer gray',
    texture: bassAsset('all-models/woods-colors/colors/solids/primer-gray.png'),
    price: 1500, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  lavender: {
    label: 'Lavender',
    note: 'Soft lavender tone',
    texture: bassAsset('all-models/woods-colors/colors/solids/lavender.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  purple: {
    label: 'Purple',
    note: 'Rich purple finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/purple.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  odGreen: {
    label: 'OD Green',
    note: 'Olive drab green',
    texture: bassAsset('all-models/woods-colors/colors/solids/od-green.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  surfGreen: {
    label: 'Surf Green',
    note: 'Wet surf green',
    texture: bassAsset('all-models/woods-colors/colors/solids/surf-green.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  seafoamGreen: {
    label: 'Seafoam Green',
    note: 'Vintage seafoam',
    texture: bassAsset('all-models/woods-colors/colors/solids/seafoam-green.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  britishRacingGreen: {
    label: 'British Racing Green',
    note: 'Classic racing green',
    texture: bassAsset('all-models/woods-colors/colors/solids/british-racing-green.png'),
    price: 2400, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  cosmosOrange: {
    label: 'Cosmos Orange',
    note: 'Racing orange finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/kiesel-racing-orange.png'),
    price: 2400, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  mclarenYellow: {
    label: 'McLaren Yellow',
    note: 'Bright yellow finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/mclaren-yellow.png'),
    price: 2400, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  tropicTurquoise: {
    label: 'Tropic',
    note: 'Tropical turquoise',
    texture: bassAsset('all-models/woods-colors/colors/solids/tropic.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  // Translucent Colors
  transBlack: {
    label: 'Trans Black',
    note: 'Tinted translucent finish',
    texture: bassAsset('all-models/woods-colors/colors/transluscents/trans-black.png'),
    price: 2700, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  vintageSunburst: {
    label: 'Vintage Sunburst',
    note: 'Classic sunburst finish',
    texture: null,
    color: '#8B4513',
    price: 2400, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  tobaccoBurst: {
    label: 'Tobacco Burst',
    note: 'Rich tobacco finish',
    texture: null,
    color: '#8B5A2B',
    price: 2700, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_NECK_OPTIONS = {
  lmbn: {
    label: 'Limbano',
    note: 'Bright limbano neck',
    group: '1piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/lmbn.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  mahn: {
    label: 'Mahogany',
    note: 'Warm mahogany neck',
    group: '1piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/mahn.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  plainMaple: {
    label: 'Plain Maple',
    note: 'Bright plain maple',
    group: '1piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/plain-maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  waln: {
    label: 'Walnut',
    note: 'Warm walnut neck',
    group: '1piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/waln.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '3mm': {
    label: '3 Piece Maple',
    note: 'Three piece all-maple',
    group: '3piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/3mm.png'),
    price: 800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '3mp': {
    label: '3 Piece Maple w/ Purple Heart',
    note: 'Maple with one purple heart stripe',
    group: '3piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/3mp.png'),
    price: 1100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '3mw': {
    label: '3 Piece Maple w/ Walnut',
    note: 'Maple with one walnut stripe',
    group: '3piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/3mw.png'),
    price: 1100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '3wp': {
    label: '3 Piece Walnut w/ Purple Heart',
    note: 'Walnut with one purple heart stripe',
    group: '3piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/3wp.png'),
    price: 1100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5lm': {
    label: '5 Piece Black Limba w/ 2 Maple',
    note: 'Black limba with two maple stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5lm.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5h': {
    label: '5 Piece Mahogany w/ 2 Maple',
    note: 'Mahogany with two maple stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5h.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5ml': {
    label: '5 Piece Maple w/ 2 Black Limba',
    note: 'Maple with two black limba stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5ml.png'),
    price: 1800, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5mp': {
    label: '5 Piece Maple w/ 2 Purple Heart',
    note: 'Maple with two purple heart stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5mp.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5mw': {
    label: '5 Piece Maple w/ 2 Walnut',
    note: 'Maple with two walnut stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5mw.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5wm': {
    label: '5 Piece Walnut w/ 2 Maple',
    note: 'Walnut with two maple stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5wm.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5wp': {
    label: '5 Piece Walnut w/ 2 Purple Heart',
    note: 'Walnut with two purple heart stripes',
    group: '5piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/5wp.png'),
    price: 2400, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '7mwh': {
    label: '7 Piece Maple / Walnut / Mahogany',
    note: 'Maple with walnut, mahogany and maple stripes',
    group: '7piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/7mwh.png'),
    price: 2900, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '7wpm': {
    label: '7 Piece Walnut / Purple Heart / Maple',
    note: 'Walnut with purple heart, maple and walnut stripes',
    group: '7piece',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/7wpm.png'),
    price: 3100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_FINGERBOARD_RADIUS_OPTIONS = {
  bass14inch: {
    label: 'Bass 14"',
    note: 'Standard bass fingerboard radius (default)',
    price: 0, specs: { size: '14"', dimensions: '', material: '', notes: '' }
  },
  bass16inch: {
    label: 'Bass 16"',
    note: 'Slightly flatter feel',
    price: 0, specs: { size: '16"', dimensions: '', material: '', notes: '' }
  },
  bass20inch: {
    label: 'Bass 20"',
    note: 'Flatter modern radius',
    price: 0, specs: { size: '20"', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_FRETBOARD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Clean and bright',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Classic dark board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/rosewood.png'),
    price: 4199, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ebony: {
    label: 'Ebony',
    note: 'Snappy premium board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/ebony.png'),
    price: 5699, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  royalEbony: {
    label: 'Royal Ebony',
    note: 'Rich ebony tone',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/royal-ebony.png'),
    price: 5999, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  flamedMaple: {
    label: 'Flamed Maple',
    note: 'Figured maple board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/flamed-maple.png'),
    price: 7199, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  birdseyeMaple: {
    label: 'Birdseye Maple',
    note: 'Premium speckled maple',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/birdseye-maple.png'),
    price: 7499, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedFlame: {
    label: 'Roasted Flame',
    note: 'Roasted flamed maple',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/roasted-flame.png'),
    price: 8099, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedBirdseye: {
    label: 'Roasted Birdseye',
    note: 'Roasted birdseye maple',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/roasted-birdseye.png'),
    price: 8099, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  zebrawood: {
    label: 'Zebrawood',
    note: 'Striped exotic board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/zebrawood.png'),
    price: 7799, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  richliteMapleValley: {
    label: 'Richlite Maple Valley',
    note: 'Composite richlite board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/richlite-maple-valley.png'),
    price: 4499, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  efb: {
    label: 'EFB',
    note: 'Exotic wood board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/efb.png'),
    price: 6599, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_NECK_MASK = bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/masks/mask.png')
export const BASS_NECK_FRETS = {
  stainless: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/frets/stainless.png'),
  gold: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/frets/gold.png'),
}
export const BASS_NECK_NUT = {
  white: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/nut/white.png'),
  black: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/nut/black.png'),
}

export const BASS_FRET_OPTIONS = {
  stainlessMedJumbo: {
    label: 'Stainless Med-Jumbo',
    note: '0.48" H × 0.103" W (default)',
    price: 0, specs: { size: '0.48" H × 0.103" W', dimensions: '', material: 'Stainless', notes: 'Med-Jumbo' }
  },
  stainlessRegular: {
    label: 'Stainless Regular',
    note: '0.043" H × 0.080" W',
    price: 0, specs: { size: '0.043" H × 0.080" W', dimensions: '', material: 'Stainless', notes: 'Regular' }
  },
  stainlessJumbo: {
    label: 'Stainless Jumbo',
    note: '0.055" H × 0.110" W',
    price: 0, specs: { size: '0.055" H × 0.110" W', dimensions: '', material: 'Stainless', notes: 'Jumbo' }
  },
  fretless: {
    label: 'Fretless Fingerboard',
    note: 'No frets — smooth playing surface',
    price: 1200, specs: { size: '', dimensions: '', material: '', notes: 'Fretless' }
  },
}

export const BASS_NECK_REAR_FINISH_OPTIONS = {
  // Clear Gloss Top Coat
  clearGlossNeck: {
    label: 'Clear Gloss Neck',
    note: 'Glossy clear coat on neck rear',
    visibleTopCoats: ['clearGloss', 'rawTone'],
    assetGroup: 'gloss', price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  tungOilNeck: {
    label: 'Tung Oil Neck',
    note: 'Tung oil finish on neck rear',
    visibleTopCoats: ['clearGloss', 'rawTone', 'satinMatte'],
    assetGroup: 'tungOil', price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  satinMatteNeck: {
    label: 'Satin Matte Neck',
    note: 'Matte satin finish on neck rear',
    visibleTopCoats: ['clearGloss', 'satinMatte'],
    assetGroup: 'satin', price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  // Satin Matte Top Coat only
  matteTungOilNeck: {
    label: 'Matte Tung Oil Neck',
    note: 'Matte tung oil finish on neck rear',
    visibleTopCoats: ['satinMatte'],
    assetGroup: 'matteTungOil', price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_HEADSTOCK_WOOD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright headstock wood',
    texture: bassAsset('all-models/woods-colors/bass/neck-woods/plain-maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Warm headstock wood',
    texture: bassAsset('all-models/woods-colors/bass/neck-woods/waln.png'),
    price: 1500, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ebony: {
    label: 'Ebony',
    note: 'Dark premium wood',
    texture: bassAsset('all-models/woods-colors/bass/neck-woods/rfmn.png'),
    price: 2100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_INLAY_SHAPE_OPTIONS = {
  dots: { folder: 'id', label: 'Dots', note: 'Classic dot inlays', price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
  diamonds: { folder: 'idia', label: 'Diamonds', note: 'Diamond inlays', price: 30, specs: { size: '', dimensions: '', material: '', notes: '' } },
  blocks: { folder: 'ib', label: 'Blocks', note: 'Block inlays', price: 30, specs: { size: '', dimensions: '', material: '', notes: '' } },
}

export const BASS_INLAY_MATERIAL_OPTIONS = {
  motherOfPearl: { code: 'imp', label: 'Mother of Pearl', note: 'Classic mother of pearl', price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
  green: { code: 'iag', label: 'Green Acrylic', note: 'Green acrylic inlay', price: 35, specs: { size: '', dimensions: '', material: '', notes: '' } },
  pink: { code: 'iap', label: 'Pink', note: 'Pink acrylic inlay', price: 35, specs: { size: '', dimensions: '', material: '', notes: '' } },
  red: { code: 'iar', label: 'Red', note: 'Red acrylic inlay', price: 35, specs: { size: '', dimensions: '', material: '', notes: '' } },
  white: { code: 'iaw', label: 'White', note: 'White inlay', price: 35, specs: { size: '', dimensions: '', material: '', notes: '' } },
  black: { code: 'iab', label: 'Black', note: 'Black inlay', price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
  abalone: { code: 'ia', label: 'Abalone', note: 'Shell-like abalone material', price: 35, specs: { size: '', dimensions: '', material: '', notes: '' } },
  luminlay: { code: 'iaw', label: 'Luminlay', note: 'Glow-in-the-dark material', price: 35, specs: { size: '', dimensions: '', material: '', notes: '' } },
}

export const BASS_INLAY_OPTIONS = {
  whiteDots: {
    label: 'White Dots',
    note: 'Classic white dot inlays',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/id/white.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  luminlay: {
    label: 'Luminlay Dots',
    note: 'Glow-in-the-dark inlays',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/id/luminlay.png'),
    price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  blackDots: {
    label: 'Black Dots',
    note: 'Subtle black dot inlays',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/ib/white.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  diamondLuminlay: {
    label: 'Diamond Luminlay',
    note: 'Diamond-shaped glow inlays',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/idia/luminlay.png'),
    price: 60, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  diamondWhite: {
    label: 'Diamond White',
    note: 'Diamond-shaped white inlays',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/idia/white.png'),
    price: 50, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

// Headstock Style Options from all-models
export const BASS_HEADSTOCK_STYLE_OPTIONS = {
  ch: {
    label: 'Classic Headstock',
    note: 'Traditional design',
    src: bassAsset('all-models/headstocks/bass/4-string/ch/'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  chr: {
    label: 'Classic Reverse',
    note: 'Classic reverse design',
    src: bassAsset('all-models/headstocks/bass/4-string/chr/'),
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gt4: {
    label: 'GT-4',
    note: 'Modern GT-4 design',
    src: bassAsset('all-models/headstocks/bass/4-string/gt4/'),
    price: 50, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gt4r: {
    label: 'GT-4 Reverse',
    note: 'Modern reverse design',
    src: bassAsset('all-models/headstocks/bass/4-string/gt4r/'),
    price: 50, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  headless: {
    label: 'Headless',
    note: 'No headstock',
    src: null,
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

// Neck Style Options from all-models
export const BASS_NECK_STYLE_OPTIONS = {
  roundBottom: {
    label: 'Round Bottom',
    note: 'Comfortable round profile',
    src: bassAsset('all-models/necks/bass/4-string/front/'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

// Pickup Style Options from all-models
export const BASS_PICKUP_TYPE_STYLE_OPTIONS = {
  j: {
    label: 'J-Style Pickup',
    note: 'Single coil J-pickup',
    src: bassAsset('all-models/pickups/bass/j/'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  p: {
    label: 'P-Style Pickup',
    note: 'Split coil P-pickup',
    src: bassAsset('all-models/pickups/bass/p/'),
    price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  k: {
    label: 'K-Style Pickup',
    note: 'Modern K-style design',
    src: bassAsset('all-models/pickups/bass/k/'),
    price: 35, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  acf: {
    label: 'ACF Pickup',
    note: 'Compact ACF design',
    src: bassAsset('all-models/pickups/bass/acf/'),
    price: 45, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

// Backplate Options - Back customization
export const BASS_BACKPLATE_OPTIONS = {
  vader: {
    standard: {
      label: 'Standard',
      note: 'Standard back panel',
      src: resolveBassCatalogAsset('vader', 'back', 'backplates', { strings: '4', preferTokens: ['battery', 'compartment'] }) ?? bassModelAsset('vader', 'back/backplates/battery-compartment.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    acf: {
      label: 'ACF Battery Plate',
      note: 'ACF rear battery compartment',
      src: resolveBassCatalogAsset('vader', 'back', 'backplates', { strings: '4', preferTokens: ['battery', 'compartment'] }) ?? bassModelAsset('vader', 'back/backplates/battery-compartment-acf.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  pb: {
    standard: {
      label: 'Standard',
      note: 'Standard back panel',
      src: resolveBassCatalogAsset('pb', 'back', 'backplates', { strings: '4', preferTokens: ['battery', 'compartment'] }) ?? bassModelAsset('pb', 'back/backplates/battery-compartment.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended: {
      label: 'Extended 5-String',
      note: 'Extended 5-string back panel',
      src: resolveBassCatalogAsset('pb', 'back', 'backplates', { strings: '5', preferTokens: ['battery', 'compartment'] }) ?? bassModelAsset('pb', 'back/backplates/battery-compartment-5.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    standard: {
      label: 'Standard',
      note: 'Standard back panel',
      src: resolveBassCatalogAsset('jb', 'back', 'backplates', { strings: '4', preferTokens: ['battery', 'compartment'] }) ?? bassModelAsset('jb', 'back/backplates/battery-compartment.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended: {
      label: 'Extended 5-String',
      note: 'Extended 5-string back panel',
      src: resolveBassCatalogAsset('jb', 'back', 'backplates', { strings: '5', preferTokens: ['battery', 'compartment'] }) ?? bassModelAsset('jb', 'back/backplates/battery-compartment-5.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  }
}

// Pickup Screw Options
export const BASS_PICKUP_SCREW_OPTIONS = {
  vader: {
    black: { label: 'Black Screws', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    chrome: { label: 'Chrome Screws', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    gold: { label: 'Gold Screws', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
  },
  pb: {
    black: {
      label: 'Black Screws',
      note: 'Black pickup mounting screws',
      src: bassModelAsset('pb', 'front/pickguard/screws-black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome Screws',
      note: 'Chrome pickup mounting screws',
      src: bassModelAsset('pb', 'front/pickguard/screws-chrome.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold Screws',
      note: 'Gold pickup mounting screws',
      src: bassModelAsset('pb', 'front/pickguard/screws-gold.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    black: {
      label: 'Black Screws',
      note: 'Black pickup mounting screws',
      src: bassModelAsset('jb', 'front/pickguard/screws-black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome Screws',
      note: 'Chrome pickup mounting screws',
      src: bassModelAsset('jb', 'front/pickguard/screws-chrome.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold Screws',
      note: 'Gold pickup mounting screws',
      src: bassModelAsset('jb', 'front/pickguard/screws-gold.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  }
}

// Control Plate Options
export const BASS_CONTROL_PLATE_OPTIONS = {
  black: {
    label: 'Black Control Plate',
    note: 'Black control plate',
    src: bassModelAsset('jb', 'front/pickguard/control-black.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  chrome: {
    label: 'Chrome Control Plate',
    note: 'Chrome control plate',
    src: bassModelAsset('jb', 'front/pickguard/control-chrome.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gold: {
    label: 'Gold Control Plate',
    note: 'Gold control plate',
    src: bassModelAsset('jb', 'front/pickguard/control-gold.png'),
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_BRIDGE_OPTIONS = {
  vader: {
    standard: {
      label: 'Standard',
      note: 'Standard bridge',
      assets: {
        chrome: resolveBassCatalogVariant('vader', 'front', 'bridges', '4', 'chrome', ['bridge']) ?? bassModelAsset('vader', 'front/bridges/bridge.png'),
        black: resolveBassCatalogVariant('vader', 'front', 'bridges', '4', 'black', ['bridge']) ?? bassModelAsset('vader', 'front/bridges/bridge.png'),
        gold: resolveBassCatalogVariant('vader', 'front', 'bridges', '4', 'gold', ['bridge']) ?? bassModelAsset('vader', 'front/bridges/bridge.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended5: {
      label: 'Extended 5-String',
      note: '5-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('vader', 'front', 'bridges', '5', 'chrome', ['bridge']) ?? bassModelAsset('vader', 'front/bridges/bridge-5.png'),
        black: resolveBassCatalogVariant('vader', 'front', 'bridges', '5', 'black', ['bridge']) ?? bassModelAsset('vader', 'front/bridges/bridge-5.png'),
        gold: resolveBassCatalogVariant('vader', 'front', 'bridges', '5', 'gold', ['bridge']) ?? bassModelAsset('vader', 'front/bridges/bridge-5.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended300: {
      label: 'Extended 300',
      note: 'Extended 300 bridge variant',
      assets: {
        chrome: resolveBassCatalogAsset('vader', 'front', 'bridges', { strings: '4', preferTokens: ['300'] }) ?? bassModelAsset('vader', 'front/bridges/bridge-300.png'),
        black: resolveBassCatalogAsset('vader', 'front', 'bridges', { strings: '4', preferTokens: ['300'] }) ?? bassModelAsset('vader', 'front/bridges/bridge-300.png'),
        gold: resolveBassCatalogAsset('vader', 'front', 'bridges', { strings: '4', preferTokens: ['300'] }) ?? bassModelAsset('vader', 'front/bridges/bridge-300.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    standard: {
      label: 'Standard 4-String',
      note: 'Kiesel 4-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/4', '4', 'chrome') ?? bassModelAsset('jb', 'front/bridges/kiesel/4/chrome.png'),
        black: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/4', '4', 'black') ?? bassModelAsset('jb', 'front/bridges/kiesel/4/black.png'),
        gold: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/4', '4', 'gold') ?? bassModelAsset('jb', 'front/bridges/kiesel/4/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended5: {
      label: 'Standard 5-String',
      note: 'Kiesel 5-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/5', '5', 'chrome') ?? bassModelAsset('jb', 'front/bridges/kiesel/5/chrome.png'),
        black: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/5', '5', 'black') ?? bassModelAsset('jb', 'front/bridges/kiesel/5/black.png'),
        gold: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/5', '5', 'gold') ?? bassModelAsset('jb', 'front/bridges/kiesel/5/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    cosmos: {
      label: 'Cosmos',
      note: 'Custom Cosmos bridge',
      assets: {
        chrome: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/4', '4', 'chrome') ?? bassModelAsset('jb', 'front/bridges/kiesel/4/chrome.png'),
        black: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/4', '4', 'black') ?? bassModelAsset('jb', 'front/bridges/kiesel/4/black.png'),
        gold: resolveBassCatalogVariant('jb', 'front', 'bridges/kiesel/4', '4', 'gold') ?? bassModelAsset('jb', 'front/bridges/kiesel/4/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  pb: {
    standard: {
      label: 'Standard 4-String',
      note: 'Classic 4-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('pb', 'front', 'bridges/4', '4', 'chrome') ?? bassModelAsset('pb', 'front/bridges/4/chrome.png'),
        black: resolveBassCatalogVariant('pb', 'front', 'bridges/4', '4', 'black') ?? bassModelAsset('pb', 'front/bridges/4/black.png'),
        gold: resolveBassCatalogVariant('pb', 'front', 'bridges/4', '4', 'gold') ?? bassModelAsset('pb', 'front/bridges/4/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    standard4: {
      label: 'Standard 4-String',
      note: 'Classic 4-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('pb', 'front', 'bridges/4', '4', 'chrome') ?? bassModelAsset('pb', 'front/bridges/4/chrome.png'),
        black: resolveBassCatalogVariant('pb', 'front', 'bridges/4', '4', 'black') ?? bassModelAsset('pb', 'front/bridges/4/black.png'),
        gold: resolveBassCatalogVariant('pb', 'front', 'bridges/4', '4', 'gold') ?? bassModelAsset('pb', 'front/bridges/4/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended5: {
      label: 'Standard 5-String',
      note: 'Extended 5-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('pb', 'front', 'bridges/5', '5', 'chrome') ?? bassModelAsset('pb', 'front/bridges/5/chrome.png'),
        black: resolveBassCatalogVariant('pb', 'front', 'bridges/5', '5', 'black') ?? bassModelAsset('pb', 'front/bridges/5/black.png'),
        gold: resolveBassCatalogVariant('pb', 'front', 'bridges/5', '5', 'gold') ?? bassModelAsset('pb', 'front/bridges/5/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    standard5: {
      label: 'Standard 5-String',
      note: 'Extended 5-string bridge',
      assets: {
        chrome: resolveBassCatalogVariant('pb', 'front', 'bridges/5', '5', 'chrome') ?? bassModelAsset('pb', 'front/bridges/5/chrome.png'),
        black: resolveBassCatalogVariant('pb', 'front', 'bridges/5', '5', 'black') ?? bassModelAsset('pb', 'front/bridges/5/black.png'),
        gold: resolveBassCatalogVariant('pb', 'front', 'bridges/5', '5', 'gold') ?? bassModelAsset('pb', 'front/bridges/5/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
}



export const BASS_PICKGUARD_OPTIONS = {
  vader: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
  },
  pb: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    black: {
      label: 'Black',
      note: 'Classic black guard',
      src: bassModelAsset('pb', 'front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: bassModelAsset('pb', 'front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: bassModelAsset('pb', 'front/pickguard/red-tortoise.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'Pearloid',
      note: 'Bright pearloid finish',
      src: bassModelAsset('pb', 'front/pickguard/white-pearloid.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    black: {
      label: 'Black',
      note: 'Black pickguard',
      src: bassModelAsset('jb', 'front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: bassModelAsset('jb', 'front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: bassModelAsset('jb', 'front/pickguard/red-tortoise.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    satinBlack: {
      label: 'Satin Black',
      note: 'Matte black guard',
      src: bassModelAsset('jb', 'front/pickguard/satin-black.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'Pearloid',
      note: 'Bright pearloid finish',
      src: bassModelAsset('jb', 'front/pickguard/white-pearloid.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
}

export const BASS_KNOB_OPTIONS = {
  vader: {
    hardwareColor: {
      label: 'Hardware Color Knobs',
      note: 'Knobs matched to hardware color',
      price: 0,
      specs: specs(),
      src: bassModelAsset('vader', 'front/knobs/chrome.png'),
      maskSrc: bassModelAsset('vader', 'front/knobs/chrome.png'),
      type: 'hardwareColor',
    },
    abalone: {
      label: 'Metal Knobs w/ Abalone Inlays',
      note: 'Chrome knobs with abalone inlay',
      price: 0,
      specs: specs(),
      src: bassModelAsset('vader', 'front/knobs/chrome.png'),
      overlaySrc: bassModelAsset('vader', 'front/knobs/abalone-inlay.png'),
      type: 'overlay',
    },
    pearl: {
      label: 'Metal Knobs w/ White Pearl Inlays',
      note: 'Chrome knobs with white pearl inlay',
      price: 0,
      specs: specs(),
      src: bassModelAsset('vader', 'front/knobs/chrome.png'),
      overlaySrc: bassModelAsset('vader', 'front/knobs/white-pearl-inlay.png'),
      type: 'overlay',
    },
    tamarind: {
      label: 'Tamarind Wood',
      note: 'Warm wood-look knobs',
      price: 0,
      specs: specs(),
      src: bassModelAsset('vader', 'front/knobs/tamarind.png'),
      type: 'solid',
    },
  },
  pb: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassModelAsset('pb', 'front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackActive: {
      label: 'Black With Active',
      note: 'Black knobs with active electronics',
      src: bassModelAsset('pb', 'front/knobs/black-active.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackThree: {
      label: 'Black Three String',
      note: 'Black knobs for 3-string config',
      src: bassModelAsset('pb', 'front/knobs/black-three.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassModelAsset('pb', 'front/knobs/chrome.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chromeActive: {
      label: 'Chrome With Active',
      note: 'Chrome knobs with active electronics',
      src: bassModelAsset('pb', 'front/knobs/chrome-active.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chromeThree: {
      label: 'Chrome Three String',
      note: 'Chrome knobs for 3-string config',
      src: bassModelAsset('pb', 'front/knobs/chrome-three.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassModelAsset('pb', 'front/knobs/tamarind.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarindActive: {
      label: 'Tamarind With Active',
      note: 'Tamarind knobs with active electronics',
      src: bassModelAsset('pb', 'front/knobs/tamarind-active.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarindThree: {
      label: 'Tamarind Three String',
      note: 'Tamarind knobs for 3-string config',
      src: bassModelAsset('pb', 'front/knobs/tamarind-three.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold',
      note: 'Premium gold knobs',
      src: bassModelAsset('pb', 'front/knobs/gold.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    goldActive: {
      label: 'Gold With Active',
      note: 'Gold knobs with active electronics',
      src: bassModelAsset('pb', 'front/knobs/gold-active.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    goldThree: {
      label: 'Gold Three String',
      note: 'Gold knobs for 3-string config',
      src: bassModelAsset('pb', 'front/knobs/gold-three.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassModelAsset('pb', 'front/knobs/white-pearl-inlay.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearlActive: {
      label: 'Pearl Inlay With Active',
      note: 'Pearl inlay knobs with active electronics',
      src: bassModelAsset('pb', 'front/knobs/white-pearl-inlay-active.png'),
      price: 35, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearlThree: {
      label: 'Pearl Inlay Three String',
      note: 'Pearl inlay knobs for 3-string config',
      src: bassModelAsset('pb', 'front/knobs/white-pearl-inlay-three.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abaloneInlay: {
      label: 'Abalone Inlay',
      note: 'Premium abalone inlay knobs',
      src: bassModelAsset('pb', 'front/knobs/abalone-inlay.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abaloneInlayThree: {
      label: 'Abalone Inlay Three String',
      note: 'Abalone inlay knobs for 3-string config',
      src: bassModelAsset('pb', 'front/knobs/abalone-inlay-three.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassModelAsset('jb', 'front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassModelAsset('jb', 'front/knobs/chrome.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassModelAsset('jb', 'front/knobs/tamarind.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold',
      note: 'Premium gold knobs',
      src: bassModelAsset('jb', 'front/knobs/gold.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassModelAsset('jb', 'front/knobs/white-pearl-inlay.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abalone: {
      label: 'Abalone Inlay',
      note: 'Premium abalone inlay',
      src: bassModelAsset('jb', 'front/knobs/abalone-inlay.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
}

export const BASS_HARDWARE_OPTIONS = {
  chrome: {
    label: 'Chrome',
    note: 'Standard bright hardware',
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    color: 'chrome',
  },
  black: {
    label: 'Black',
    note: 'Stealth hardware',
    price: 45,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    color: 'black',
  },
}

export const BASS_PICKUP_OPTIONS = {
  standard: {
    label: 'Standard',
    note: 'Single coil P-bass pickup',
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  split: {
    label: 'Split Coil',
    note: 'Modern split pickup',
    price: 45, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  humbucker: {
    label: 'Humbucker',
    note: 'Dual coil humbucker',
    price: 65, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  active: {
    label: 'Active',
    note: 'Preamp equipped',
    price: 125, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_PICKUP_CONFIG_OPTIONS = {
  p: {
    label: 'P Style',
    note: 'Single split pickup',
  },
  j: {
    label: 'J Style',
    note: 'Dual single coil',
  },
  pj: {
    label: 'P/J Combo',
    note: 'Best of both worlds',
  },
  hh: {
    label: 'H/H',
    note: 'Dual humbuckers',
  },
}

export const VADER_PICKUP_OPTIONS = {
  radiumHumbucker: {
    label: 'Radium Radiused Humbucker',
    note: 'Radium radiused humbucker pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: 'bass/vader/front/pickups/k/standard/4/bridge-black.png',
    neckAsset: 'bass/vader/front/pickups/k/standard/4/neck-black.png',
    bridgeMask: 'bass/vader/front/pickups/k/standard/4/bridge-black.png',
    neckMask: 'bass/vader/front/pickups/k/standard/4/neck-black.png',
    supportsColor: true,
  },
  radiumSingle: {
    label: 'Radium Radiused Single Coil',
    note: 'Radium radiused single coil pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: 'bass/vader/front/pickups/k/standard/4/bridge-black.png',
    neckAsset: 'bass/vader/front/pickups/k/standard/4/neck-black.png',
    bridgeMask: 'bass/vader/front/pickups/k/standard/4/bridge-black.png',
    neckMask: 'bass/vader/front/pickups/k/standard/4/neck-black.png',
    supportsColor: true,
  },
  singleHbSweetSpot: {
    label: 'Single HB Alnico Humbucker In Sweet Spot',
    note: 'Single HB Alnico humbucker in sweet spot position',
    price: 0,
    specs: specs(),
    bridgeAsset: 'bass/vader/front/pickups/hb/standard/4/bridge-black.png',
    neckAsset: null,
    bridgeMask: null,
    neckMask: null,
    supportsColor: false,
    positionOffset: 'translateX(3%)', // TODO: tune by eye against the real body art
  },
  hbAlnico: {
    label: 'HB Alnico Humbucker',
    note: 'HB Alnico humbucker pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: 'bass/vader/front/pickups/hb/standard/4/bridge-black.png',
    neckAsset: 'all-models/pickups/bass/j/4/neck-black.png',
    bridgeMask: null,
    neckMask: null,
    supportsColor: false,
  },
  fishmanFluence: {
    label: 'Fishman Fluence',
    note: 'Fishman Fluence pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: 'all-models/pickups/bass/acf/bridge.png',
    neckAsset: 'all-models/pickups/bass/acf/neck.png',
    bridgeMask: null,
    neckMask: null,
    supportsColor: false,
  },
  scpSplitCoil: {
    label: 'SCP Split-Coil Alnico',
    note: 'SCP split-coil Alnico neck pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: null,
    neckAsset: 'all-models/pickups/bass/p/neck-black.png',
    bridgeMask: null,
    neckMask: 'all-models/pickups/bass/p/neck-black.png',
    supportsColor: true,
  },
  jvaSingleCoil: {
    label: 'JVA Single Coil',
    note: 'JVA single coil neck pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: null,
    neckAsset: 'all-models/pickups/bass/j/4/neck-black.png',
    bridgeMask: null,
    neckMask: 'all-models/pickups/bass/j/4/neck-black.png',
    supportsColor: true,
  },
  none: {
    label: 'No Neck Pickup',
    note: 'Remove neck pickup',
    price: 0,
    specs: specs(),
    bridgeAsset: null,
    neckAsset: null,
    bridgeMask: null,
    neckMask: null,
    supportsColor: false,
  },
}

export const BASS_STRING_OPTIONS = {
  '4': {
    label: '4 Strings',
    note: 'Standard 4-string',
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '5': {
    label: '5 Strings',
    note: 'Extended range',
    price: 50, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const VADER_STRAP_BUTTON_OPTIONS = {
  standard: {
    label: 'Standard Straplocks',
    note: 'Standard strap buttons front and rear',
    price: 0,
    specs: specs(),
    frontSrc: (color) => bassAsset(`bass/vader/front/strap buttons/standard/${color}.png`),
    backSrc: (color) => bassAsset(`bass/vader/back/strap buttons/standard/${color}.png`),
  },
  straplocks: {
    label: 'Dunlop Straplocks',
    note: 'Dunlop straplocks front and rear',
    price: 50,
    specs: specs(),
    frontSrc: (color) => bassAsset(`bass/vader/front/strap buttons/straplocks/${color}.png`),
    backSrc: (color) => bassAsset(`bass/vader/back/strap buttons/straplocks/${color}.png`),
  },
}

export const VADER_ELECTRONICS_CAVITY_COVER_OPTIONS = {
  black: {
    label: 'Black',
    note: 'Black rear plate',
    src: bassAsset('bass/vader/back/backplates/black.png'),
    price: 0,
    specs: specs(),
  },
  ebony: {
    label: 'Ebony',
    note: 'Ebony rear plate',
    src: bassAsset('bass/vader/back/backplates/ebony.png'),
    price: 15,
    specs: specs(),
  },
  purpleheart: {
    label: 'Purpleheart',
    note: 'Purpleheart rear plate',
    src: bassAsset('bass/vader/back/backplates/purpleheart.png'),
    price: 20,
    specs: specs(),
  },
}

export const BASS_PREVIEW_LAYOUTS = {
  vader: { scale: 0.95, x: 0, y: 28 },
  pb: { scale: 0.92, x: -4, y: 26 },
  jb: { scale: 0.93, x: 0, y: 26 },
}

export const BASS_BODY_LAYER_ASSETS = {
  vader: {
    allAssets: BASS_MODEL_CATALOG.vader.all,
    front: {
      mask: resolveBassCatalogAsset('vader', 'front', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('vader', 'front/masks/bodymask.png'),
      bridge: BASS_BRIDGE_OPTIONS.vader.standard.assets,
      strap: pickColorVariants('vader', 'front', 'strap buttons/standard', '4'),
      straplocks: pickColorVariants('vader', 'front', 'strap buttons/straplocks', '4'),
      pickups: resolveBassCatalogAsset('vader', 'front', 'pickups', { strings: '4', preferTokens: ['bridge', 'black'] }) ?? bassModelAsset('vader', 'front/pickups/hb/standard/4/bridge-black.png'),
      pickupCatalog: mapCatalogByStem('vader', 'front', 'pickups'),
      shadows: resolveBassCatalogAsset('vader', 'front', 'shadows_highlights', { strings: '4', preferTokens: ['edge', 'shadow'] }) ?? bassModelAsset('vader', 'front/shadows_highlights/edge-shadow.png'),
      gloss: resolveBassCatalogAsset('vader', 'front', 'shadows_highlights', { strings: '4', preferTokens: ['gloss'] }) ?? bassModelAsset('vader', 'front/shadows_highlights/gloss.png'),
    },
    back: {
      mask: resolveBassCatalogAsset('vader', 'back', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('vader', 'back/masks/bodymask.png'),
      backplate: BASS_BACKPLATE_OPTIONS.vader.standard.src,
      bridge: resolveBassCatalogAsset('vader', 'back', 'bridges', { strings: '4', preferTokens: ['standard'] }),
      strap: pickColorVariants('vader', 'back', 'strap buttons/standard', '4'),
      straplocks: pickColorVariants('vader', 'back', 'strap buttons/straplocks', '4'),
      neckCap: resolveBassCatalogAsset('vader', 'back', '', { strings: '4', preferTokens: ['neck', 'cap'] }) ?? bassModelAsset('vader', 'back/neck-cap.png'),
      shadows: resolveBassCatalogAsset('vader', 'back', 'shadows_highlights', { strings: '4', preferTokens: ['edge', 'shadow'] }) ?? bassModelAsset('vader', 'back/shadows_highlights/edge-shadow.png'),
      gloss: resolveBassCatalogAsset('vader', 'back', 'shadows_highlights', { strings: '4', preferTokens: ['gloss'] }) ?? bassModelAsset('vader', 'back/shadows_highlights/gloss.png'),
    },
  },
  pb: {
    allAssets: BASS_MODEL_CATALOG.pb.all,
    front: {
      mask: resolveBassCatalogAsset('pb', 'front', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('pb', 'front/masks/bodymask.png'),
      bridge: BASS_BRIDGE_OPTIONS.pb.standard.assets,
      strap: pickColorVariants('pb', 'front', 'strap buttons/standard', '4'),
      straplocks: pickColorVariants('pb', 'front', 'strap buttons/straplocks', '4'),
      pickups: resolveBassCatalogAsset('pb', 'front', 'pickups', { strings: '4', preferTokens: ['bridge', 'black'] }) ?? bassModelAsset('pb', 'front/pickups/4/bridge-black.png'),
      pickupCatalog: mapCatalogByStem('pb', 'front', 'pickups'),
      shadows: resolveBassCatalogAsset('pb', 'front', 'shadows_highlights', { strings: '4', preferTokens: ['edge', 'shadow'] }) ?? bassModelAsset('pb', 'front/shadows_highlights/edge-shadow.png'),
      gloss: resolveBassCatalogAsset('pb', 'front', 'shadows_highlights', { strings: '4', preferTokens: ['gloss'] }) ?? bassModelAsset('pb', 'front/shadows_highlights/gloss.png'),
    },
    back: {
      mask: resolveBassCatalogAsset('pb', 'back', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('pb', 'back/masks/bodymask.png'),
      backplate: BASS_BACKPLATE_OPTIONS.pb.standard.src,
      neckBolts: resolveBassCatalogAsset('pb', 'back', 'neck bolts', { strings: '4', preferTokens: ['neck', 'bolts'] }),
      ferrules: pickColorVariants('pb', 'back', 'string ferrules/standard', '4'),
      strap: pickColorVariants('pb', 'back', 'strap buttons/standard', '4'),
      straplocks: pickColorVariants('pb', 'back', 'strap buttons/straplocks', '4'),
      shadows: resolveBassCatalogAsset('pb', 'back', 'shadows_highlights', { strings: '4', preferTokens: ['multiply'] }) ?? bassModelAsset('pb', 'back/shadows_highlights/multiply.png'),
      gloss: resolveBassCatalogAsset('pb', 'back', 'shadows_highlights', { strings: '4', preferTokens: ['gloss'] }) ?? bassModelAsset('pb', 'back/shadows_highlights/gloss.png'),
    },
  },
  jb: {
    allAssets: BASS_MODEL_CATALOG.jb.all,
    front: {
      mask: resolveBassCatalogAsset('jb', 'front', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('jb', 'front/masks/bodymask.png'),
      bridge: BASS_BRIDGE_OPTIONS.jb.standard.assets,
      strap: pickColorVariants('jb', 'front', 'strap buttons/standard', '4'),
      straplocks: pickColorVariants('jb', 'front', 'strap buttons/straplocks', '4'),
      pickups: resolveBassCatalogAsset('jb', 'front', 'pickups', { strings: '4', preferTokens: ['bridge', 'black'] }) ?? bassModelAsset('jb', 'front/pickups/4/j/bridge-black.png'),
      pickupCatalog: mapCatalogByStem('jb', 'front', 'pickups'),
      shadows: resolveBassCatalogAsset('jb', 'front', 'shadows_highlights', { strings: '4', preferTokens: ['edge', 'shadow'] }) ?? bassModelAsset('jb', 'front/shadows_highlights/edge-shadow.png'),
      gloss: resolveBassCatalogAsset('jb', 'front', 'shadows_highlights', { strings: '4', preferTokens: ['gloss'] }) ?? bassModelAsset('jb', 'front/shadows_highlights/gloss.png'),
    },
    back: {
      mask: resolveBassCatalogAsset('jb', 'back', 'masks', { strings: '4', preferTokens: ['bodymask'] }) ?? bassModelAsset('jb', 'back/masks/bodymask.png'),
      backplate: BASS_BACKPLATE_OPTIONS.jb.standard.src,
      neckBolts: resolveBassCatalogAsset('jb', 'back', 'neck bolts', { strings: '4', preferTokens: ['neck', 'bolts'] }),
      ferrules: pickColorVariants('jb', 'back', 'string ferrules/standard', '4'),
      strap: pickColorVariants('jb', 'back', 'strap buttons/standard', '4'),
      straplocks: pickColorVariants('jb', 'back', 'strap buttons/straplocks', '4'),
      shadows: resolveBassCatalogAsset('jb', 'back', 'shadows_highlights', { strings: '4', preferTokens: ['multiply'] }) ?? bassModelAsset('jb', 'back/shadows_highlights/multiply.png'),
      gloss: resolveBassCatalogAsset('jb', 'back', 'shadows_highlights', { strings: '4', preferTokens: ['gloss'] }) ?? bassModelAsset('jb', 'back/shadows_highlights/gloss.png'),
    },
  },
}

export function resolveBassVariant(source, colorKey) {
  if (!source) return null
  if (typeof source === 'string') return source
  return source[colorKey] ?? source.chrome ?? source.black ?? source.gold ?? null
}

export const bassBuilder = {
  DEFAULT_CONFIG: BASS_DEFAULT_CONFIG,
  BASE_PRICE: BASS_BASE_PRICE,
  BODY_OPTIONS: BASS_BODY_OPTIONS,
  BODY_WOOD_OPTIONS: BASS_BODY_WOOD_OPTIONS,
  TOP_WOOD_OPTIONS: BASS_TOP_WOOD_OPTIONS,
  BODY_FINISH_OPTIONS: BASS_BODY_FINISH_OPTIONS,
  NECK_OPTIONS: BASS_NECK_OPTIONS,
  FINGERBOARD_RADIUS_OPTIONS: BASS_FINGERBOARD_RADIUS_OPTIONS,
  FRETBOARD_OPTIONS: BASS_FRETBOARD_OPTIONS,
  NECK_MASK: BASS_NECK_MASK,
  NECK_FRETS: BASS_NECK_FRETS,
  NECK_NUT: BASS_NECK_NUT,
  FRET_OPTIONS: BASS_FRET_OPTIONS,
  NECK_REAR_FINISH_OPTIONS: BASS_NECK_REAR_FINISH_OPTIONS,
  HEADSTOCK_WOOD_OPTIONS: BASS_HEADSTOCK_WOOD_OPTIONS,
  HEADSTOCK_STYLE_OPTIONS: BASS_HEADSTOCK_STYLE_OPTIONS,
  NECK_STYLE_OPTIONS: BASS_NECK_STYLE_OPTIONS,
  INLAY_OPTIONS: BASS_INLAY_OPTIONS,
  INLAY_SHAPE_OPTIONS: BASS_INLAY_SHAPE_OPTIONS,
  INLAY_MATERIAL_OPTIONS: BASS_INLAY_MATERIAL_OPTIONS,
  BACKPLATE_OPTIONS: BASS_BACKPLATE_OPTIONS,
  PICKUP_SCREW_OPTIONS: BASS_PICKUP_SCREW_OPTIONS,
  CONTROL_PLATE_OPTIONS: BASS_CONTROL_PLATE_OPTIONS,
  BRIDGE_OPTIONS: BASS_BRIDGE_OPTIONS,
  PICKGUARD_OPTIONS: BASS_PICKGUARD_OPTIONS,
  KNOB_OPTIONS: BASS_KNOB_OPTIONS,
  HARDWARE_OPTIONS: BASS_HARDWARE_OPTIONS,
  PICKUP_OPTIONS: BASS_PICKUP_OPTIONS,
  PICKUP_TYPE_STYLE_OPTIONS: BASS_PICKUP_TYPE_STYLE_OPTIONS,
  PICKUP_CONFIG_OPTIONS: BASS_PICKUP_CONFIG_OPTIONS,
  VADER_PICKUP_OPTIONS: VADER_PICKUP_OPTIONS,
  STRING_OPTIONS: BASS_STRING_OPTIONS,
  PREVIEW_LAYOUTS: BASS_PREVIEW_LAYOUTS,
  BODY_LAYER_ASSETS: BASS_BODY_LAYER_ASSETS,
  MODEL_ASSET_CATALOG: BASS_MODEL_CATALOG,
  SHARED_ASSET_CATALOG: BASS_SHARED_ASSET_CATALOG,
  resolveVariant: resolveBassVariant,
  // new schema (bass-conditional: STRING_COUNT_OPTIONS uses 4/5/6 strings for bass)
  DEXTERITY_OPTIONS,
  STRING_COUNT_OPTIONS,
  BASS_SCALE_LENGTH_OPTIONS,
  MULTISCALE_OPTIONS,
  SCALE_LENGTH_OPTIONS,
  CASE_OPTIONS,
  TOP_WOOD_OPTIONS,
  FINISH_TYPE_OPTIONS,
  TOP_COAT_OPTIONS,
  BURST_FINISH_OPTIONS,
  NECK_CONSTRUCTION_OPTIONS,
  FRET_OPTIONS,
  NECK_REAR_FINISH_OPTIONS,
  HEADSTOCK_SHAPE_OPTIONS,
  TRUSS_ROD_COVER_OPTIONS,
  ELECTRONICS_TYPE_OPTIONS,
  PICKUP_CONFIGURATION_OPTIONS,
  PICKUP_MODEL_BRIDGE_OPTIONS,
  PICKUP_MODEL_MIDDLE_OPTIONS,
  PICKUP_MODEL_NECK_OPTIONS,
  PICKUP_COLOR_OPTIONS,
  PICKUP_POLE_COLOR_OPTIONS,
  CONTROLS_OPTIONS,
  SADDLE_OPTIONS,
  NUT_OPTIONS,
  TUNING_OPTIONS,
  TUNING_DISCLAIMER,
  STRING_BRAND_OPTIONS,
  OUTPUT_JACK_OPTIONS,
  STRAP_BUTTON_OPTIONS,
  TUNER_BUTTON_OPTIONS,
   ELECTRONICS_CAVITY_COVER_OPTIONS,
   TREMOLO_COVER_OPTIONS_BY_BRIDGE,
   KNOB_STYLE_OPTIONS,
  resolveCatalogAsset: resolveBassCatalogAsset,
  resolveCatalogVariant: resolveBassCatalogVariant,
  resolveSharedAsset: resolveSharedBassAsset,
}
