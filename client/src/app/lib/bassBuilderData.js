export const bassAsset = path => new URL(`../../../../builder/bass_models/${path}`, import.meta.url).href
export const bassWoodAsset = path => new URL(`../../../../woodtype/${path}`, import.meta.url).href

export const BASS_DEFAULT_CONFIG = {
  bassType: 'vader',
  bodyWood: 'maple',
  bodyFinish: 'none',
  neck: 'maple',
  fretboard: 'rosewood',
  headstockWood: 'maple',
  inlays: 'pearl',
  bridge: 'standard',
  pickguard: 'black',
  knobs: 'black',
  pickups: 'standard',
  hardware: 'chrome',
  strings: '4',
  pickupConfig: 'j',
}

export const BASS_TYPE_OPTIONS = [
  { id: 'vader', label: 'Vader', note: 'Modern aggressive bass shape' },
  { id: 'pb', label: 'Precision', note: 'Classic P-bass style' },
  { id: 'jb', label: 'Jazz', note: 'Modern J-bass style' },
]

export const BASS_BASE_PRICE = 1499

export const BASS_BODY_OPTIONS = {
  vader: {
    label: 'Vader',
    note: 'Modern aggressive bass shape',
    bodySrc: bassAsset('bass/vader/front/masks/bodymask.png'),
    price: 0,
  },
  pb: {
    label: 'Precision',
    note: 'Classic P-bass style',
    bodySrc: bassAsset('bass/pb/front/masks/bodymask.png'),
    price: 100,
  },
  jb: {
    label: 'Jazz',
    note: 'Modern J-bass style',
    bodySrc: bassAsset('bass/jb/front/masks/bodymask.png'),
    price: 150,
  },
}

export const BASS_BODY_WOOD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright even grain',
    texture: bassWoodAsset('maple.jpg'),
    price: 0,
  },
  ash: {
    label: 'Ash',
    note: 'Warm resonant grain',
    texture: bassWoodAsset('maple.jpg'),
    price: 75,
  },
  mahogany: {
    label: 'Mahogany',
    note: 'Rich warm tone',
    texture: bassWoodAsset('rosewood.jpg'),
    price: 120,
  },
  swampAsh: {
    label: 'Swamp Ash',
    note: 'Lightweight, bright',
    texture: bassWoodAsset('maple.jpg'),
    price: 150,
  },
}

export const BASS_BODY_FINISH_OPTIONS = {
  none: {
    label: 'None',
    note: 'Raw wood texture',
    texture: null,
    price: 0,
  },
  black: {
    label: 'Jet Black',
    note: 'Opaque black finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/black.png'),
    color: '#1a1a1a',
    price: 30,
  },
  white: {
    label: 'Classic White',
    note: 'Clean opaque finish',
    texture: bassAsset('all-models/woods-colors/colors/solids/white-white.png'),
    color: '#f5f5f5',
    price: 30,
  },
  transBlack: {
    label: 'Trans Black',
    note: 'Tinted translucent finish',
    texture: bassAsset('all-models/woods-colors/colors/transluscents/trans-black.png'),
    price: 45,
  },
  vintageSunburst: {
    label: 'Vintage Sunburst',
    note: 'Classic sunburst finish',
    texture: null,
    color: '#8B4513',
    price: 40,
  },
  tobaccoBurst: {
    label: 'Tobacco Burst',
    note: 'Rich tobacco finish',
    texture: null,
    color: '#8B5A2B',
    price: 45,
  },
  red: {
    label: 'Cherry Red',
    note: 'Classic red finish',
    texture: null,
    color: '#b91c1c',
    price: 35,
  },
  blue: {
    label: 'Ocean Blue',
    note: 'Deep blue finish',
    texture: null,
    color: '#1e40af',
    price: 35,
  },
  green: {
    label: 'Forest Green',
    note: 'Rich green finish',
    texture: null,
    color: '#166534',
    price: 35,
  },
  seafoamGreen: {
    label: 'Seafoam Green',
    note: 'Vintage pastel green',
    texture: null,
    color: '#98D8C8',
    price: 40,
  },
}

export const BASS_NECK_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright neck feel',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/plain-maple.png'),
    price: 0,
  },
  roasted: {
    label: 'Roasted',
    note: 'Dark roasted finish',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/roasted-maple.png'),
    price: 85,
    filter: 'sepia(0.65) saturate(1.15) brightness(0.82) contrast(1.05)',
  },
  walnut: {
    label: 'Walnut',
    note: 'Warm darker neck',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/waln.png'),
    price: 100,
    filter: 'sepia(0.9) saturate(1.15) brightness(0.55) contrast(1.08)',
  },
}

