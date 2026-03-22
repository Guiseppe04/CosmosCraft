export const asset = path => new URL(`../../../../builder/${path}`, import.meta.url).href
export const woodAsset = path => new URL(`../../../../woodtype/${path}`, import.meta.url).href

export const DEFAULT_CONFIG = {
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

export const BASE_PRICE = 1299

export const BODY_OPTIONS = {
  strat: {
    label: 'Strat',
    note: 'Balanced bolt-on body',
    bodySrc: asset('models/rs/bodies/front/masks/bodymask.png'),
    price: 0,
  },
  solo: {
    label: 'Solo',
    note: 'Modern singlecut body',
    bodySrc: asset('models/solo/bodies/front/masks/bv-bodymask.png'),
    price: 150,
  },
  dc: {
    label: 'DC',
    note: 'Double-cut access',
    bodySrc: asset('models/dc/bodies/front/masks/bodymask.png'),
    price: 180,
  },
  delos: {
    label: 'Delos',
    note: 'Contoured body build',
    bodySrc: asset('models/delos/bodies/front/masks/bodymask.png'),
    price: 220,
  },
}

export const BODY_WOOD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright even grain',
    texture: woodAsset('maple.jpg'),
    price: 0,
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Warm dark grain',
    texture: woodAsset('rosewood.jpg'),
    price: 0,
  },
  ebony: {
    label: 'Ebony',
    note: 'Deep dark grain',
    texture: woodAsset('ebony.jpg'),
    price: 0,
  },
  pauFerro: {
    label: 'Pau Ferro',
    note: 'Balanced brown grain',
    texture: woodAsset('pau-ferro.jpg'),
    price: 0,
  },
  indianLaurel: {
    label: 'Indian Laurel',
    note: 'Subtle mid-brown grain',
    texture: woodAsset('indian-laurel.jpg'),
    price: 0,
  },
}

export const BODY_FINISH_OPTIONS = {
  none: {
    label: 'None',
    note: 'Raw wood texture',
    texture: null,
    price: 0,
  },
  black: {
    label: 'Jet Black',
    note: 'Opaque black finish',
    texture: asset('models/all-models/woods-colors/colors/solids/black.png'),
    price: 25,
  },
  white: {
    label: 'Classic White',
    note: 'Clean opaque finish',
    texture: asset('models/all-models/woods-colors/colors/solids/white-white.png'),
    price: 25,
  },
  transBlack: {
    label: 'Trans Black',
    note: 'Tinted translucent finish',
    texture: asset('models/all-models/woods-colors/colors/transluscents/trans-black.png'),
    price: 35,
  },
}

export const NECK_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Bright neck feel',
    src: asset('models/all-models/woods-colors/neck-woods/plain-maple.png'),
    price: 0,
    filter: 'none',
  },
  roasted: {
    label: 'Roasted',
    note: 'Dark roasted finish',
    src: asset('models/all-models/woods-colors/neck-woods/plain-maple.png'),
    price: 75,
    filter: 'sepia(0.65) saturate(1.15) brightness(0.82) contrast(1.05)',
  },
  walnut: {
    label: 'Walnut',
    note: 'Warm darker neck',
    src: asset('models/all-models/woods-colors/neck-woods/plain-maple.png'),
    price: 95,
    filter: 'sepia(0.9) saturate(1.15) brightness(0.55) contrast(1.08)',
  },
}

export const FRETBOARD_OPTIONS = {
  maple: {
    label: 'Maple',
    note: 'Clean and bright',
    src: asset('models/all-models/woods-colors/fingerboard-woods/maple.png'),
    price: 0,
  },
  rosewood: {
    label: 'Rosewood',
    note: 'Classic dark board',
    src: asset('models/all-models/woods-colors/fingerboard-woods/rosewood.png'),
    price: 60,
  },
  ebony: {
    label: 'Ebony',
    note: 'Snappy premium board',
    src: asset('models/all-models/woods-colors/fingerboard-woods/ebony.png'),
    price: 80,
  },
}

