// Repointed to Cloudinary collection: cosmoscraft_assets/electric_assets
// Falls back to local /builder/ directory when Cloudinary is not configured.
const CLOUD_NAME = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME : ''
const USE_CLOUDINARY = Boolean(CLOUD_NAME) && !import.meta.env.DEV

export const cloudImage = (root, path) => {
  if (USE_CLOUDINARY) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${root}/${path}`
  }
  // Local fallback - serve from public/builder/
  return `/builder/${path}`
}

export const asset = (path) => {
  if (USE_CLOUDINARY) {
    if (path.startsWith('dc_assets/') || path.startsWith('delos_assets/')) {
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/electric_assets/${path}`
    }
    if (path.startsWith('delos/')) {
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/electric_assets/delos_assets/models/${path}`
    }
    if (path.startsWith('dc/') || path.startsWith('rs/') || path.startsWith('solo/')) {
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/electric_assets/dc_assets/models/${path}`
    }
    // Shared assets (all-models/...) live under dc_assets/models/
    if (path.startsWith('all-models/')) {
      return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/electric_assets/dc_assets/models/${path}`
    }
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/cosmoscraft_assets/electric_assets/${path}`
  }
  // Local fallback - serve from public/builder/
  // If path starts with a model prefix that already includes the `_assets` directory, use as-is.
  if (path.startsWith('dc_assets/') || path.startsWith('delos_assets/')) {
    return `/builder/electric_assets/${path}`
  }
  // Model-specific paths without _assets should map to their actual local model directories.
  if (path.startsWith('delos/')) {
    return `/builder/electric_assets/delos_assets/models/${path}`
  }
  if (path.startsWith('dc/') || path.startsWith('rs/') || path.startsWith('solo/')) {
    return `/builder/electric_assets/dc_assets/models/${path}`
  }
  // Shared assets (all-models/...) live under dc_assets/models/
  return `/builder/electric_assets/dc_assets/models/${path}`
}

export const woodAsset = path => {
  // Wood type textures are served from public/woodtype/ (not uploaded to Cloudinary)
  return `/woodtype/${path}`
}