export const BASS_FRETBOARD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Clean and bright',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/maple.png'),
    price: 0,
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Classic dark board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/rosewood.png'),
    price: 70,
  },
  ebony: {
    label: 'Ebony',
    note: 'Snappy premium board',
    src: bassAsset('all-models/woods-colors/fingerboard-woods/ebony.png'),
    price: 95,
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

export const BASS_HEADSTOCK_WOOD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright headstock wood',
    texture: bassAsset('all-models/woods-colors/bass/neck-woods/plain-maple.png'),
    price: 0,
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Warm headstock wood',
    texture: bassAsset('all-models/woods-colors/bass/neck-woods/waln.png'),
    price: 25,
  },
  ebony: {
    label: 'Ebony',
    note: 'Dark premium wood',
    texture: bassAsset('all-models/woods-colors/bass/neck-woods/rfmn.png'),
    price: 35,
  },
}

export const BASS_INLAY_OPTIONS = {
  pearl: {
    label: 'White Pearl',
    note: 'Classic dot inlays',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/id/white.png'),
    price: 0,
  },
  black: {
    label: 'Black',
    note: 'Subtle black dots',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/ib/white.png'),
    price: 0,
  },
  luminlay: {
    label: 'Luminlay',
    note: 'Glow-in-the-dark dots',
    src: bassAsset('all-models/necks/bass/4-string/front/20-fret/round-bottom/inlays/id/luminlay.png'),
    price: 40,
  },
}

export const BASS_BRIDGE_OPTIONS = {
  standard: {
    label: 'Standard',
    note: 'Classic bass bridge',
    assets: {
      chrome: bassAsset('bass/pb/front/bridges/4/chrome.png'),
      black: bassAsset('bass/pb/front/bridges/4/black.png'),
      gold: bassAsset('bass/pb/front/bridges/4/gold.png'),
    },
    price: 0,
  },
  hipshot: {
    label: 'Hipshot',
    note: 'Modern string-through',
    assets: {
      chrome: bassAsset('bass/vader/front/bridges/bridge.png'),
      black: bassAsset('bass/vader/front/bridges/bridge.png'),
      gold: bassAsset('bass/vader/front/bridges/bridge.png'),
    },
    price: 65,
  },
}

export const BASS_PICKGUARD_OPTIONS = {
  vader: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0 },
    black: {
      label: 'Black',
      note: 'Black pickguard',
      src: null,
      price: 0,
    },
  },
  pb: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0 },
    black: {
      label: 'Black',
      note: 'Classic black guard',
      src: bassAsset('bass/pb/front/pickguard/black.png'),
      price: 0,
    },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: bassAsset('bass/pb/front/pickguard/white.png'),
      price: 0,
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: bassAsset('bass/pb/front/pickguard/red-tortoise.png'),
      price: 30,
    },
    pearloid: {
      label: 'Pearloid',
      note: 'Bright pearloid finish',
      src: bassAsset('bass/pb/front/pickguard/white-pearloid.png'),
      price: 25,
    },
  },
  jb: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0 },
    black: {
      label: 'Black',
      note: 'Black pickguard',
      src: null,
      price: 0,
    },
  },
}

export const BASS_KNOB_OPTIONS = {
  vader: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassAsset('bass/vader/front/knobs/black.png'),
      price: 0,
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassAsset('bass/vader/front/knobs/chrome.png'),
      price: 15,
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassAsset('bass/vader/front/knobs/tamarind.png'),
      price: 20,
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassAsset('bass/vader/front/knobs/white-pearl-inlay.png'),
      price: 25,
    },
  },
  pb: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassAsset('bass/pb/front/knobs/black.png'),
      price: 0,
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassAsset('bass/pb/front/knobs/chrome.png'),
      price: 15,
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassAsset('bass/pb/front/knobs/tamarind.png'),
      price: 20,
    },
    gold: {
      label: 'Gold',
      note: 'Premium gold knobs',
      src: bassAsset('bass/pb/front/knobs/gold.png'),
      price: 30,
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassAsset('bass/pb/front/knobs/white-pearl-inlay.png'),
      price: 25,
    },
  },
  jb: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassAsset('bass/vader/front/knobs/black.png'),
      price: 0,
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassAsset('bass/vader/front/knobs/chrome.png'),
      price: 15,
    },
  },
}

export const BASS_HARDWARE_OPTIONS = {
  chrome: {
    label: 'Chrome',
    note: 'Standard bright hardware',
    price: 0,
    color: 'chrome',
  },
  black: {
    label: 'Black',
    note: 'Stealth hardware',
    price: 45,
    color: 'black',
  },
  gold: {
    label: 'Gold',
    note: 'Premium gold finish',
    price: 75,
    color: 'gold',
  },
}