export const NECK_MASK = asset('models/all-models/necks/6-string/front/24-fret-front/standard/masks/mask.png')
export const NECK_FRETS = {
  stainless: asset('models/all-models/necks/6-string/front/24-fret-front/standard/frets/stainless.png'),
  gold: asset('models/all-models/necks/6-string/front/24-fret-front/standard/frets/gold.png'),
}
export const NECK_NUT = {
  white: asset('models/all-models/necks/6-string/front/24-fret-front/standard/nut/white.png'),
  black: asset('models/all-models/necks/6-string/front/24-fret-front/standard/nut/black.png'),
}

export const HEADSTOCK_WOOD_OPTIONS = {
  rosewood: {
    label: 'Rosewood',
    note: 'Warm headstock wood',
    texture: asset('models/all-models/woods-colors/headstock-woods/rosewood.png'),
    price: 0,
  },
  ebony: {
    label: 'Ebony',
    note: 'Dark premium wood',
    texture: asset('models/all-models/woods-colors/headstock-woods/ebony.png'),
    price: 20,
  },
}

export const INLAY_OPTIONS = {
  pearl: {
    label: 'White Pearl',
    note: 'Classic dot inlays',
    src: asset('models/all-models/necks/6-string/front/24-fret-front/standard/inlays/id/idwhite-pearl.png'),
    price: 0,
  },
  black: {
    label: 'Black',
    note: 'Subtle black dots',
    src: asset('models/all-models/necks/6-string/front/24-fret-front/standard/inlays/id/idblack.png'),
    price: 0,
  },
  luminlay: {
    label: 'Luminlay',
    note: 'Glow-in-the-dark dots',
    src: asset('models/all-models/necks/6-string/front/24-fret-front/standard/inlays/id/idluminlay.png'),
    price: 35,
  },
}

export const BRIDGE_OPTIONS = {
  hipshotFixed: {
    label: 'Hipshot Fixed',
    note: 'Modern hardtail bridge',
    assets: {
      chrome: asset('models/all-models/bridges/6/standard/hipshot-hardtail/hipshot-hardtail-chrome.png'),
      black: asset('models/all-models/bridges/6/standard/hipshot-hardtail/hipshot-hardtail-black.png'),
      gold: asset('models/all-models/bridges/6/standard/hipshot-hardtail/hipshot-hardtail-gold.png'),
    },
    price: 45,
  },
  hipshotTremolo: {
    label: 'Hipshot Tremolo',
    note: 'Six-string tremolo bridge',
    assets: {
      chrome: asset('models/all-models/bridges/6/standard/hipshot-trem/hipshot-trem-chrome.png'),
      black: asset('models/all-models/bridges/6/standard/hipshot-trem/hipshot-trem-black.png'),
      gold: asset('models/all-models/bridges/6/standard/hipshot-trem/hipshot-trem-chrome.png'),
    },
    price: 75,
  },
  floydRoseTremolo: {
    label: 'Floyd Rose Tremolo',
    note: 'Locking trem bridge',
    assets: {
      chrome: asset('models/all-models/bridges/6/standard/floyd-rose/chrome.png'),
      black: asset('models/all-models/bridges/6/standard/floyd-rose/black.png'),
      gold: asset('models/all-models/bridges/6/standard/floyd-rose/gold.png'),
    },
    price: 90,
  },
}

export const PICKGUARD_OPTIONS_BY_BODY = {
  strat: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0 },
    white: {
      label: 'White',
      note: 'Classic white guard',
      src: asset('models/rs/bodies/front/pickguard/white.png'),
      price: 0,
    },
    pearloid: {
      label: 'Pearloid',
      note: 'Bright pearloid finish',
      src: asset('models/rs/bodies/front/pickguard/white-pearloid.png'),
      price: 20,
    },
    black: {
      label: 'Black',
      note: 'Dark contrasting guard',
      src: asset('models/rs/bodies/front/pickguard/black.png'),
      price: 0,
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: asset('models/rs/bodies/front/pickguard/red-tortoise.png'),
      price: 25,
    },
  },
  delos: {
    none: { label: 'None', note: 'No pickguard', src: null, price: 0 },
    white: {
      label: 'White',
      note: 'Clean white guard',
      src: asset('models/delos/bodies/front/pickguard/white.png'),
      price: 0,
    },
    pearloid: {
      label: 'Pearloid',
      note: 'White pearloid guard',
      src: asset('models/delos/bodies/front/pickguard/white-pearloid.png'),
      price: 20,
    },
    black: {
      label: 'Black',
      note: 'Satin black guard',
      src: asset('models/delos/bodies/front/pickguard/black.png'),
      price: 0,
    },
    satinBlack: {
      label: 'Satin Black',
      note: 'Low-key satin finish',
      src: asset('models/delos/bodies/front/pickguard/satin-black.png'),
      price: 15,
    },
    tortoise: {
      label: 'Tortoise',
      note: 'Red tortoise shell',
      src: asset('models/delos/bodies/front/pickguard/red-tortoise.png'),
      price: 25,
    },
  },
  solo: { none: { label: 'None', note: 'No pickguard', src: null, price: 0 } },
  dc: { none: { label: 'None', note: 'No pickguard', src: null, price: 0 } },
}

