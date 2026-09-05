// Repointed to Cloudinary collection: cosmoscraft_assets/customization_assets
// Falls back to local /builder/ directory when Cloudinary is not configured.
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME : ''
const USE_CLOUDINARY = Boolean(CLOUD_NAME) 

export const cloudImage = (root, path) => {
  if (USE_CLOUDINARY) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${root}/${path}`
  }
  // Local fallback - serve from public/builder/
  return `/builder/${path}`
}

// After
export const asset = (path) => {
  if (USE_CLOUDINARY) {
    // Cloudinary mirrors the local folder structure exactly:
    // cosmoscraft_assets/customization_assets/builder/{dc|delos|all-models}/...
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/customization_assets/builder/${path}`
  }
  // Local fallback - serve from public/builder/customization_assets/builder/
  return `/builder/${path}`
}

// Resolve a model-specific asset path under customization_assets/builder/{category}/{model}/
export const modelAsset = (category, model, ...subPaths) => {
  const tail = subPaths.filter(Boolean).join('/')
  return asset(`${category}/${model}/${tail}`)
}

const specs = () => ({ size: '', dimensions: '', material: '', notes: '' })

export const DEFAULT_CONFIG = {
  guitarType: 'electric',
  body: 'dc',
  bodyWood: 'mah',
  bodyFinish: 'none',
  neck: 'maple',
  fretboard: 'rosewood',
  headstockWood: 'plain-maple',
  inlays: 'pearl',
  bridge: 'hipshotFixed',
   knobs: 'plasticBlack',
  pickups: 'hss',
  hardware: 'chrome',
  headstock: 'gt6',
  // --- New customization options ---
  dexterity: 'right',
  strings: '6',
  multiscale: 'off',
  scaleLength: '25.5',
  case: 'none',
  bevel: 'off',
  topWood: 'none',
  topCoat: 'clearGloss',
  burstFinish: 'none',
  neckConstruction: '1piece',
  pickguard: 'pearloid',
  inlayShape: 'dots',
  inlayMaterial: 'pearl',
  inlay: 'idwhite-pearl',
  frets: 'stainlessRegular',
  neckRearFinish: 'tungOil',
  headstockShape: 'gt6',
  trussRodCover: 'black',
  electronicsType: 'passive',
   pickupConfiguration: 'hh',
  bridgePickupModel: 'vantium',
  middlePickupModel: 'none',
  neckPickupModel: 'vantium',
  pickupColor: 'bobbins',
  pickupColorVariant: 'black',
  pickupPaintedColor: '#000000',
  pickupWoodType: 'black',
    pickupPoleColor: 'silver',
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
}

export const GUITAR_TYPE_OPTIONS = [
  { id: 'electric', label: 'Electric Guitar' },
  { id: 'bass', label: 'Bass Guitar' },
]

export const BASE_PRICE = 25000