export const DEFAULT_CONFIG = {
  guitarType: 'electric',
  body: 'dc',
  bodyWood: 'rosewood',
  bodyFinish: 'none',
  neck: 'maple',
  fretboard: 'rosewood',
  headstockWood: 'plain-maple',
  inlays: 'pearl',
  bridge: 'hipshotFixed',
  knobs: 'black',
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
  neckRearFinish: 'none',
  headstockShape: 'gt6',
  trussRodCover: 'black',
  electronicsType: 'passive',
  pickupConfiguration: 'hss',
  bridgePickupModel: 'beryllium',
  middlePickupModel: 'none',
  neckPickupModel: 'beryllium',
  pickupBobbin: 'standard',
  pickupPoleColor: 'black',
  controls: 'standard',
  saddle: 'chrome',
  nut: 'blackGraphTech',
  tuning: 'eStandard',
  stringBrand: 'elixir1046',
  outputJack: 'none',
  strapButtons: 'off',
  tunerButtons: 'off',
  electronicsCavityCover: 'none',
  tremoloCover: 'none',
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
    bodySrc: asset('rs/bodies/front/masks/bodymask.png'),
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  solo: {
    label: 'Solo',
    note: 'Modern singlecut body',
    bodySrc: asset('solo/bodies/front/masks/bv-bodymask.png'),
    price: 150,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  dc: {
    label: 'DC',
    note: 'Double-cut access',
    bodySrc: asset('dc/bodies/front/masks/bodymask.png'),
    price: 180,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  delos: {
    label: 'Delos',
    note: 'Contoured body build',
    bodySrc: asset('delos/bodies/front/masks/bodymask.png'),
    price: 220,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['electric'],
  },
  precision: {
    label: 'Precision',
    note: 'Classic precision bass',
    bodySrc: asset('rs/bodies/front/masks/bodymask.png'),
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['bass'],
  },
  jazz: {
    label: 'Jazz',
    note: 'Modern jazz bass',
    bodySrc: asset('solo/bodies/front/masks/bv-bodymask.png'),
    price: 150,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    types: ['bass'],
  },
}

export const BODY_WOOD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright even grain',
    texture: woodAsset('maple.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Warm dark grain',
    texture: woodAsset('rosewood.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ebony: {
    label: 'Ebony',
    note: 'Deep dark grain',
    texture: woodAsset('ebony.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  pauFerro: {
    label: 'Pau Ferro',
    note: 'Balanced brown grain',
    texture: woodAsset('pau-ferro.jpg'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  indianLaurel: {
    label: 'Indian Laurel',
    note: 'Subtle mid-brown grain',
    texture: woodAsset('indian-laurel.jpg'),
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
  maple: {
    label: 'Maple',
    note: 'Bright neck feel',
    src: asset('all-models/woods-colors/neck-woods/plain-maple.png'),
    price: 0,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    filter: 'none',
  },
  roasted: {
    label: 'Roasted',
    note: 'Dark roasted finish',
    src: asset('all-models/woods-colors/neck-woods/plain-maple.png'),
    price: 75,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    filter: 'sepia(0.65) saturate(1.15) brightness(0.82) contrast(1.05)',
  },
  walnut: {
    label: 'Walnut',
    note: 'Warm darker neck',
    src: asset('all-models/woods-colors/neck-woods/plain-maple.png'),
    price: 95,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    filter: 'sepia(0.9) saturate(1.15) brightness(0.55) contrast(1.08)',
  },
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
  white: asset('all-models/necks/6-string/front/24-fret-front/standard/nut/black.png'),
  black: asset('all-models/necks/6-string/front/24-fret-front/standard/nut/black.png'),
}

export const HEADSTOCK_WOOD_OPTIONS = {
  rosewood: {
    label: 'Rosewood',
    note: 'Warm headstock wood',
    texture: asset('all-models/woods-colors/headstock-woods/rosewood.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ebony: {
    label: 'Ebony',
    note: 'Dark premium wood',
    texture: asset('all-models/woods-colors/headstock-woods/ebony.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  'plain-maple': {
    label: 'Plain Maple',
    note: 'Light plain maple headstock',
    texture: asset('all-models/woods-colors/headstock-woods/plain-maple.png'),
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
      gold: asset('all-models/bridges/6/standard/hipshot-trem/hipshot-trem-chrome.png'),
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
}

export const PICKGUARD_OPTIONS_BY_BODY = {
  strat: {
    white: {
      label: 'White',
      note: 'Classic white guard',
      src: asset('rs/bodies/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'White Pearl',
      note: 'Bright pearloid finish',
      src: asset('rs/bodies/front/pickguard/white-pearloid.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    black: {
      label: 'Black',
      note: 'Dark contrasting guard',
      src: asset('rs/bodies/front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: asset('rs/bodies/front/pickguard/red-tortoise.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  delos: {
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: asset('delos/bodies/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'White Pearl',
      note: 'White pearloid guard',
      src: asset('delos/bodies/front/pickguard/white-pearloid.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    black: {
      label: 'Black',
      note: 'Satin black guard',
      src: asset('delos/bodies/front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    satinBlack: {
      label: 'Satin Black',
      note: 'Low-key satin finish',
      src: asset('delos/bodies/front/pickguard/satin-black.png'),
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
      src: asset('rs/bodies/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: asset('rs/bodies/front/knobs/tamarind.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: asset('rs/bodies/front/knobs/white-pearl-inlay.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abalone: {
      label: 'Abalone',
      note: 'Premium abalone inlay',
      src: asset('rs/bodies/front/knobs/abalone-inlay.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  solo: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('solo/bodies/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackPlastic: {
      label: 'Black Plastic',
      note: 'Smooth black plastic',
      src: asset('solo/bodies/front/knobs/black-plastic.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    whitePlastic: {
      label: 'White Plastic',
      note: 'Bright white plastic',
      src: asset('solo/bodies/front/knobs/white-plastic.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: asset('solo/bodies/front/knobs/chrome.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  dc: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('dc/bodies/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    dtmv: {
      label: 'Black DTMV',
      note: 'Modern black DTMV',
      src: asset('dc/bodies/front/knobs/black-dtmv.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    dtc: {
      label: 'Black DTC',
      note: 'Modern black DTC',
      src: asset('dc/bodies/front/knobs/black-dtc.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    plasticBlack: {
      label: 'Plastic Black',
      note: 'Plain black plastic',
      src: asset('dc/bodies/front/knobs/plasticblack.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    plasticWhite: {
      label: 'Plastic White',
      note: 'Plain white plastic',
      src: asset('dc/bodies/front/knobs/plasticwhite.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  delos: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('delos/bodies/front/knobs/black-dtmv.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackPlastic: {
      label: 'Black Plastic',
      note: 'Black plastic DTMV',
      src: asset('delos/bodies/front/knobs/black-plastic-dtmv.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    whitePlastic: {
      label: 'White Plastic',
      note: 'White plastic DTMV',
      src: asset('delos/bodies/front/knobs/white-plastic-dtmv.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay DTMV',
      src: asset('delos/bodies/front/knobs/white-pearl-inlay-dtmv.png'),
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
  pth: {
    label: 'Pointed',
    note: 'Pointed headstock',
    mask: asset('all-models/headstocks/6/masks/pth/mask.png'),
    logo: null,
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/pth/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/pth/black.png'),
      gold: asset('all-models/headstocks/6/tuners/pth/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/pth.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  pthr: {
    label: 'Pointed Reverse',
    note: 'Reverse pointed',
    mask: asset('all-models/headstocks/6/masks/pthr/mask.png'),
    logo: null,
    tuners: {
      chrome: asset('all-models/headstocks/6/tuners/pthr/chrome.png'),
      black: asset('all-models/headstocks/6/tuners/pthr/black.png'),
      gold: asset('all-models/headstocks/6/tuners/pthr/gold.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/pthr.png'),
    trussCover: asset('all-models/headstocks/6/truss-cover/black.png'),
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
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
  sss: {
    label: 'SSS',
    note: 'Three single coils',
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  hss: {
    label: 'HSS',
    note: 'Bridge humbucker, singles',
    price: 110, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  hh: {
    label: 'HH',
    note: 'Dual humbuckers',
    price: 135, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  p90: {
    label: 'P90',
    note: 'P90 bridge and neck set',
    price: 125, specs: { size: '', dimensions: '', material: '', notes: '' }
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
      chrome: asset('rs/bodies/front/knobs/black.png'),
      black: asset('rs/bodies/front/knobs/black.png'),
      gold: asset('rs/bodies/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: asset('rs/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('rs/bodies/front/strap buttons/standard/black.png'),
      gold: asset('rs/bodies/front/strap buttons/standard/gold.png'),
    },
    switch: asset('rs/bodies/front/switches/blade/black.png'),
    pickguard: {
      chrome: asset('rs/bodies/front/pickguard/white.png'),
      black: asset('rs/bodies/front/pickguard/black.png'),
      gold: asset('rs/bodies/front/pickguard/red-tortoise.png'),
    },
    shadows: asset('rs/shadows_highlights/edge-shadow.png'),
    gloss: asset('rs/shadows_highlights/gloss.png'),
  },
  solo: {
    bridge: BRIDGE_OPTIONS.hipshotFixed.assets,
    knobs: {
      chrome: asset('solo/bodies/front/knobs/chrome.png'),
      black: asset('solo/bodies/front/knobs/black.png'),
      gold: asset('solo/bodies/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: asset('solo/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('solo/bodies/front/strap buttons/standard/black.png'),
      gold: asset('solo/bodies/front/strap buttons/standard/gold.png'),
    },
    switch: asset('solo/bodies/front/switches/blade/black.png'),
    pickguard: null,
    shadows: asset('solo/shadows_highlights/edge-shadow.png'),
    gloss: asset('solo/shadows_highlights/gloss.png'),
  },
  dc: {
    bridge: BRIDGE_OPTIONS.floydRoseTremolo.assets,
    knobs: {
      chrome: asset('dc/bodies/front/knobs/white-pearl-dtmv.png'),
      black: asset('dc/bodies/front/knobs/black-dtmv.png'),
      gold: asset('dc/bodies/front/knobs/white-pearl-inlay.png'),
    },
    strap: {
      chrome: asset('dc/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('dc/bodies/front/strap buttons/standard/black.png'),
      gold: asset('dc/bodies/front/strap buttons/standard/chrome.png'),
    },
    switch: asset('dc/bodies/front/switches/blade/black.png'),
    pickguard: null,
    shadows: asset('dc/shadows_highlights/edge-shadow.png'),
    gloss: asset('dc/shadows_highlights/gloss.png'),
  },
  delos: {
    bridge: BRIDGE_OPTIONS.hipshotTremolo.assets,
    knobs: {
      chrome: asset('delos/bodies/front/knobs/white-plastic-dtmv.png'),
      black: asset('delos/bodies/front/knobs/black-dtmv.png'),
      gold: asset('delos/bodies/front/knobs/white-pearl-inlay-dtmv.png'),
    },
    strap: {
      chrome: asset('delos/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('delos/bodies/front/strap buttons/standard/black.png'),
      gold: asset('delos/bodies/front/strap buttons/standard/chrome.png'),
    },
    switch: asset('delos/bodies/front/switches/blade/black.png'),
    pickguard: asset('delos/bodies/front/pickguard/white.png'),
    shadows: asset('delos/shadows_highlights/edge-shadow.png'),
    gloss: asset('delos/shadows_highlights/gloss.png'),
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

const specs = () => ({ size: '', dimensions: '', material: '', notes: '' })

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
  maple: { label: 'Maple Top', note: 'Bright top wood', texture: null, price: 0, specs: specs() },
  walnut: { label: 'Walnut Top', note: 'Warm top wood', texture: null, price: 0, specs: specs() },
  mahogany: { label: 'Mahogany Top', note: 'Classic top wood', texture: null, price: 0, specs: specs() },
}

export const FINISH_TYPE_OPTIONS = {
  metallic: { label: 'Metallic', note: 'Metallic flake finish', texture: null, price: 35, specs: specs() },
  translucent: { label: 'Translucent', note: 'Tinted translucent finish', texture: null, price: 35, specs: specs() },
  sparkle: { label: 'Sparkle', note: 'Sparkle finish', texture: null, price: 40, specs: specs() },
}

export const TOP_COAT_OPTIONS = {
  clearGloss: { label: 'Clear Gloss', note: 'High-gloss clear coat', price: 0, specs: specs() },
  tungOil: { label: 'Tung Oil', note: 'Natural tung oil finish', price: 0, specs: specs() },
  satinMatte: { label: 'Satin Matte', note: 'Low-sheen satin', price: 0, specs: specs() },
}

export const BURST_FINISH_OPTIONS = {
  none: { label: 'None', note: 'No burst', price: 0, specs: specs() },
  blackBurst: { label: 'Black Burst Edges', note: 'Black burst edges', texture: null, price: 45, specs: specs() },
  whiteBurst: { label: 'White Burst Edges', note: 'White burst edges', texture: null, price: 45, specs: specs() },
  translucentBlackBurst: { label: 'Translucent Black Burst Edges', note: 'Translucent black burst', texture: null, price: 50, specs: specs() },
  reverseTranslucentBlackBurst: { label: 'Reverse Translucent Black Burst', note: 'Reverse translucent black burst', texture: null, price: 55, specs: specs() },
}

// --- Neck ---
export const NECK_CONSTRUCTION_OPTIONS = {
  '1piece': { label: '1-Piece', note: 'Single-piece neck', price: 0, specs: specs() },
  '3piece': { label: '3-Piece', note: 'Three-piece neck', price: 0, specs: specs() },
  '5piece': { label: '5-Piece', note: 'Five-piece neck', price: 0, specs: specs() },
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
}

export const FRET_OPTIONS = {
  stainlessMedJumbo: { label: 'Stainless Med-Jumbo (.048" H × .103" W)', note: 'Medium jumbo stainless frets', src: null, price: 60, specs: specs() },
  stainlessRegular: { label: 'Stainless Regular (.043" H × .080" W)', note: 'Regular stainless frets', src: null, price: 50, specs: specs() },
  regularNickel: { label: 'Regular Nickel', note: 'Standard nickel frets', src: null, price: 0, specs: specs() },
  stainlessJumbo: { label: 'Stainless Jumbo (.055" H × .110" W)', note: 'Jumbo stainless frets', src: null, price: 70, specs: specs() },
}

export const NECK_REAR_FINISH_OPTIONS = {
  none: { label: 'None', note: 'Natural neck rear', price: 0, specs: specs() },
  tungOilNeck: { label: 'Tung Oil Neck', note: 'Tung oil neck finish', price: 0, specs: specs() },
}

export const HEADSTOCK_SHAPE_OPTIONS = {
  gt6: { label: 'GT6', note: 'Straight 6-in-line', src: null, price: 0, specs: specs() },
  gt6r: { label: 'GT6R', note: 'Reverse 6-in-line', src: null, price: 20, specs: specs() },
  '6in': { label: '6 Inline', note: 'Standard 6 inline', src: null, price: 0, specs: specs() },
  '6inr': { label: '6 Inline Reverse', note: 'Reverse 6 inline', src: null, price: 20, specs: specs() },
  '6kr': { label: '6 KR', note: '6 KR headstock', src: null, price: 0, specs: specs() },
  '624': { label: '2×4', note: '2×4 headstock', src: null, price: 20, specs: specs() },
  pth: { label: 'Pointed', note: 'Pointed headstock', src: null, price: 25, specs: specs() },
  pthr: { label: 'Pointed Reverse', note: 'Reverse pointed', src: null, price: 25, specs: specs() },
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
export const ELECTRONICS_TYPE_OPTIONS = {
  passive: { label: 'Passive', note: 'Standard passive electronics', price: 0, specs: specs() },
  active: { label: 'Active', note: 'Active preamp electronics', price: 80, specs: specs() },
}

export const PICKUP_CONFIGURATION_OPTIONS = {
  hh: { label: 'Two Humbuckers (HH)', note: 'Dual humbuckers', price: 135, specs: specs() },
  hss: { label: 'Humbucker - Single - Single (HSS)', note: 'Bridge humbucker, two singles', price: 110, specs: specs() },
  sss: { label: 'Three Single Coils (SSS)', note: 'Three single coils', price: 0, specs: specs() },
  p90p90: { label: 'Two P90s (P90-P90)', note: 'Dual P90 set', price: 125, specs: specs() },
}

export const PICKUP_MODEL_BRIDGE_OPTIONS = {
  beryllium: { label: 'Beryllium Humbucker', note: 'Beryllium bridge pickup', src: null, price: 0, specs: specs() },
  holdsworth: { label: 'Holdsworth Humbucker', note: 'Holdsworth bridge pickup', src: null, price: 0, specs: specs() },
  lithium: { label: 'Lithium Humbucker', note: 'Lithium bridge pickup', src: null, price: 0, specs: specs() },
  illusionist: { label: 'Illusionist Humbucker', note: 'Illusionist bridge pickup', src: null, price: 0, specs: specs() },
  m12sd: { label: 'M12SD', note: 'M12SD bridge pickup', src: null, price: 0, specs: specs() },
  thorium: { label: 'Thorium Humbucker', note: 'Thorium bridge pickup', src: null, price: 0, specs: specs() },
  vantium: { label: 'Vantium Humbucker', note: 'Vantium bridge pickup', src: null, price: 0, specs: specs() },
}

export const PICKUP_MODEL_MIDDLE_OPTIONS = {
  none: { label: 'None', note: 'No middle pickup', src: null, price: 0, specs: specs() },
  singleCoil: { label: 'Single Coil Models', note: 'Single coil middle models', src: null, price: 0, specs: specs() },
}

export const PICKUP_MODEL_NECK_OPTIONS = {
  beryllium: { label: 'Beryllium Humbucker', note: 'Beryllium neck pickup', src: null, price: 0, specs: specs() },
  holdsworth: { label: 'Holdsworth Humbucker', note: 'Holdsworth neck pickup', src: null, price: 0, specs: specs() },
  lithium: { label: 'Lithium Humbucker', note: 'Lithium neck pickup', src: null, price: 0, specs: specs() },
  empyrean: { label: 'Empyrean Humbucker', note: 'Empyrean neck pickup', src: null, price: 0, specs: specs() },
  vantium: { label: 'Vantium Humbucker', note: 'Vantium neck pickup', src: null, price: 0, specs: specs() },
  delete: { label: 'Delete Neck Pickup', note: 'Remove neck pickup', src: null, price: 0, specs: specs() },
}

export const PICKUP_BOBBIN_OPTIONS = {
  standard: { label: 'Standard Bobbins', note: 'Standard bobbin style', src: null, price: 0, specs: specs() },
  painted: { label: 'Painted Bobbins', note: 'Painted bobbin style', src: null, price: 10, specs: specs() },
  wooden: { label: 'Wooden Bobbins', note: 'Wooden bobbin style', src: null, price: 15, specs: specs() },
  covered: { label: 'Covered Pickups', note: 'Covered pickup style', src: null, price: 10, specs: specs() },
}

export const PICKUP_POLE_COLOR_OPTIONS = {
  black: { label: 'Black', note: 'Black pole pieces', src: null, price: 0, specs: specs() },
  chrome: { label: 'Chrome', note: 'Chrome pole pieces', src: null, price: 10, specs: specs() },
  gold: { label: 'Gold', note: 'Gold pole pieces', src: null, price: 10, specs: specs() },
}

export const CONTROLS_OPTIONS = {
  standard: { label: 'Standard Controls', note: 'Standard volume/tone', price: 0, specs: specs() },
  deleteTone: { label: 'Delete Tone Control', note: 'Remove tone control', price: 0, specs: specs() },
  deleteToneMoveVolume: { label: 'Delete Tone Control and Move Volume to Tone Position', note: 'Move volume to tone position', price: 0, specs: specs() },
}

// --- Hardware ---
export const SADDLE_OPTIONS = {
  chrome: { label: 'Chrome', note: 'Chrome saddle', price: 0, specs: specs() },
  black: { label: 'Black', note: 'Black saddle', price: 0, specs: specs() },
  gold: { label: 'Gold', note: 'Gold saddle', price: 0, specs: specs() },
}

export const NUT_OPTIONS = {
  blackGraphTech: { label: 'Black Graph Tech TUSQ', note: 'Black Graph Tech TUSQ nut', price: 25, specs: specs() },
  ivoryGraphTech: { label: 'Ivory Graph Tech TUSQ', note: 'Ivory Graph Tech TUSQ nut', price: 25, specs: specs() },
}

export const TUNING_OPTIONS = {
  eStandard: { label: 'E Standard (10-46)', note: 'E standard tuning', price: 0, specs: specs() },
  dStandard: { label: 'D Standard (10-46)', note: 'D standard tuning', price: 0, specs: specs() },
  cStandard: { label: 'C Standard (11-56)', note: 'C standard tuning', price: 0, specs: specs() },
  dropC: { label: 'Drop C (10-52)', note: 'Drop C tuning', price: 0, specs: specs() },
  dropB: { label: 'Drop B (11-56)', note: 'Drop B tuning', price: 0, specs: specs() },
}

export const STRING_BRAND_OPTIONS = {
  elixir1046: { label: 'Elixir 10-46', note: 'Elixir 10-46 strings', price: 0, specs: specs() },
  elixir942: { label: 'Elixir 9-42 Super Light', note: 'Elixir 9-42 super light', price: 0, specs: specs() },
}

export const OUTPUT_JACK_OPTIONS = {
  none: { label: 'None', note: 'No output jack upgrade', price: 0, specs: specs() },
  standard: { label: 'Standard Jack', note: 'Standard output jack', price: 0, specs: specs() },
  gold: { label: 'Gold Jack', note: 'Gold output jack', price: 15, specs: specs() },
}

export const STRAP_BUTTON_OPTIONS = {
  off: { label: 'Off', note: 'No strap buttons', price: 0, specs: specs() },
  on: { label: 'On', note: 'Strap buttons installed', price: 10, specs: specs() },
}

export const TUNER_BUTTON_OPTIONS = {
  off: { label: 'Off', note: 'No tuner buttons', price: 0, specs: specs() },
  on: { label: 'On', note: 'Tuner buttons installed', price: 10, specs: specs() },
}

export const ELECTRONICS_CAVITY_COVER_OPTIONS = {
  none: { label: 'None', note: 'No cavity cover', price: 0, specs: specs() },
  standard: { label: 'Standard Cover', note: 'Standard electronics cavity cover', price: 10, specs: specs() },
}

export const TREMOLO_COVER_OPTIONS = {
  none: { label: 'None', note: 'No tremolo cover', price: 0, specs: specs() },
  standard: { label: 'Standard Cover', note: 'Standard tremolo cover', price: 10, specs: specs() },
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
  PICKUP_BOBBIN_OPTIONS,
  PICKUP_POLE_COLOR_OPTIONS,
  CONTROLS_OPTIONS,
  SADDLE_OPTIONS,
  NUT_OPTIONS,
  TUNING_OPTIONS,
  STRING_BRAND_OPTIONS,
  OUTPUT_JACK_OPTIONS,
  STRAP_BUTTON_OPTIONS,
  TUNER_BUTTON_OPTIONS,
  ELECTRONICS_CAVITY_COVER_OPTIONS,
  TREMOLO_COVER_OPTIONS,
}
