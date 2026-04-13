export const bassAsset = path => new URL(`../../../../builder/bass_models/${path}`, import.meta.url).href
export const bassWoodAsset = path => new URL(`../../../../woodtype/${path}`, import.meta.url).href

export const BASS_DEFAULT_CONFIG = {
  bassType: 'vader',
  bodyWood: 'maple',
  bodyFinish: 'none',
  neck: 'maple',
  fretboard: 'rosewood',
  headstockWood: 'maple',
  headstockStyle: 'ch',
  neckStyle: 'roundBottom',
  inlays: 'whiteDots',
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
}

export const BASS_TYPE_OPTIONS = [
  { id: 'vader', label: 'Vader', note: 'Modern aggressive bass shape' },
  { id: 'pb', label: 'Precision', note: 'Classic P-bass style' },
  { id: 'jb', label: 'Jazz', note: 'Modern J-bass style' },
]

// Base price in PHP (Philippine Peso) - approximately 1500 USD equivalent
export const BASS_BASE_PRICE = 89999

export const BASS_BODY_OPTIONS = {
  vader: {
    label: 'Vader',
    note: 'Modern aggressive bass shape',
    bodySrc: bassAsset('bass/vader/front/masks/bodymask.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  pb: {
    label: 'Precision',
    note: 'Classic precision shape',
    bodySrc: bassAsset('bass/pb/front/masks/bodymask.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  jb: {
    label: 'Jazz',
    note: 'Modern jazz shape',
    bodySrc: bassAsset('bass/jb/front/masks/bodymask.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}


export const BASS_BODY_WOOD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright even grain',
    texture: bassAsset('all-models/woods-colors/body-woods/maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ash: {
    label: 'Ash',
    note: 'Warm resonant grain',
    texture: bassAsset('all-models/woods-colors/body-woods/ash1.png'),
    price: 4499, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ash2: {
    label: 'Ash 2',
    note: 'Alt ash grain pattern',
    texture: bassAsset('all-models/woods-colors/body-woods/ash2.png'),
    price: 4499, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  mahogany: {
    label: 'Mahogany',
    note: 'Rich warm tone',
    texture: bassAsset('all-models/woods-colors/body-woods/mah.png'),
    price: 7199, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  walnut: {
    label: 'Walnut',
    note: 'Deep dark wood',
    texture: bassAsset('all-models/woods-colors/body-woods/wal.png'),
    price: 6599, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedAsh: {
    label: 'Roasted Ash',
    note: 'Dark roasted finish',
    texture: bassAsset('all-models/woods-colors/body-woods/roasted-ash.png'),
    price: 7799, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roastedAsh1: {
    label: 'Roasted Ash Alt',
    note: 'Alt roasted ash',
    texture: bassAsset('all-models/woods-colors/body-woods/roasted-ash1.png'),
    price: 7799, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  lmb: {
    label: 'Laminated',
    note: 'Laminated wood body',
    texture: bassAsset('all-models/woods-colors/body-woods/lmb.png'),
    price: 5699, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ald: {
    label: 'Alder',
    note: 'Classic alder wood',
    texture: bassAsset('all-models/woods-colors/body-woods/ald.png'),
    price: 5099, specs: { size: '', dimensions: '', material: '', notes: '' }
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
  maple: {
    label: 'Maple',
    note: 'Bright neck feel',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/plain-maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  roasted: {
    label: 'Roasted',
    note: 'Dark roasted finish',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/roasted-maple.png'),
    price: 5099,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    filter: 'sepia(0.65) saturate(1.15) brightness(0.82) contrast(1.05)',
  },
  walnut: {
    label: 'Walnut',
    note: 'Warm darker neck',
    src: bassAsset('all-models/woods-colors/bass/neck-woods/waln.png'),
    price: 5999,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    filter: 'sepia(0.9) saturate(1.15) brightness(0.55) contrast(1.08)',
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


// Logo Options - Vader specific
// Logo Options - Only available for Vader body
export const BASS_LOGO_OPTIONS = {
  vader: {
    standard: {
      label: 'Standard Logo',
      note: 'Standard bass logo',
      src: bassAsset('bass/vader/front/logos/bl.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended: {
      label: 'Extended Logo',
      note: 'Extended 5-string logo',
      src: bassAsset('bass/vader/front/logos/bl-5.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    standard: {
      label: 'Standard Logo',
      note: 'Standard bass logo',
      src: null,
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  pb: {
    standard: {
      label: 'Standard Logo',
      note: 'Standard bass logo',
      src: null,
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
}

// Backplate Options - Back customization
export const BASS_BACKPLATE_OPTIONS = {
  vader: {
    standard: {
      label: 'Standard',
      note: 'Standard back panel',
      src: bassAsset('bass/vader/back/backplates/battery-compartment.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  pb: {
    standard: {
      label: 'Standard',
      note: 'Standard back panel',
      src: bassAsset('bass/pb/back/backplates/battery-compartment.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended: {
      label: 'Extended 5-String',
      note: 'Extended 5-string back panel',
      src: bassAsset('bass/pb/back/backplates/battery-compartment-5.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    standard: {
      label: 'Standard',
      note: 'Standard back panel',
      src: bassAsset('bass/jb/back/backplates/battery-compartment.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended: {
      label: 'Extended 5-String',
      note: 'Extended 5-string back panel',
      src: bassAsset('bass/jb/back/backplates/battery-compartment-5.png'),
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
      src: bassAsset('bass/pb/front/pickguard/screws-black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome Screws',
      note: 'Chrome pickup mounting screws',
      src: bassAsset('bass/pb/front/pickguard/screws-chrome.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold Screws',
      note: 'Gold pickup mounting screws',
      src: bassAsset('bass/pb/front/pickguard/screws-gold.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    black: {
      label: 'Black Screws',
      note: 'Black pickup mounting screws',
      src: bassAsset('bass/jb/front/pickguard/screws-black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome Screws',
      note: 'Chrome pickup mounting screws',
      src: bassAsset('bass/jb/front/pickguard/screws-chrome.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold Screws',
      note: 'Gold pickup mounting screws',
      src: bassAsset('bass/jb/front/pickguard/screws-gold.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  }
}

// Control Plate Options
export const BASS_CONTROL_PLATE_OPTIONS = {
  black: {
    label: 'Black Control Plate',
    note: 'Black control plate',
    src: bassAsset('bass/jb/front/pickguard/control-black.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  chrome: {
    label: 'Chrome Control Plate',
    note: 'Chrome control plate',
    src: bassAsset('bass/jb/front/pickguard/control-chrome.png'),
    price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  gold: {
    label: 'Gold Control Plate',
    note: 'Gold control plate',
    src: bassAsset('bass/jb/front/pickguard/control-gold.png'),
    price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_BRIDGE_OPTIONS = {
  vader: {
    standard: {
      label: 'Standard',
      note: 'Standard bridge',
      assets: {
        chrome: bassAsset('bass/vader/front/bridges/bridge.png'),
        black: bassAsset('bass/vader/front/bridges/bridge.png'),
        gold: bassAsset('bass/vader/front/bridges/bridge.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended5: {
      label: 'Extended 5-String',
      note: '5-string bridge',
      assets: {
        chrome: bassAsset('bass/vader/front/bridges/bridge-5.png'),
        black: bassAsset('bass/vader/front/bridges/bridge-5.png'),
        gold: bassAsset('bass/vader/front/bridges/bridge-5.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    extended300: {
      label: 'Extended 300',
      note: 'Extended 300 bridge variant',
      assets: {
        chrome: bassAsset('bass/vader/front/bridges/bridge-300.png'),
        black: bassAsset('bass/vader/front/bridges/bridge-300.png'),
        gold: bassAsset('bass/vader/front/bridges/bridge-300.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    cosmos: {
      label: 'Cosmos',
      note: 'Custom Cosmos bridge',
      assets: {
        chrome: bassAsset('bass/jb/front/bridges/kiesel/4/chrome.png'),
        black: bassAsset('bass/jb/front/bridges/kiesel/4/black.png'),
        gold: bassAsset('bass/jb/front/bridges/kiesel/4/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  pb: {
    standard4: {
      label: 'Standard 4-String',
      note: 'Classic 4-string bridge',
      assets: {
        chrome: bassAsset('bass/pb/front/bridges/4/chrome.png'),
        black: bassAsset('bass/pb/front/bridges/4/black.png'),
        gold: bassAsset('bass/pb/front/bridges/4/gold.png'),
      },
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    standard5: {
      label: 'Standard 5-String',
      note: 'Extended 5-string bridge',
      assets: {
        chrome: bassAsset('bass/pb/front/bridges/5/chrome.png'),
        black: bassAsset('bass/pb/front/bridges/5/black.png'),
        gold: bassAsset('bass/pb/front/bridges/5/gold.png'),
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
      src: bassAsset('bass/pb/front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: bassAsset('bass/pb/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: bassAsset('bass/pb/front/pickguard/red-tortoise.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'Pearloid',
      note: 'Bright pearloid finish',
      src: bassAsset('bass/pb/front/pickguard/white-pearloid.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    black: {
      label: 'Black',
      note: 'Black pickguard',
      src: bassAsset('bass/jb/front/pickguard/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: bassAsset('bass/jb/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: bassAsset('bass/jb/front/pickguard/red-tortoise.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    satinBlack: {
      label: 'Satin Black',
      note: 'Matte black guard',
      src: bassAsset('bass/jb/front/pickguard/satin-black.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'Pearloid',
      note: 'Bright pearloid finish',
      src: bassAsset('bass/jb/front/pickguard/white-pearloid.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
}

export const BASS_KNOB_OPTIONS = {
  vader: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassAsset('bass/vader/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassAsset('bass/vader/front/knobs/chrome.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassAsset('bass/vader/front/knobs/tamarind.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassAsset('bass/vader/front/knobs/white-pearl-inlay.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abalone: {
      label: 'Abalone Inlay',
      note: 'Premium abalone inlay',
      src: bassAsset('bass/vader/front/knobs/abalone-inlay.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  pb: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassAsset('bass/pb/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackActive: {
      label: 'Black With Active',
      note: 'Black knobs with active electronics',
      src: bassAsset('bass/pb/front/knobs/black-active.png'),
      price: 10, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    blackThree: {
      label: 'Black Three String',
      note: 'Black knobs for 3-string config',
      src: bassAsset('bass/pb/front/knobs/black-three.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassAsset('bass/pb/front/knobs/chrome.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chromeActive: {
      label: 'Chrome With Active',
      note: 'Chrome knobs with active electronics',
      src: bassAsset('bass/pb/front/knobs/chrome-active.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chromeThree: {
      label: 'Chrome Three String',
      note: 'Chrome knobs for 3-string config',
      src: bassAsset('bass/pb/front/knobs/chrome-three.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassAsset('bass/pb/front/knobs/tamarind.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarindActive: {
      label: 'Tamarind With Active',
      note: 'Tamarind knobs with active electronics',
      src: bassAsset('bass/pb/front/knobs/tamarind-active.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarindThree: {
      label: 'Tamarind Three String',
      note: 'Tamarind knobs for 3-string config',
      src: bassAsset('bass/pb/front/knobs/tamarind-three.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold',
      note: 'Premium gold knobs',
      src: bassAsset('bass/pb/front/knobs/gold.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    goldActive: {
      label: 'Gold With Active',
      note: 'Gold knobs with active electronics',
      src: bassAsset('bass/pb/front/knobs/gold-active.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    goldThree: {
      label: 'Gold Three String',
      note: 'Gold knobs for 3-string config',
      src: bassAsset('bass/pb/front/knobs/gold-three.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassAsset('bass/pb/front/knobs/white-pearl-inlay.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearlActive: {
      label: 'Pearl Inlay With Active',
      note: 'Pearl inlay knobs with active electronics',
      src: bassAsset('bass/pb/front/knobs/white-pearl-inlay-active.png'),
      price: 35, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearlThree: {
      label: 'Pearl Inlay Three String',
      note: 'Pearl inlay knobs for 3-string config',
      src: bassAsset('bass/pb/front/knobs/white-pearl-inlay-three.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abaloneInlay: {
      label: 'Abalone Inlay',
      note: 'Premium abalone inlay knobs',
      src: bassAsset('bass/pb/front/knobs/abalone-inlay.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abaloneInlayThree: {
      label: 'Abalone Inlay Three String',
      note: 'Abalone inlay knobs for 3-string config',
      src: bassAsset('bass/pb/front/knobs/abalone-inlay-three.png'),
      price: 40, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
  },
  jb: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: bassAsset('bass/jb/front/knobs/black.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: bassAsset('bass/jb/front/knobs/chrome.png'),
      price: 15, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: bassAsset('bass/jb/front/knobs/tamarind.png'),
      price: 20, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    gold: {
      label: 'Gold',
      note: 'Premium gold knobs',
      src: bassAsset('bass/jb/front/knobs/gold.png'),
      price: 30, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: bassAsset('bass/jb/front/knobs/white-pearl-inlay.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    abalone: {
      label: 'Abalone Inlay',
      note: 'Premium abalone inlay',
      src: bassAsset('bass/jb/front/knobs/abalone-inlay.png'),
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
  gold: {
    label: 'Gold',
    note: 'Premium gold finish',
    price: 75,
    specs: { size: '', dimensions: '', material: '', notes: '' },
    color: 'gold',
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
  '6': {
    label: '6 Strings',
    note: 'Full extended range',
    price: 100, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const BASS_PREVIEW_LAYOUTS = {
  vader: { scale: 0.95, x: 0, y: 28 },
  pb: { scale: 0.92, x: -4, y: 26 },
  jb: { scale: 0.93, x: 0, y: 26 },
}

export const BASS_BODY_LAYER_ASSETS = {
  vader: {
    bridge: BASS_BRIDGE_OPTIONS.vader.standard.assets,
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
    pickups: bassAsset('bass/vader/front/pickups/hb/standard/4/bridge-black.png'),
    shadows: bassAsset('bass/vader/front/shadows_highlights/edge-shadow.png'),
    gloss: bassAsset('bass/vader/front/shadows_highlights/gloss.png'),
    pickguard: null,
    rearNeckCap: bassAsset('bass/vader/back/neck-cap.png'),
  },
  pb: {
    bridge: BASS_BRIDGE_OPTIONS.pb.standard4.assets,
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
    pickups: bassAsset('all-models/pickups/bass/p/neck-black.png'),
    shadows: bassAsset('bass/pb/front/shadows_highlights/edge-shadow.png'),
    gloss: bassAsset('bass/pb/front/shadows_highlights/gloss.png'),
    pickguard: {
      chrome: bassAsset('bass/pb/front/pickguard/black.png'),
      black: bassAsset('bass/pb/front/pickguard/black.png'),
      gold: bassAsset('bass/pb/front/pickguard/tortoise.png'),
    },
  },
  jb: {
    bridge: BASS_BRIDGE_OPTIONS.jb.cosmos.assets,
    knobs: {
      chrome: bassAsset('bass/jb/front/knobs/chrome.png'),
      black: bassAsset('bass/jb/front/knobs/black.png'),
      gold: bassAsset('bass/jb/front/knobs/gold.png'),
    },
    strap: {
      chrome: bassAsset('bass/jb/front/strap buttons/standard/chrome.png'),
      black: bassAsset('bass/jb/front/strap buttons/standard/black.png'),
      gold: bassAsset('bass/jb/front/strap buttons/standard/gold.png'),
    },
    pickups: bassAsset('all-models/pickups/bass/j/4/bridge-black.png'),
    shadows: bassAsset('bass/jb/front/shadows_highlights/edge-shadow.png'),
    gloss: bassAsset('bass/jb/front/shadows_highlights/gloss.png'),
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
  HEADSTOCK_STYLE_OPTIONS: BASS_HEADSTOCK_STYLE_OPTIONS,
  NECK_STYLE_OPTIONS: BASS_NECK_STYLE_OPTIONS,
  INLAY_OPTIONS: BASS_INLAY_OPTIONS,
  LOGO_OPTIONS: BASS_LOGO_OPTIONS,
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
  STRING_OPTIONS: BASS_STRING_OPTIONS,
  PREVIEW_LAYOUTS: BASS_PREVIEW_LAYOUTS,
  BODY_LAYER_ASSETS: BASS_BODY_LAYER_ASSETS,
  resolveVariant: resolveBassVariant,
}