export const BODY_OPTIONS = {
  strat: {
    label: 'Strat',
    note: 'Balanced bolt-on body',
    bodySrc: modelAsset('electric', 'rs', 'bodies/front/masks/bodymask.png'),
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  solo: {
    label: 'Solo',
    note: 'Modern singlecut body',
    bodySrc:  modelAsset('electric', 'solo', 'bodies/front/masks/bv-bodymask.png'),
    price: 150,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  dc: {
    label: 'DC',
    note: 'Double-cut access',
    bodySrc: modelAsset('electric', 'dc', 'bodies/front/masks/bodymask.png'),
    price: 180,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  delos: {
    label: 'Delos',
    note: 'Contoured body build',
    bodySrc: modelAsset('electric', 'delos', 'bodies/front/masks/bodymask.png'),
    price: 220,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  precision: {
    label: 'Precision',
    note: 'Classic precision bass',
    bodySrc: modelAsset('electric', 'rs', 'bodies/front/masks/bodymask.png'),
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['bass'],
  },
  jazz: {
    label: 'Jazz',
    note: 'Modern jazz bass',
    bodySrc:  modelAsset('electric', 'solo', 'bodies/front/masks/bv-bodymask.png'),
    price: 150,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['bass'],
  },
}

export const BODY_WOOD_OPTIONS = {
  ald: {
    label: 'Alder',
    note: 'Classic alder body wood',
    texture: asset('all-models/woods-colors/body-woods/ald.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ash2: {
    label: 'Ash',
    note: 'Warm resonant ash grain',
    texture: asset('all-models/woods-colors/body-woods/ash2.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gmelina: {
    label: 'Gmelina',
    note: 'Tropical gmelina wood',
    texture: asset('all-models/woods-colors/body-woods/gmelina-wood.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  jackfruit: {
    label: 'Jackfruit Wood',
    note: 'Exotic jackfruit grain',
    texture: asset('all-models/woods-colors/body-woods/jackfruit-wood.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  lmb: {
    label: 'Laminated',
    note: 'Laminated wood body',
    texture: asset('all-models/woods-colors/body-woods/lmb.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  mah: {
    label: 'Mahogany',
    note: 'Rich warm mahogany',
    texture: asset('all-models/woods-colors/body-woods/mah.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedAsh: {
    label: 'Roasted Ash',
    note: 'Dark roasted ash finish',
    texture: asset('all-models/woods-colors/body-woods/roasted-ash.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  summerAsh: {
    label: 'Summer Ash',
    note: 'Light summer ash grain',
    texture: asset('all-models/woods-colors/body-woods/summer-ash1.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  wal: {
    label: 'Walnut',
    note: 'Deep dark walnut grain',
    texture: asset('all-models/woods-colors/body-woods/wal.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BODY_FINISH_OPTIONS = {
  none: {
    label: 'None',
    note: 'Raw wood texture',
    texture: null,
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  black: {
    label: 'Jet Black',
    note: 'Opaque black finish',
    texture: asset('all-models/woods-colors/colors/solids/black.png'),
    color: '#1a1a1a',
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  white: {
    label: 'Classic White',
    note: 'Clean opaque finish',
    texture: asset('all-models/woods-colors/colors/solids/white-white.png'),
    color: '#f5f5f5',
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  transBlack: {
    label: 'Trans Black',
    note: 'Tinted translucent finish',
    texture: asset('all-models/woods-colors/colors/transluscents/trans-black.png'),
    price: 35, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  red: {
    label: 'Vintage Red',
    note: 'Classic red finish',
    texture: null,
    color: '#b91c1c',
    price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  blue: {
    label: 'Ocean Blue',
    note: 'Deep blue finish',
    texture: null,
    color: '#1e40af',
    price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  green: {
    label: 'Forest Green',
    note: 'Rich green finish',
    texture: null,
    color: '#166534',
    price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const NECK_OPTIONS = {
  'maple': { label: 'Maple', note: 'Bright neck feel', src: asset('all-models/woods-colors/neck-woods/plain-maple.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '1piece' },
  'roasted': { label: 'Roasted', note: 'Dark roasted finish', src: asset('all-models/woods-colors/neck-woods/rfmn.png'), price: 75, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '1piece' },
  'walnut': { label: 'Walnut', note: 'Warm darker neck', src: asset('all-models/woods-colors/neck-woods/waln.png'), price: 95, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '1piece' },
  '3mm': { label: '3-Piece Maple', note: 'Stable 3-piece maple neck', src: asset('all-models/woods-colors/neck-woods/3mm.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '3piece' },
  '3mw': { label: 'Maple w/ 1 Walnut Stripe', note: '3-piece maple with walnut stripe', src: asset('all-models/woods-colors/neck-woods/3mw.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '3piece' },
  '3mp': { label: 'Maple w/ 1 Purple Heart Stripe', note: '3-piece maple with purple heart stripe', src: asset('all-models/woods-colors/neck-woods/3mp.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '3piece' },
  '3wp': { label: 'Walnut w/ 1 Purple Heart Stripe', note: '3-piece walnut with purple heart stripe', src: asset('all-models/woods-colors/neck-woods/3wp.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '3piece' },
  '5lm': { label: 'Black Limba w/ 2 Maple Stripes', note: '5-piece limba with maple stripes', src: asset('all-models/woods-colors/neck-woods/5lm.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '5piece' },
  '5ml': { label: 'Maple w/ 2 Black Limba Stripes', note: '5-piece maple with limba stripes', src: asset('all-models/woods-colors/neck-woods/5ml.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '5piece' },
  '5mp': { label: 'Maple w/ 2 Purple Heart Stripes', note: '5-piece maple with purple heart stripes', src: asset('all-models/woods-colors/neck-woods/5mp.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '5piece' },
  '5mw': { label: 'Maple w/ 2 Walnut Stripes', note: '5-piece maple with walnut stripes', src: asset('all-models/woods-colors/neck-woods/5mw.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '5piece' },
  '5wm': { label: 'Walnut w/ 2 Maple Stripes', note: '5-piece walnut with maple stripes', src: asset('all-models/woods-colors/neck-woods/5wm.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '5piece' },
  '5wp': { label: 'Walnut w/ 2 Purple Heart Stripes', note: '5-piece walnut with purple heart stripes', src: asset('all-models/woods-colors/neck-woods/5wp.png'), price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }, filter: 'none', construction: '5piece' },
}

export const FRETBOARD_OPTIONS = {
  birdseyeMaple: {
    label: 'Birdseye Maple',
    note: 'Figured maple with distinctive birdseye grain',
    src: asset('all-models/woods-colors/fingerboard-woods/birdseye-maple.png'),
    price: 100,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  bloodwood: {
    label: 'Bloodwood',
    note: 'Dense hardwood with rich red color',
    src: asset('all-models/woods-colors/fingerboard-woods/bloodwood.png'),
    price: 120,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ebony: {
    label: 'Ebony',
    note: 'Snappy premium board',
    src: asset('all-models/woods-colors/fingerboard-woods/ebony.png'),
    price: 80,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  efb: {
    label: 'EFB (Less Color Variation)',
    note: 'Engineered ebony with consistent appearance',
    src: asset('all-models/woods-colors/fingerboard-woods/efb.png'),
    price: 90,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  flamedMaple: {
    label: 'Flamed Maple',
    note: 'Premium maple with flame figuring',
    src: asset('all-models/woods-colors/fingerboard-woods/flamed-maple.png'),
    price: 110,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  maple: {
    label: 'Maple',
    note: 'Clean and bright',
    src: asset('all-models/woods-colors/fingerboard-woods/maple.png'),
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  paleMoonEbony: {
    label: 'Pale Moon Ebony',
    note: 'Exotic ebony with dramatic contrasting grain',
    src: asset('all-models/woods-colors/fingerboard-woods/pale-moon-ebony.png'),
    price: 140,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  purpleHeart: {
    label: 'Purple Heart',
    note: 'Hardwood with natural purple hue',
    src: asset('all-models/woods-colors/fingerboard-woods/purple-heart.png'),
    price: 100,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  richliteMapleValley: {
    label: 'Richlite Maple Valley',
    note: 'Durable composite fingerboard',
    src: asset('all-models/woods-colors/fingerboard-woods/richlite-maple-valley.png'),
    price: 130,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedBirdseye: {
    label: 'Roasted Birdseye Maple',
    note: 'Roasted birdseye maple with enhanced stability',
    src: asset('all-models/woods-colors/fingerboard-woods/roasted-birdseye.png'),
    price: 140,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedFlame: {
    label: 'Roasted Flame Maple',
    note: 'Roasted flame maple with rich figuring',
    src: asset('all-models/woods-colors/fingerboard-woods/roasted-flame.png'),
    price: 140,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedMaple: {
    label: 'Roasted Maple',
    note: 'Heat-treated maple for stability',
    src: asset('all-models/woods-colors/fingerboard-woods/roasted-maple.png'),
    price: 100,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Classic dark board',
    src: asset('all-models/woods-colors/fingerboard-woods/rosewood.png'),
    price: 60,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  royalEbony: {
    label: 'Royal Ebony',
    note: 'Premium ebony with striking grain',
    src: asset('all-models/woods-colors/fingerboard-woods/royal-ebony.png'),
    price: 130,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  zebrawood: {
    label: 'Zebrawood',
    note: 'Distinctive striped hardwood',
    src: asset('all-models/woods-colors/fingerboard-woods/zebrawood.png'),
    price: 110,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ziricote: {
    label: 'Ziricote',
    note: 'Exotic hardwood with dramatic grain',
    src: asset('all-models/woods-colors/fingerboard-woods/ziricote.png'),
    price: 140,
    specs: { size: '', dimensions: '', material: '', notes: '' }
  },
};

export const NECK_MASK = asset('all-models/necks/6-string/front/24-fret-front/standard/masks/mask.png')
export const NECK_FRETS = {
  stainless: asset('all-models/necks/6-string/front/24-fret-front/standard/frets/stainless.png'),
  gold: asset('all-models/necks/6-string/front/24-fret-front/standard/frets/gold.png'),
}
export const NECK_NUT = {
  black: asset('all-models/necks/6-string/front/24-fret-front/standard/nut/black.png'),
  white: asset('all-models/necks/6-string/front/24-fret-front/standard/nut/white.png'),
}

export const HEADSTOCK_WOOD_OPTIONS = {
  'plain-maple': {
    label: 'Plain Maple',
    note: 'Light plain maple headstock',
    texture: asset('all-models/woods-colors/headstock-woods/plain-maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ash: {
    label: 'Ash',
    note: 'Warm ash headstock',
    texture: asset('all-models/woods-colors/headstock-woods/ash.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const INLAY_OPTIONS = {
  pearl: {
    label: 'White Pearl',
    note: 'Classic dot inlays',
    src: asset('all-models/necks/6-string/front/24-fret-front/standard/inlays/id/idwhite-pearl.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  black: {
    label: 'Black',
    note: 'Subtle black dots',
    src: asset('all-models/necks/6-string/front/24-fret-front/standard/inlays/id/idblack.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  luminlay: {
    label: 'Luminlay',
    note: 'Glow-in-the-dark dots',
    src: asset('all-models/necks/6-string/front/24-fret-front/standard/inlays/id/idluminlay.png'),
    price: 35, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const INLAY_SHAPE_OPTIONS = {
  dots: { label: 'Dots', note: 'Classic dot inlays', src: null, price: 0, specs: specs() },
  diamonds: { label: 'Diamonds', note: 'Diamond inlays', src: null, price: 30, specs: specs() },
  blocks: { label: 'Blocks', note: 'Block inlays', src: null, price: 30, specs: specs() },
}

export const INLAY_MATERIAL_OPTIONS = {
  pearl: { label: 'White Pearl', note: 'Pearl inlay material', src: null, price: 0, specs: specs() },
  abalone: { label: 'Abalone', note: 'Abalone inlay material', src: null, price: 35, specs: specs() },
  black: { label: 'Black', note: 'Black inlay material', src: null, price: 0, specs: specs() },
  luminlay: { label: 'Luminlay', note: 'Glow-in-the-dark material', src: null, price: 35, specs: specs() },
  white: { label: 'White', note: 'White inlay material', src: null, price: 35, specs: specs() },
  red: { label: 'Red', note: 'Red inlay material', src: null, price: 35, specs: specs() },
  greenAcrylic: { label: 'Green Acrylic', note: 'Green acrylic inlay material', src: null, price: 35, specs: specs() },
  pink: { label: 'Pink', note: 'Pink inlay material', src: null, price: 35, specs: specs() },
}

export const BRIDGE_OPTIONS = {
  hipshotFixed: {
    label: 'Hipshot Fixed',
    note: 'Modern hardtail bridge',
    assets: {
      chrome: asset('all-models/bridges/6/standard/hipshot-hardtail/hipshot-hardtail-chrome.png'),
      black: asset('all-models/bridges/6/standard/hipshot-hardtail/hipshot-hardtail-black.png'),
      gold: asset('all-models/bridges/6/standard/hipshot-hardtail/hipshot-hardtail-gold.png'),
    },
    price: 45, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  hipshotTremolo: {
    label: 'Hipshot Tremolo',
    note: 'Six-string tremolo bridge',
    assets: {
      chrome: asset('all-models/bridges/6/standard/hipshot-trem/hipshot-trem-chrome.png'),
      black: asset('all-models/bridges/6/standard/hipshot-trem/hipshot-trem-black.png'),
      gold: asset('all-models/bridges/6/standard/hipshot-trem/hipshot-trem-gold.png'),
    },
    price: 75, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  floydRoseTremolo: {
    label: 'Floyd Rose Tremolo',
    note: 'Locking trem bridge',
    assets: {
      chrome: asset('all-models/bridges/6/standard/floyd-rose/chrome.png'),
      black: asset('all-models/bridges/6/standard/floyd-rose/black.png'),
      gold: asset('all-models/bridges/6/standard/floyd-rose/gold.png'),
    },
    price: 90, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gotoh: {
    label: 'Gotoh',
    note: 'Precision Gotoh bridge',
    assets: {
      chrome: asset('all-models/bridges/6/standard/gotoh/chrome.png'),
      black: asset('all-models/bridges/6/standard/gotoh/black.png'),
      gold: asset('all-models/bridges/6/standard/gotoh/gold.png'),
    },
    price: 85, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  evertune: {
    label: 'Evertune',
    note: 'Automatic tuning bridge',
    assets: {
      black: asset('all-models/bridges/6/standard/evertune/evertune-black.png'),
    },
    price: 150, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BRIDGE_OPTIONS_BY_BODY = {
  strat: ['hipshotFixed', 'hipshotTremolo', 'floydRoseTremolo'],
  solo: ['hipshotFixed', 'hipshotTremolo', 'floydRoseTremolo'],
  dc: ['hipshotFixed', 'hipshotTremolo', 'floydRoseTremolo'],
  delos: ['hipshotFixed', 'hipshotTremolo', 'floydRoseTremolo', 'gotoh', 'evertune'],
}

export const PICKGUARD_OPTIONS_BY_BODY = {
  strat: {
    white: {
      label: 'White',
      note: 'Classic white guard',
      src: modelAsset('electric', 'rs', 'bodies/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'White Pearl',
      note: 'Bright pearloid finish',
      src: modelAsset('electric', 'rs', 'bodies/front/pickguard/white-pearloid.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    black: {
      label: 'Black',
      note: 'Dark contrasting guard',
      src: modelAsset('electric', 'rs', 'bodies/front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: modelAsset('electric', 'rs', 'bodies/front/pickguard/red-tortoise.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  delos: {
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: modelAsset('electric', 'delos', 'bodies/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'White Pearl',
      note: 'White pearloid guard',
      src: modelAsset('electric', 'delos', 'bodies/front/pickguard/white-pearloid.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    black: {
      label: 'Black',
      note: 'Satin black guard',
      src: modelAsset('electric', 'delos', 'bodies/front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    satinBlack: {
      label: 'Satin Black',
      note: 'Low-key satin finish',
      src: modelAsset('electric', 'delos', 'bodies/front/pickguard/satin-black.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  solo: { none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } } },
  dc: { none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } } },
}

export const KNOB_OPTIONS_BY_BODY = {
  strat: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: modelAsset('electric', 'rs', 'bodies/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: modelAsset('electric', 'rs', 'bodies/front/knobs/tamarind.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: modelAsset('electric', 'rs', 'bodies/front/knobs/white-pearl-inlay.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abalone: {
      label: 'Abalone',
      note: 'Premium abalone inlay',
      src: modelAsset('electric', 'rs', 'bodies/front/knobs/abalone-inlay.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  solo: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src:  modelAsset('electric', 'solo', 'bodies/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackPlastic: {
      label: 'Black Plastic',
      note: 'Smooth black plastic',
      src:  modelAsset('electric', 'solo', 'bodies/front/knobs/black-plastic.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    whitePlastic: {
      label: 'White Plastic',
      note: 'Bright white plastic',
      src:  modelAsset('electric', 'solo', 'bodies/front/knobs/white-plastic.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src:  modelAsset('electric', 'solo', 'bodies/front/knobs/chrome.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  dc: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: modelAsset('electric', 'dc', 'bodies/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    dtmv: {
      label: 'Black DTMV',
      note: 'Modern black DTMV',
      src:  modelAsset('electric', 'dc', 'bodies/front/knobs/black-dtmv.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    dtc: {
      label: 'Black DTC',
      note: 'Modern black DTC',
      src:  modelAsset('electric', 'dc', 'bodies/front/knobs/black-dtc.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    plasticBlack: {
      label: 'Plastic Black',
      note: 'Plain black plastic',
      src:  modelAsset('electric', 'dc', 'bodies/front/knobs/plasticblack.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    plasticWhite: {
      label: 'Plastic White',
      note: 'Plain white plastic',
      src:  modelAsset('electric', 'dc', 'bodies/front/knobs/plasticwhite.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  delos: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: modelAsset('electric', 'delos', 'bodies/front/knobs/black-dtmv.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackPlastic: {
      label: 'Black Plastic',
      note: 'Black plastic DTMV',
      src: modelAsset('electric', 'delos', 'bodies/front/knobs/black-plastic-dtmv.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    whitePlastic: {
      label: 'White Plastic',
      note: 'White plastic DTMV',
      src: modelAsset('electric', 'delos', 'bodies/front/knobs/white-plastic-dtmv.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay DTMV',
      src: modelAsset('electric', 'delos', 'bodies/front/knobs/white-pearl-inlay-dtmv.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
}

export const HEADSTOCK_OPTIONS = {
  gt6: {
    label: 'GT6',
    note: 'Straight 6-in-line',
    mask: asset('all-models/headstocks/6/masks/gt6/mask.png'),
    logo: asset('all-models/headstocks/6/logos/gt6/wl.png'),
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/gt6/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/gt6/black.png'),
      gold: asset('all-models/headstocks/6/tuners/gt6/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/gt6.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gt6r: {
    label: 'GT6R',
    note: 'Reverse 6-in-line',
    mask: asset('all-models/headstocks/6/masks/gt6r/mask.png'),
    logo: asset('all-models/headstocks/6/logos/left-handed/gt6r/wl.png'),
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/gt6r/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/gt6r/black.png'),
      gold: asset('all-models/headstocks/6/tuners/gt6r/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/gt6r.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '6in': {
    label: '6 Inline',
    note: 'Standard 6 inline',
    mask: asset('all-models/headstocks/6/masks/6in/mask.png'),
    logo: null,
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/6in/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/6in/black.png'),
      gold: asset('all-models/headstocks/6/tuners/6in/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/6in.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '6inr': {
    label: '6 Inline Reverse',
    note: 'Reverse 6 inline',
    mask: asset('all-models/headstocks/6/masks/6inr/mask.png'),
    logo: null,
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/6inr/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/6inr/black.png'),
      gold: asset('all-models/headstocks/6/tuners/6inr/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/6inr.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '6kr': {
    label: '6 KR',
    note: '6 KR headstock',
    mask: asset('all-models/headstocks/6/masks/6kr/mask.png'),
    logo: null,
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/6kr/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/6kr/black.png'),
      gold: asset('all-models/headstocks/6/tuners/6kr/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/6kr.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  '624': {
    label: '2×4',
    note: '2×4 headstock',
    mask: asset('all-models/headstocks/6/masks/624/mask.png'),
    logo: null,
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/624/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/624/black.png'),
      gold: asset('all-models/headstocks/6/tuners/624/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/624.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  h33: {
    label: 'H33',
    note: 'Classic inline',
    mask: asset('all-models/headstocks/6/masks/h33/mask.png'),
    logo: asset('all-models/headstocks/6/logos/h33/wl.png'),
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/h33/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/h33/black.png'),
      gold: asset('all-models/headstocks/6/tuners/h33/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/h33.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 45, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  h33r: {
    label: 'H33R',
    note: 'Reverse inline',
    mask: asset('all-models/headstocks/6/masks/h33r/mask.png'),
    logo: asset('all-models/headstocks/6/logos/hr33/wl.png'),
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/hr33/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/hr33/black.png'),
      gold: asset('all-models/headstocks/6/tuners/hr33/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/hr33.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 55, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const HARDWARE_OPTIONS = {
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
    price: 35,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    color: 'black',
  },
  gold: {
    label: 'Gold',
    note: 'Premium gold finish',
    price: 60,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    color: 'gold',
  },
}

export const PICKUP_OPTIONS = {
  hh: {
    label: 'HH',
    note: 'Dual humbuckers',
    price: 135, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  hss: {
    label: 'HSS',
    note: 'Bridge humbucker, two singles',
    price: 110, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  fluence: {
    label: 'Fluence',
    note: 'Modern active set',
    price: 185, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const PREVIEW_LAYOUTS = {
  strat: { scale: 0.92, x: -6, y: 30 },
  solo: { scale: 0.94, x: 0, y: 26 },
  dc: { scale: 0.9, x: 0, y: 28 },
  delos: { scale: 0.92, x: 0, y: 24 },
}

export const BODY_LAYER_ASSETS = {
  strat: {
    bridge: BRIDGE_OPTIONS.hipshotFixed.assets,
    knobs: {
      chrome: modelAsset('electric', 'rs', 'bodies/front/knobs/black.png'),
      black: modelAsset('electric', 'rs', 'bodies/front/knobs/black.png'),
      gold: modelAsset('electric', 'rs', 'bodies/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: modelAsset('electric', 'rs', 'bodies/front/strap buttons/standard/chrome.png'),
      black: modelAsset('electric', 'rs', 'bodies/front/strap buttons/standard/black.png'),
      gold: modelAsset('electric', 'rs', 'bodies/front/strap buttons/standard/gold.png'),
    },
    switch: modelAsset('electric', 'rs', 'bodies/front/switches/blade/black.png'),
    pickguard: {
      chrome: modelAsset('electric', 'rs', 'bodies/front/pickguard/white.png'),
      black: modelAsset('electric', 'rs', 'bodies/front/pickguard/black.png'),
      gold: modelAsset('electric', 'rs', 'bodies/front/pickguard/red-tortoise.png'),
    },
    shadows: modelAsset('electric', 'rs', 'shadows_highlights/edge-shadow.png'),
    gloss: modelAsset('electric', 'rs', 'shadows_highlights/gloss.png'),
  },
  solo: {
    bridge: BRIDGE_OPTIONS.hipshotFixed.assets,
    knobs: {
      chrome:  modelAsset('electric', 'solo', 'bodies/front/knobs/chrome.png'),
      black:  modelAsset('electric', 'solo', 'bodies/front/knobs/black.png'),
      gold:  modelAsset('electric', 'solo', 'bodies/front/knobs/tamarind.png'),
    },
    strap: {
      chrome:  modelAsset('electric', 'solo', 'bodies/front/strap buttons/standard/chrome.png'),
      black:  modelAsset('electric', 'solo', 'bodies/front/strap buttons/standard/black.png'),
      gold:  modelAsset('electric', 'solo', 'bodies/front/strap buttons/standard/gold.png'),
    },
    switch:  modelAsset('electric', 'solo', 'bodies/front/switches/blade/black.png'),
    pickguard: null,
    shadows:  modelAsset('electric', 'solo', 'shadows_highlights/edge-shadow.png'),
    gloss:  modelAsset('electric', 'solo', 'shadows_highlights/gloss.png'),
  },
  dc: {
    bridge: BRIDGE_OPTIONS.floydRoseTremolo.assets,
    knobs: {
      chrome:  modelAsset('electric', 'dc', 'bodies/front/knobs/white-pearl-dtmv.png'),
      black:  modelAsset('electric', 'dc', 'bodies/front/knobs/black-dtmv.png'),
      gold:  modelAsset('electric', 'dc', 'bodies/front/knobs/white-pearl-inlay.png'),
    },
    strap: {
      chrome:  modelAsset('electric', 'dc', 'bodies/front/strap buttons/standard/chrome.png'),
      black:  modelAsset('electric', 'dc', 'bodies/front/strap buttons/standard/black.png'),
      gold:  modelAsset('electric', 'dc', 'bodies/front/strap buttons/standard/chrome.png'),
    },
    switch:  modelAsset('electric', 'dc', 'bodies/front/switches/blade/black.png'),
    pickguard: null,
    shadows:  modelAsset('electric', 'dc', 'shadows_highlights/edge-shadow.png'),
    gloss:  modelAsset('electric', 'dc', 'shadows_highlights/gloss.png'),
  },
  delos: {
    bridge: BRIDGE_OPTIONS.hipshotTremolo.assets,
    knobs: {
      chrome: modelAsset('electric', 'delos', 'bodies/front/knobs/white-plastic-dtmv.png'),
      black: modelAsset('electric', 'delos', 'bodies/front/knobs/black-dtmv.png'),
      gold: modelAsset('electric', 'delos', 'bodies/front/knobs/white-pearl-inlay-dtmv.png'),
    },
    strap: {
      chrome: modelAsset('electric', 'delos', 'bodies/front/strap buttons/standard/chrome.png'),
      black: modelAsset('electric', 'delos', 'bodies/front/strap buttons/standard/black.png'),
      gold: modelAsset('electric', 'delos', 'bodies/front/strap buttons/standard/chrome.png'),
    },
    switch: modelAsset('electric', 'delos', 'bodies/front/switches/blade/black.png'),
    pickguard: modelAsset('electric', 'delos', 'bodies/front/pickguard/white.png'),
    shadows: modelAsset('electric', 'delos', 'shadows_highlights/edge-shadow.png'),
    gloss: modelAsset('electric', 'delos', 'shadows_highlights/gloss.png'),
  },
}

export const PUPPY = {
  single: {
    route: {
      chrome: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-neck.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-neck.png'),
      },
    },
    body: {
      chrome: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-neck.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-neck.png'),
      },
    },
    poles: {
      chrome: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-middle.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-neck.png'),
      },
    },
  },
  humbucker: {
    route: {
      chrome: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/neck.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/neck.png'),
      },
    },
    body: {
      chrome: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/chrome-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-neck.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/chrome-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-neck.png'),
      },
    },
    poles: {
      chrome: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-neck.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-neck.png'),
      },
    },
  },
}

PUPPY.p90 = {
  route: PUPPY.humbucker.route,
  body: {
    chrome: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-bridge-black.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-neck-black.png'),
    },
    black: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-bridge-black.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-neck-black.png'),
    },
    gold: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-bridge-black.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-neck-black.png'),
    },
  },
  poles: {
    chrome: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-bridge.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-neck.png'),
    },
    black: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-bridge.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-neck.png'),
    },
    gold: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-bridge.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-neck.png'),
    },
  },
}

PUPPY.fluence = {
  route: PUPPY.humbucker.route,
  body: {
    chrome: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck.png'),
    },
    black: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck.png'),
    },
    gold: {
      bridge: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge.png'),
      neck: asset('all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck.png'),
    },
  },
  poles: PUPPY.humbucker.poles,
}

// ============================================================
// NEW CUSTOMIZATION SCHEMA (General / Body / Neck / Electronics / Hardware)
// Images are left null where no Cloudinary asset is mapped yet.
// ============================================================

export const DEXTERITY_OPTIONS = {
  right: { label: 'Right Handed', note: 'Standard orientation', price: 0, specs: specs() },
  left: { label: 'Left Handed', note: 'Reversed orientation', price: 0, specs: specs() },
}

export const STRING_COUNT_OPTIONS = {
  '6': { label: '6 Strings', note: 'Standard six-string', price: 0, specs: specs() },
  '7': { label: '7 Strings', note: 'Extended range', price: 0, specs: specs() },
  '8': { label: '8 Strings', note: 'Extended range', price: 0, specs: specs() },
}

export const MULTISCALE_OPTIONS = {
  off: { label: 'Off', note: 'Straight scale', price: 0, specs: specs() },
  on: { label: 'On', note: 'Multiscale fan', price: 0, specs: specs() },
}

export const SCALE_LENGTH_OPTIONS = {
  '25.5': { label: '25.5"', note: 'Standard scale', price: 0, specs: specs() },
  '26.5': { label: '26.5"', note: 'Baritone scale', price: 0, specs: specs() },
  '27': { label: '27"', note: 'Multiscale low', price: 0, specs: specs() },
}

export const CASE_OPTIONS = {
  none: { label: 'No Case', note: 'No case included', price: 0, specs: specs() },
  gigbag: { label: 'Gig Bag', note: 'Padded gig bag', price: 60, specs: specs() },
  hardcase: { label: 'Hard Case', note: 'Molded hard case', price: 120, specs: specs() },
}

// --- Body ---
export const BEVEL_OPTIONS = {
  off: { label: 'Off', note: 'Square body edges', price: 0, specs: specs() },
  on: { label: 'On', note: 'Beveled body edges', price: 40, specs: specs() },
}

export const TOP_WOOD_OPTIONS = {
  none: { label: 'None', note: 'No top wood', price: 0, specs: specs() },
  'antique-ash': { label: 'Antique Ash', note: 'Vintage ash top', texture: asset('all-models/woods-colors/top-woods/antique-ash.png'), price: 0, specs: specs() },
  'blacked-out-ash': { label: 'Blacked Out Ash', note: 'Dark ash top', texture: asset('all-models/woods-colors/top-woods/blacked-out-ash.png'), price: 0, specs: specs() },
  kalantas: { label: 'Kalantas', note: 'Exotic kalantas top', texture: asset('all-models/woods-colors/top-woods/kalantas-wood.png'), price: 0, specs: specs() },
  kamagong: { label: 'Kamagong', note: 'Dense kamagong top', texture: asset('all-models/woods-colors/top-woods/kamagong-wood.png'), price: 0, specs: specs() },
  mango: { label: 'Mango Wood', note: 'Tropical mango top', texture: asset('all-models/woods-colors/top-woods/mango-wood.png'), price: 0, specs: specs() },
  narra: { label: 'Narra', note: 'Premium narra top', texture: asset('all-models/woods-colors/top-woods/narra-wood.png'), price: 0, specs: specs() },
  'ph-mahogany': { label: 'Philippine Mahogany', note: 'Classic mahogany top', texture: asset('all-models/woods-colors/top-woods/ph-mahogany.jpg'), price: 0, specs: specs() },
  'swamp-ash': { label: 'Swamp Ash', note: 'Light swamp ash top', texture: asset('all-models/woods-colors/top-woods/swamp-ash.png'), price: 0, specs: specs() },
  zebrawood: { label: 'Zebrawood', note: 'Exotic striped zebrawood top', texture: asset('all-models/woods-colors/top-woods/zebrawood.png'), price: 0, specs: specs() },
}

export const FINISH_TYPE_OPTIONS = {
  metallic: { label: 'Metallic', note: 'Metallic flake finish', texture: null, price: 35, specs: specs() },
  translucent: { label: 'Translucent', note: 'Tinted translucent finish', texture: null, price: 35, specs: specs() },
  sparkle: { label: 'Sparkle', note: 'Sparkle finish', texture: null, price: 40, specs: specs() },
}

export const TOP_COAT_OPTIONS = {
  clearGloss: { label: 'Clear Gloss', note: 'High-gloss clear coat', price: 0, specs: specs(), fileKey: 'gloss' },
  tungOil: { label: 'Tung Oil', note: 'Natural tung oil finish', price: 0, specs: specs(), fileKey: 'matte-tung-oil' },
  satinMatte: { label: 'Satin Matte', note: 'Low-sheen satin', price: 0, specs: specs(), fileKey: 'gloss-matte' },
}

export const BURST_FINISH_OPTIONS = {
  none: { label: 'None', note: 'No burst', price: 0, specs: specs() },
  blackBurst: { label: 'Black Burst Edges', note: 'Black burst edges', texture: modelAsset('electric', 'dc', 'bodies/front/masks/bvdmask.png'), color: '#000000', price: 45, specs: specs() },
  whiteBurst: { label: 'White Burst Edges', note: 'White burst edges', texture: modelAsset('electric', 'dc', 'bodies/front/masks/bvdmask.png'), color: '#ffffff', price: 45, specs: specs() },
  translucentBlackBurst: { label: 'Translucent Black Burst Edges', note: 'Translucent black burst', texture: null, color: '#1a1a1a', price: 50, specs: specs() },
  reverseTranslucentBlackBurst: { label: 'Reverse Translucent Black Burst', note: 'Reverse translucent black burst', texture: null, color: '#1a1a1a', price: 55, specs: specs() },
  blackBackSides: { label: 'Black Back & Sides', note: 'Black rear finish', texture: null, color: '#000000', price: 55, specs: specs(), rearOnly: true },
  blackSidesBlackBurstBack: { label: 'Black Sides w/ Black Burst Back (Clear Center)', note: 'Black sides with black burst back', texture: modelAsset('electric', 'dc', 'back/masks/burstmask.png'), color: '#000000', price: 65, specs: specs(), rearOnly: true },
}

// --- Neck ---
export const NECK_CONSTRUCTION_OPTIONS = {
  '1piece': { label: '1-Piece', note: 'Single-piece neck', price: 0, specs: specs() },
  '3piece': { label: '3-Piece', note: 'Three-piece neck', price: 0, specs: specs() },
  '5piece': { label: '5-Piece', note: 'Five-piece neck', price: 0, specs: specs() },
}

export const FRET_OPTIONS = {
  stainlessMedJumbo: { label: 'Stainless Med-Jumbo (.048" H × .103" W)', note: 'Medium jumbo stainless frets', src: null, price: 60, specs: specs() },
  stainlessRegular: { label: 'Stainless Regular (.043" H × .080" W)', note: 'Regular stainless frets', src: null, price: 50, specs: specs() },
  regularNickel: { label: 'Regular Nickel', note: 'Standard nickel frets', src: null, price: 0, specs: specs() },
  stainlessJumbo: { label: 'Stainless Jumbo (.055" H × .110" W)', note: 'Jumbo stainless frets', src: null, price: 70, specs: specs() },
}

export const NECK_REAR_FINISH_OPTIONS = {
  tungOil: { label: 'Tung Oil Neck', note: 'Tung oil neck finish', price: 0, specs: specs(), fileKey: 'matte-tung-oil' },
  paintedGloss: { label: 'Painted Gloss Neck Finish (Match Body Color)', note: 'Painted gloss neck finish matching body color', price: 0, specs: specs(), fileKey: 'gloss', requiresColor: true, disclaimer: 'Adding a satin or gloss neck finish will add ~0.040" to the neck profile. Neck thickness listed in model specs is based on tung oil finishes.' },
  clearGloss: { label: 'Clear Gloss Neck Finish', note: 'Clear gloss neck finish', price: 0, specs: specs(), fileKey: 'gloss', clear: true, incompatibleWith: ['satinMatte'] },
  paintedSatin: { label: 'Painted Satin Neck Finish (Match Body Color)', note: 'Painted satin neck finish matching body color', price: 0, specs: specs(), fileKey: 'matte', requiresColor: true, disclaimer: 'Adding a satin or gloss neck finish will add ~0.040" to the neck profile. Neck thickness listed in model specs is based on tung oil finishes.' },
  clearSatin: { label: 'Clear Satin Neck Finish', note: 'Clear satin neck finish', price: 0, specs: specs(), fileKey: 'matte', clear: true, disclaimer: 'Adding a satin or gloss neck finish will add ~0.040" to the neck profile. Neck thickness listed in model specs is based on tung oil finishes.' },
}

export const HEADSTOCK_SHAPE_OPTIONS = {
  gt6: { label: 'GT6', note: 'Straight 6-in-line', src: null, price: 0, specs: specs() },
  gt6r: { label: 'GT6R', note: 'Reverse 6-in-line', src: null, price: 20, specs: specs() },
  '6in': { label: '6 Inline', note: 'Standard 6 inline', src: null, price: 0, specs: specs() },
  '6inr': { label: '6 Inline Reverse', note: 'Reverse 6 inline', src: null, price: 20, specs: specs() },
  '6kr': { label: '6 KR', note: '6 KR headstock', src: null, price: 0, specs: specs() },
  '624': { label: '2×4', note: '2×4 headstock', src: null, price: 20, specs: specs() },
  h33: { label: 'H33', note: 'Classic inline', src: null, price: 45, specs: specs() },
  h33r: { label: 'H33R', note: 'Reverse inline', src: null, price: 55, specs: specs() },
}

export const TRUSS_ROD_COVER_OPTIONS = {
  black: { label: 'Black', note: 'Black truss rod cover', src: null, price: 0, specs: specs() },
  creme: { label: 'Cream', note: 'Cream truss rod cover', src: null, price: 10, specs: specs() },
  white: { label: 'White', note: 'White truss rod cover', src: null, price: 10, specs: specs() },
  'red-tortoise': { label: 'Red Tortoise', note: 'Red tortoise cover', src: null, price: 15, specs: specs() },
  pearloid: { label: 'Pearloid', note: 'Pearloid truss rod cover', src: null, price: 15, specs: specs() },
  ebony: { label: 'Ebony', note: 'Ebony truss rod cover', src: null, price: 20, specs: specs() },
  purpleheart: { label: 'Purpleheart', note: 'Purpleheart truss rod cover', src: null, price: 25, specs: specs() },
}

// --- Electronics ---
// Responsible for defining electronics type options (passive/active)
export const ELECTRONICS_TYPE_OPTIONS = {
  passive: { label: 'Passive', note: 'Standard passive electronics', price: 0, specs: specs() },
  active: { label: 'Active', note: 'Active preamp electronics', price: 80, specs: specs() },
}

// Responsible for defining pickup configuration options (HH / H-S-H)
export const PICKUP_CONFIGURATION_OPTIONS = {
  hh: { label: 'Two Humbuckers (HH)', note: 'Dual humbuckers', price: 135, specs: specs() },
  hss: { label: 'Humbucker - Single - Humbucker (H-S-H)', note: 'Bridge humbucker, middle single, neck humbucker', price: 110, specs: specs() },
}

// Responsible for defining bridge humbucker pickup model options
export const PICKUP_MODEL_BRIDGE_OPTIONS = {
  beryllium: { label: 'Beryllium Humbucker', note: 'Beryllium bridge pickup', src: null, price: 0, specs: specs() },
  holdsworth: { label: 'Holdsworth Humbucker', note: 'Holdsworth bridge pickup', src: null, price: 0, specs: specs() },
  lithium: { label: 'Lithium Humbucker', note: 'Lithium bridge pickup', src: null, price: 0, specs: specs() },
  illusionist: { label: 'Illusionist Humbucker', note: 'Illusionist bridge pickup', src: null, price: 0, specs: specs() },
  m12sd: { label: 'M12SD', note: 'M12SD bridge pickup', src: null, price: 0, specs: specs() },
  thorium: { label: 'Thorium Humbucker', note: 'Thorium bridge pickup', src: null, price: 0, specs: specs() },
  vantium: { label: 'Vantium Humbucker', note: 'Vantium bridge pickup', src: null, price: 0, specs: specs() },
}

// Responsible for defining middle pickup model options (single coil variants)
export const PICKUP_MODEL_MIDDLE_OPTIONS = {
  none: { label: 'None', note: 'No middle pickup', src: null, price: 0, specs: specs() },
  singleCoil: { label: 'Single Coil Models', note: 'Single coil middle models', src: null, price: 0, specs: specs() },
}

// Responsible for defining neck humbucker pickup model options
export const PICKUP_MODEL_NECK_OPTIONS = {
  beryllium: { label: 'Beryllium Humbucker', note: 'Beryllium neck pickup', src: null, price: 0, specs: specs() },
  holdsworth: { label: 'Holdsworth Humbucker', note: 'Holdsworth neck pickup', src: null, price: 0, specs: specs() },
  lithium: { label: 'Lithium Humbucker', note: 'Lithium neck pickup', src: null, price: 0, specs: specs() },
  empyrean: { label: 'Empyrean Humbucker', note: 'Empyrean neck pickup', src: null, price: 0, specs: specs() },
  vantium: { label: 'Vantium Humbucker', note: 'Vantium neck pickup', src: null, price: 0, specs: specs() },
  delete: { label: 'Delete Neck Pickup', note: 'Remove neck pickup', src: null, price: 0, specs: specs() },
}

// Responsible for defining pickup color/style options (bobbins, painted, wooden, covers)
export const PICKUP_COLOR_OPTIONS = {
  bobbins: { label: 'Bobbin Colors', note: 'Open coil bobbins', price: 0, specs: specs() },
  painted: { label: 'Painted Bobbins (RGB)', note: 'Custom RGB painted bobbins', price: 10, specs: specs() },
  wooden: { label: 'Wooden Bobbins', note: 'Wood grain bobbins', price: 15, specs: specs() },
  covers: { label: 'Covers', note: 'Covered pickup style', price: 10, specs: specs() },
}

// Responsible for defining pickup pole piece color options (black, silver, gold)
export const PICKUP_POLE_COLOR_OPTIONS = {
  black: { label: 'Black', note: 'Black pole pieces', src: null, price: 0, specs: specs() },
  silver: { label: 'Silver', note: 'Silver pole pieces', src: null, price: 10, specs: specs() },
  gold: { label: 'Gold', note: 'Gold pole pieces', src: null, price: 10, specs: specs() },
}

// Responsible for defining controls layout options (Off, DTC, DTMV)
export const CONTROLS_OPTIONS = {
  off: { label: 'Off', note: 'Standard control layout', price: 0, specs: specs() },
  deleteTone: { label: 'Delete Tone Control', note: 'Remove tone control', price: 0, specs: specs() },
  deleteToneMoveVolume: { label: 'Delete Tone Control and Move Volume to Tone Position', note: 'Move volume to tone position', price: 0, specs: specs() },
}

// Legacy export kept for bass builder compatibility
export const PICKUP_BOBBIN_OPTIONS = {}

// --- Hardware ---
export const SADDLE_OPTIONS = {
  chrome: { label: 'Chrome', note: 'Chrome saddle', price: 0, specs: specs() },
  black: { label: 'Black', note: 'Black saddle', price: 0, specs: specs() },
  gold: { label: 'Gold', note: 'Gold saddle', price: 0, specs: specs() },
}

export const NUT_OPTIONS = {
  blackGraphTech: { label: 'Black Graph Tech TUSQ Nut', note: 'Black TUSQ nut', assetKey: 'black', price: 25, specs: { size: '', dimensions: '', material: '', notes: '' } },
  ivoryGraphTech: { label: 'Ivory Graph Tech TUSQ Nut', note: 'Ivory TUSQ nut', assetKey: 'white', price: 25, specs: { size: '', dimensions: '', material: '', notes: '' } },
}

export const TUNING_OPTIONS = {
  eStandard: { label: 'E Standard (10-46)', note: 'Standard tuning gauge', price: 0, specs: specs() },
  dStandard: { label: 'D Standard (10-46)', note: 'Down a step', price: 0, specs: specs() },
  cStandard: { label: 'C Standard (11-56)', note: 'Requires custom nut filing', price: 0, specs: specs() },
  dropC: { label: 'Drop C (10-52)', note: 'Requires custom nut filing', price: 0, specs: specs() },
  dropB: { label: 'Drop B (11-56)', note: 'Requires custom nut filing', price: 0, specs: specs() },
}
export const TUNING_DISCLAIMER =
  'Alternative tunings requiring string gauges other than 10-46 necessitate custom ' +
  'nut filing. Should cancellation or return occur, a $200 restocking and setup fee ' +
  'will apply to cover nut replacement, restringing, and complete instrument setup ' +
  'to restore standard tuning specifications.'

export const STRING_BRAND_OPTIONS = {
  elixir1046: { label: 'Elixir 1046E', note: 'Standard gauge', price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
  elixir942: { label: 'Elixir 942E Super Light Gauge Strings', note: 'Super light gauge', price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
}

export const KNOB_STYLE_OPTIONS = {
  plasticBlack: { label: 'Black Plastic', fileKey: 'plasticblack', price: 0, specs: specs() },
  chrome: { label: 'No Style', fileKey: '', price: 15, specs: specs() },
  plasticWhite: { label: 'White Plastic', fileKey: 'plasticwhite', price: 0, specs: specs() },
  abaloneInlay: { label: 'Metal Knobs w/ Abalone Inlays', fileKey: 'abalone-inlay', price: 30, specs: specs() },
  whitePearlInlay: { label: 'Metal Knobs w/ White Pearl Inlays', fileKey: 'white-pearl-inlay', price: 25, specs: specs() },
  tamarind: { label: 'Tamarind Wood', fileKey: 'tamarind', price: 20, specs: specs() },
}

export const OUTPUT_JACK_OPTIONS = {
  off: { label: 'Off', note: 'No output jack shown', price: 0, specs: specs() },
  on: { label: 'On', note: 'Output jack installed, matches hardware color', price: 0, specs: specs() },
}

export const STRAP_BUTTON_OPTIONS = {
  standard: { label: 'Standard', note: 'Standard strap buttons', styleFolder: 'standard', price: 10, specs: specs() },
  dunlopStraplocks: { label: 'Dunlop Straplocks', note: 'Locking strap buttons', styleFolder: 'straplocks', price: 25, specs: specs() },
}

export const TUNER_BUTTON_OPTIONS = {
  none: { label: 'None', note: 'No tuner button style overlay', styleKey: null, price: 0, specs: specs() },
  whitePearloid: { label: 'White Pearloid', note: 'Pearloid tuner buttons', styleKey: 'whitepearl', price: 15, specs: specs() },
  black: { label: 'Black', note: 'Black tuner buttons', styleKey: 'black', price: 0, specs: specs() },
}

export const ELECTRONICS_CAVITY_COVER_OPTIONS = {
  black: { label: 'Black', note: 'Black electronics cavity cover', fileKey: 'black', price: 0, specs: specs() },
  ebony: { label: 'Ebony', note: 'Ebony electronics cavity cover', fileKey: 'ebony', price: 15, specs: specs() },
}

export const TREMOLO_COVER_OPTIONS_BY_BRIDGE = {
  hipshotTremolo: {
     ebony: { label: 'Ebony', note: 'Ebony tremolo cover', fileKey: 'ebony-trem-cover', price: 15, specs: specs() },
    black: { label: 'Black', note: 'Black tremolo cover', fileKey: 'trem-cover', price: 0, specs: specs() },
  },
  floydRoseTremolo: {
    black: { label: 'Black', note: 'Black Floyd Rose cover', fileKey: 'floyd', price: 0, specs: specs() },
    ebony: { label: 'Ebony', note: 'Ebony Floyd Rose cover', fileKey: 'floyd-ebony', price: 15, specs: specs() },
    roastedFlameMaple: { label: 'Roasted Flame Maple', note: 'Roasted flame maple cover', fileKey: 'floyd-rfm', price: 25, specs: specs() },
  },
}

export function resolveVariant(source, colorKey) {
  if (!source) return null
  if (typeof source === 'string') return source
  return source[colorKey] ?? source.chrome ?? source.black ?? source.gold ?? null
}



export const guitarBuilder = {
  DEFAULT_CONFIG,
  BASE_PRICE,
  // existing
  GUITAR_TYPE_OPTIONS,
  BODY_OPTIONS,
  BODY_WOOD_OPTIONS,
  BODY_FINISH_OPTIONS,
  NECK_OPTIONS,
  FRETBOARD_OPTIONS,
  NECK_MASK,
  NECK_FRETS,
  NECK_NUT,
  HEADSTOCK_WOOD_OPTIONS,
  INLAY_OPTIONS,
  BRIDGE_OPTIONS,
  PICKGUARD_OPTIONS_BY_BODY,
  KNOB_OPTIONS_BY_BODY,
  HEADSTOCK_OPTIONS,
  HARDWARE_OPTIONS,
  PICKUP_OPTIONS,
  PREVIEW_LAYOUTS,
  BODY_LAYER_ASSETS,
  PUPPY,
  resolveVariant,
  // new schema
  DEXTERITY_OPTIONS,
  STRING_COUNT_OPTIONS,
  MULTISCALE_OPTIONS,
  SCALE_LENGTH_OPTIONS,
  CASE_OPTIONS,
  BEVEL_OPTIONS,
  TOP_WOOD_OPTIONS,
  FINISH_TYPE_OPTIONS,
  TOP_COAT_OPTIONS,
  BURST_FINISH_OPTIONS,
  NECK_CONSTRUCTION_OPTIONS,
  INLAY_SHAPE_OPTIONS,
  INLAY_MATERIAL_OPTIONS,
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
   KNOB_STYLE_OPTIONS,
   TREMOLO_COVER_OPTIONS_BY_BRIDGE,
}