export const BASS_PICKUP_OPTIONS = {
  standard: {
    label: 'Standard',
    note: 'Single coil P-bass pickup',
    price: 0,
  },
  split: {
    label: 'Split Coil',
    note: 'Modern split pickup',
    price: 45,
  },
  humbucker: {
    label: 'Humbucker',
    note: 'Dual coil humbucker',
    price: 65,
  },
  active: {
    label: 'Active',
    note: 'Preamp equipped',
    price: 125,
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

export const BASS_STRING_OPTIONS = {
  '4': {
    label: '4 Strings',
    note: 'Standard 4-string',
    price: 0,
  },
  '5': {
    label: '5 Strings',
    note: 'Extended range',
    price: 50,
  },
  '6': {
    label: '6 Strings',
    note: 'Full extended range',
    price: 100,
  },
}

export const BASS_PREVIEW_LAYOUTS = {
  vader: { scale: 0.95, x: 0, y: 28 },
  pb: { scale: 0.92, x: -4, y: 26 },
  jb: { scale: 0.93, x: 0, y: 26 },
}

export const BASS_BODY_LAYER_ASSETS = {
  vader: {
    bridge: BASS_BRIDGE_OPTIONS.hipshot.assets,
    knobs: {
      chrome: bassAsset('bass/vader/front/knobs/chrome.png'),
      black: bassAsset('bass/vader/front/knobs/black.png'),
      gold: bassAsset('bass/vader/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: bassAsset('bass/vader/front/strap buttons/standard/chrome.png'),
      black: bassAsset('bass/vader/front/strap buttons/standard/black.png'),
      gold: bassAsset('bass/vader/front/strap buttons/standard/gold.png'),
    },
    pickguard: null,
  },
  pb: {
    bridge: BASS_BRIDGE_OPTIONS.standard.assets,
    knobs: {
      chrome: bassAsset('bass/pb/front/knobs/chrome.png'),
      black: bassAsset('bass/pb/front/knobs/black.png'),
      gold: bassAsset('bass/pb/front/knobs/gold.png'),
    },
    strap: {
      chrome: bassAsset('bass/pb/front/strap buttons/standard/chrome.png'),
      black: bassAsset('bass/pb/front/strap buttons/standard/black.png'),
      gold: bassAsset('bass/pb/front/strap buttons/standard/gold.png'),
    },
    pickguard: {
      chrome: bassAsset('bass/pb/front/pickguard/black.png'),
      black: bassAsset('bass/pb/front/pickguard/black.png'),
      gold: bassAsset('bass/pb/front/pickguard/tortoise.png'),
    },
  },
  jb: {
    bridge: BASS_BRIDGE_OPTIONS.standard.assets,
    knobs: {
      chrome: bassAsset('bass/vader/front/knobs/chrome.png'),
      black: bassAsset('bass/vader/front/knobs/black.png'),
      gold: bassAsset('bass/vader/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: bassAsset('bass/jb/front/strap buttons/standard/chrome.png'),
      black: bassAsset('bass/jb/front/strap buttons/standard/black.png'),
      gold: bassAsset('bass/jb/front/strap buttons/standard/gold.png'),
    },
    pickguard: null,
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
  BODY_FINISH_OPTIONS: BASS_BODY_FINISH_OPTIONS,
  NECK_OPTIONS: BASS_NECK_OPTIONS,
  FRETBOARD_OPTIONS: BASS_FRETBOARD_OPTIONS,
  NECK_MASK: BASS_NECK_MASK,
  NECK_FRETS: BASS_NECK_FRETS,
  NECK_NUT: BASS_NECK_NUT,
  HEADSTOCK_WOOD_OPTIONS: BASS_HEADSTOCK_WOOD_OPTIONS,
  INLAY_OPTIONS: BASS_INLAY_OPTIONS,
  BRIDGE_OPTIONS: BASS_BRIDGE_OPTIONS,
  PICKGUARD_OPTIONS: BASS_PICKGUARD_OPTIONS,
  KNOB_OPTIONS: BASS_KNOB_OPTIONS,
  HARDWARE_OPTIONS: BASS_HARDWARE_OPTIONS,
  PICKUP_OPTIONS: BASS_PICKUP_OPTIONS,
  PICKUP_CONFIG_OPTIONS: BASS_PICKUP_CONFIG_OPTIONS,
  STRING_OPTIONS: BASS_STRING_OPTIONS,
  PREVIEW_LAYOUTS: BASS_PREVIEW_LAYOUTS,
  BODY_LAYER_ASSETS: BASS_BODY_LAYER_ASSETS,
  resolveVariant: resolveBassVariant,
}