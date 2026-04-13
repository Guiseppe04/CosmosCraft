export const asset = path => new URL(`../../../../builder/electric_models/${path}`, import.meta.url).href
export const woodAsset = path => new URL(`../../../../woodtype/${path}`, import.meta.url).href

export const DEFAULT_CONFIG = {
  guitarType: 'electric',
  body: 'strat',
  bodyWood: 'rosewood',
  bodyFinish: 'none',
  neck: 'maple',
  fretboard: 'rosewood',
  headstockWood: 'rosewood',
  inlays: 'pearl',
  bridge: 'hipshotFixed',
  pickguard: 'none',
  knobs: 'black',
  pickups: 'hss',
  hardware: 'chrome',
  headstock: 'gt6',
}

export const GUITAR_TYPE_OPTIONS = [
  { id: 'electric', label: 'Electric Guitar' },
  { id: 'bass', label: 'Bass Guitar' },
]

export const BASE_PRICE = 1299

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
  maple: {
    label: 'Maple',
    note: 'Clean and bright',
    src: asset('all-models/woods-colors/fingerboard-woods/maple.png'),
    price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Classic dark board',
    src: asset('all-models/woods-colors/fingerboard-woods/rosewood.png'),
    price: 60, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
  ebony: {
    label: 'Ebony',
    note: 'Snappy premium board',
    src: asset('all-models/woods-colors/fingerboard-woods/ebony.png'),
    price: 80, specs: { size: '', dimensions: '', material: '', notes: '' }
  },
}

export const NECK_MASK = asset('all-models/necks/6-string/front/24-fret-front/standard/masks/mask.png')
export const NECK_FRETS = {
  stainless: asset('all-models/necks/6-string/front/24-fret-front/standard/frets/stainless.png'),
  gold: asset('all-models/necks/6-string/front/24-fret-front/standard/frets/gold.png'),
}
export const NECK_NUT = {
  white: asset('all-models/necks/6-string/front/24-fret-front/standard/nut/white.png'),
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
    none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    white: {
      label: 'White',
      note: 'Classic white guard',
      src: asset('rs/bodies/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'Pearloid',
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
    none: { label: 'None', note: 'No pickguard', src: null, price: 0, specs: { size: '', dimensions: '', material: '', notes: '' } },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: asset('delos/bodies/front/pickguard/white.png'),
      price: 0, specs: { size: '', dimensions: '', material: '', notes: '' }
    },
    pearloid: {
      label: 'Pearloid',
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
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: asset('delos/bodies/front/pickguard/red-tortoise.png'),
      price: 25, specs: { size: '', dimensions: '', material: '', notes: '' }
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
      black: asset('all-models/headstocks/6/tuners/gt6r/black.png'),
      white: asset('all-models/headstocks/6/tuners/gt6r/whitepearl-buttons.png'),
    },
    strings: asset('all-models/headstocks/6/string-overlays/standard/gt6r.png'),
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
      black: asset('all-models/headstocks/6/tuners/hr33/black.png'),
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
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-bridge.png'),
        middle: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-middle.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-neck.png'),
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
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-neck.png'),
      },
      black: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-neck.png'),
      },
      gold: {
        bridge: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-bridge.png'),
        neck: asset('all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-neck.png'),
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

export function resolveVariant(source, colorKey) {
  if (!source) return null
  if (typeof source === 'string') return source
  return source[colorKey] ?? source.chrome ?? source.black ?? source.gold ?? null
}

export const guitarBuilder = {
  DEFAULT_CONFIG,
  BASE_PRICE,
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
}