export const KNOB_OPTIONS_BY_BODY = {
  strat: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('models/rs/bodies/front/knobs/black.png'),
      price: 0,
    },
    tamarind: {
      label: 'Tamarind',
      note: 'Warm wood-look knobs',
      src: asset('models/rs/bodies/front/knobs/tamarind.png'),
      price: 15,
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay knobs',
      src: asset('models/rs/bodies/front/knobs/white-pearl-inlay.png'),
      price: 20,
    },
    abalone: {
      label: 'Abalone',
      note: 'Premium abalone inlay',
      src: asset('models/rs/bodies/front/knobs/abalone-inlay.png'),
      price: 30,
    },
  },
  solo: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('models/solo/bodies/front/knobs/black.png'),
      price: 0,
    },
    blackPlastic: {
      label: 'Black Plastic',
      note: 'Smooth black plastic',
      src: asset('models/solo/bodies/front/knobs/black-plastic.png'),
      price: 10,
    },
    whitePlastic: {
      label: 'White Plastic',
      note: 'Bright white plastic',
      src: asset('models/solo/bodies/front/knobs/white-plastic.png'),
      price: 10,
    },
    chrome: {
      label: 'Chrome',
      note: 'Shiny chrome finish',
      src: asset('models/solo/bodies/front/knobs/chrome.png'),
      price: 20,
    },
  },
  dc: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('models/dc/bodies/front/knobs/black.png'),
      price: 0,
    },
    dtmv: {
      label: 'Black DTMV',
      note: 'Modern black DTMV',
      src: asset('models/dc/bodies/front/knobs/black-dtmv.png'),
      price: 15,
    },
    dtc: {
      label: 'Black DTC',
      note: 'Modern black DTC',
      src: asset('models/dc/bodies/front/knobs/black-dtc.png'),
      price: 15,
    },
    plasticBlack: {
      label: 'Plastic Black',
      note: 'Plain black plastic',
      src: asset('models/dc/bodies/front/knobs/plasticblack.png'),
      price: 10,
    },
    plasticWhite: {
      label: 'Plastic White',
      note: 'Plain white plastic',
      src: asset('models/dc/bodies/front/knobs/plasticwhite.png'),
      price: 10,
    },
  },
  delos: {
    black: {
      label: 'Black',
      note: 'Standard black knobs',
      src: asset('models/delos/bodies/front/knobs/black-dtmv.png'),
      price: 0,
    },
    blackPlastic: {
      label: 'Black Plastic',
      note: 'Black plastic DTMV',
      src: asset('models/delos/bodies/front/knobs/black-plastic-dtmv.png'),
      price: 10,
    },
    whitePlastic: {
      label: 'White Plastic',
      note: 'White plastic DTMV',
      src: asset('models/delos/bodies/front/knobs/white-plastic-dtmv.png'),
      price: 10,
    },
    pearl: {
      label: 'Pearl Inlay',
      note: 'White pearl inlay DTMV',
      src: asset('models/delos/bodies/front/knobs/white-pearl-inlay-dtmv.png'),
      price: 20,
    },
  },
}

export const HEADSTOCK_OPTIONS = {
  gt6: {
    label: 'GT6',
    note: 'Straight 6-in-line',
    mask: asset('models/all-models/headstocks/6/masks/gt6/mask.png'),
    logo: asset('models/all-models/headstocks/6/logos/gt6/wl.png'),
    tuners: {
      chrome: asset('models/all-models/headstocks/6/tuners/gt6/chrome.png'),
      black: asset('models/all-models/headstocks/6/tuners/gt6/black.png'),
      gold: asset('models/all-models/headstocks/6/tuners/gt6/gold.png'),
    },
    strings: asset('models/all-models/headstocks/6/string-overlays/standard/gt6.png'),
    trussCover: asset('models/all-models/headstocks/6/truss-cover/black.png'),
    price: 0,
  },
  gt6r: {
    label: 'GT6R',
    note: 'Reverse 6-in-line',
    mask: asset('models/all-models/headstocks/6/masks/gt6r/mask.png'),
    logo: asset('models/all-models/headstocks/6/logos/left-handed/gt6r/wl.png'),
    tuners: {
      black: asset('models/all-models/headstocks/6/tuners/gt6r/black.png'),
      white: asset('models/all-models/headstocks/6/tuners/gt6r/whitepearl-buttons.png'),
    },
    strings: asset('models/all-models/headstocks/6/string-overlays/standard/gt6r.png'),
    trussCover: asset('models/all-models/headstocks/6/truss-cover/black.png'),
    price: 20,
  },
  h33: {
    label: 'H33',
    note: 'Classic inline',
    mask: asset('models/all-models/headstocks/6/masks/h33/mask.png'),
    logo: asset('models/all-models/headstocks/6/logos/h33/wl.png'),
    tuners: {
      chrome: asset('models/all-models/headstocks/6/tuners/h33/chrome.png'),
      black: asset('models/all-models/headstocks/6/tuners/h33/black.png'),
      gold: asset('models/all-models/headstocks/6/tuners/h33/gold.png'),
    },
    strings: asset('models/all-models/headstocks/6/string-overlays/standard/h33.png'),
    trussCover: asset('models/all-models/headstocks/6/truss-cover/black.png'),
    price: 45,
  },
  h33r: {
    label: 'H33R',
    note: 'Reverse inline',
    mask: asset('models/all-models/headstocks/6/masks/h33r/mask.png'),
    logo: asset('models/all-models/headstocks/6/logos/hr33/wl.png'),
    tuners: {
      black: asset('models/all-models/headstocks/6/tuners/hr33/black.png'),
    },
    strings: asset('models/all-models/headstocks/6/string-overlays/standard/hr33.png'),
    trussCover: asset('models/all-models/headstocks/6/truss-cover/black.png'),
    price: 55,
  },
}

export const HARDWARE_OPTIONS = {
  chrome: {
    label: 'Chrome',
    note: 'Standard bright hardware',
    price: 0,
    color: 'chrome',
  },
  black: {
    label: 'Black',
    note: 'Stealth hardware',
    price: 35,
    color: 'black',
  },
  gold: {
    label: 'Gold',
    note: 'Premium gold finish',
    price: 60,
    color: 'gold',
  },
}

export const PICKUP_OPTIONS = {
  sss: {
    label: 'SSS',
    note: 'Three single coils',
    price: 0,
  },
  hss: {
    label: 'HSS',
    note: 'Bridge humbucker, singles',
    price: 110,
  },
  hh: {
    label: 'HH',
    note: 'Dual humbuckers',
    price: 135,
  },
  p90: {
    label: 'P90',
    note: 'P90 bridge and neck set',
    price: 125,
  },
  fluence: {
    label: 'Fluence',
    note: 'Modern active set',
    price: 185,
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
      chrome: asset('models/rs/bodies/front/knobs/black.png'),
      black: asset('models/rs/bodies/front/knobs/black.png'),
      gold: asset('models/rs/bodies/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: asset('models/rs/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('models/rs/bodies/front/strap buttons/standard/black.png'),
      gold: asset('models/rs/bodies/front/strap buttons/standard/gold.png'),
    },
    switch: asset('models/rs/bodies/front/switches/blade/black.png'),
    pickguard: {
      chrome: asset('models/rs/bodies/front/pickguard/white.png'),
      black: asset('models/rs/bodies/front/pickguard/black.png'),
      gold: asset('models/rs/bodies/front/pickguard/red-tortoise.png'),
    },
  },
  solo: {
    bridge: BRIDGE_OPTIONS.hipshotFixed.assets,
    knobs: {
      chrome: asset('models/solo/bodies/front/knobs/chrome.png'),
      black: asset('models/solo/bodies/front/knobs/black.png'),
      gold: asset('models/solo/bodies/front/knobs/tamarind.png'),
    },
    strap: {
      chrome: asset('models/solo/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('models/solo/bodies/front/strap buttons/standard/black.png'),
      gold: asset('models/solo/bodies/front/strap buttons/standard/gold.png'),
    },
    switch: asset('models/solo/bodies/front/switches/blade/black.png'),
    pickguard: null,
  },
  dc: {
    bridge: BRIDGE_OPTIONS.floydRoseTremolo.assets,
    knobs: {
      chrome: asset('models/dc/bodies/front/knobs/white-pearl-dtmv.png'),
      black: asset('models/dc/bodies/front/knobs/black-dtmv.png'),
      gold: asset('models/dc/bodies/front/knobs/white-pearl-inlay.png'),
    },
    strap: {
      chrome: asset('models/dc/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('models/dc/bodies/front/strap buttons/standard/black.png'),
      gold: asset('models/dc/bodies/front/strap buttons/standard/chrome.png'),
    },
    switch: asset('models/dc/bodies/front/switches/blade/black.png'),
    pickguard: null,
  },
  delos: {
    bridge: BRIDGE_OPTIONS.hipshotTremolo.assets,
    knobs: {
      chrome: asset('models/delos/bodies/front/knobs/white-plastic-dtmv.png'),
      black: asset('models/delos/bodies/front/knobs/black-dtmv.png'),
      gold: asset('models/delos/bodies/front/knobs/white-pearl-inlay-dtmv.png'),
    },
    strap: {
      chrome: asset('models/delos/bodies/front/strap buttons/standard/chrome.png'),
      black: asset('models/delos/bodies/front/strap buttons/standard/black.png'),
      gold: asset('models/delos/bodies/front/strap buttons/standard/chrome.png'),
    },
    switch: asset('models/delos/bodies/front/switches/blade/black.png'),
    pickguard: asset('models/delos/bodies/front/pickguard/white.png'),
  },
}

export const PUPPY = {
  single: {
    route: {
      chrome: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-neck.png'),
      },
      black: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-neck.png'),
      },
      gold: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/singlecoil/black-neck.png'),
      },
    },
    body: {
      chrome: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-neck.png'),
      },
      black: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-neck.png'),
      },
      gold: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/singlecoil/black-neck.png'),
      },
    },
    poles: {
      chrome: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-neck.png'),
      },
      black: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/black-neck.png'),
      },
      gold: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-bridge.png'),
        middle: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-middle.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/singlecoil/chrome-neck.png'),
      },
    },
  },
  humbucker: {
    route: {
      chrome: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/neck.png'),
      },
      black: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/neck.png'),
      },
      gold: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-routes/humbucker/neck.png'),
      },
    },
    body: {
      chrome: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/chrome-bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-neck.png'),
      },
      black: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-neck.png'),
      },
      gold: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/chrome-bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/black-neck.png'),
      },
    },
    poles: {
      chrome: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-neck.png'),
      },
      black: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/black-neck.png'),
      },
      gold: {
        bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-bridge.png'),
        neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/open/silver-neck.png'),
      },
    },
  },
}

PUPPY.p90 = {
  route: PUPPY.humbucker.route,
  body: {
    chrome: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-bridge-black.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-neck-black.png'),
    },
    black: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-bridge-black.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-neck-black.png'),
    },
    gold: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-bridge-black.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/p90-neck-black.png'),
    },
  },
  poles: {
    chrome: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-bridge.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-neck.png'),
    },
    black: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-bridge.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-neck.png'),
    },
    gold: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-bridge.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pole-pieces/humbucker/covered/p90-neck.png'),
    },
  },
}

PUPPY.fluence = {
  route: PUPPY.humbucker.route,
  body: {
    chrome: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck.png'),
    },
    black: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck.png'),
    },
    gold: {
      bridge: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-bridge.png'),
      neck: asset('models/all-models/pickups/6-string/24-frets/standard/pickup-bodies/covered/fluence-neck.png'),
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
