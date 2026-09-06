/**
 * Configurator Schema
 * 
 * Data-driven configuration that defines all customizable options,
 * their dependencies, default values, and how they map to assets.
 * 
 * Adding a new model only requires adding its entry here and its asset folders.
 * No additional UI code is needed.
 */

import {
  resolveOptionPreview,
  resolveBodyMask,
  resolveBodyWoodAsset,
  resolveFingerboardWoodAsset,
  resolveNeckWoodAsset,
  resolveHeadstockWoodAsset,
  resolveTopWoodAsset,
  resolveFinishAsset,
  resolveTopCoatAsset,
  resolveShadows,
  resolveGloss,
  resolveBodySpecificAsset,
  resolvePickupRoute,
  resolvePickupBody,
  resolvePickupPoles,
  resolveHeadstockMask,
  resolveHeadstockTuners,
  resolveHeadstockStrings,
  resolveTrussCover,
  resolveInlay,
  resolveButtonAsset,
   getButtonPreview,
   resolveKnobStyleOverlay,
   resolveTremoloCoverAsset,
} from './assetResolver'

import {
  KNOB_STYLE_OPTIONS,
  TREMOLO_COVER_OPTIONS_BY_BRIDGE,
  TUNING_DISCLAIMER,
  PICKUP_COLOR_OPTIONS,
  BRIDGE_OPTIONS_BY_BODY,
  BRIDGE_OPTIONS,
} from './guitarBuilderData'

import {
  VADER_PICKUP_OPTIONS,
  VADER_STRAP_BUTTON_OPTIONS,
  VADER_ELECTRONICS_CAVITY_COVER_OPTIONS,
} from './bassBuilderData'

// ============================================================
// CATEGORY & MODEL DEFINITIONS
// ============================================================

export const CATEGORIES = {
  electric: {
    label: 'Electric Guitar',
    icon: 'Guitar',
    models: {
      dc: {
        label: 'DC',
        note: 'Double-cut access',
        defaultConfig: {
          body: 'dc',
          bodyWood: 'mah',
          neckWood: 'maple',
          fingerboardWood: 'rosewood',
          headstockWood: 'plain-maple',
          headstockShape: 'gt6',
           bridge: 'hipshotFixed',
           hardwareColor: 'chrome',
           knobs: 'plasticBlack',
           pickupConfiguration: 'hh',
           inlay: 'id-white-pearl',
           topCoat: 'gloss',
           topWood: 'none',
           finishType: 'solid',
           finishColor: 'black',
           dexterity: 'right',
           strings: '6',
           multiscale: 'off',
           scaleLength: '25.5',
           case: 'none',
           bevel: 'off',
           neckConstruction: '1piece',
           frets: 'stainless',
           neckRearFinish: 'tungOil',
            trussRodCover: 'black',
            electronicsType: 'passive',
            bridgePickupModel: 'vantium',
            middlePickupModel: 'none',
            neckPickupModel: 'vantium',
            pickupColor: 'bobbins',
            pickupColorVariant: 'black',
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
        },
      },
      solo: {
        label: 'Solo',
        note: 'Modern singlecut body',
        defaultConfig: {
          body: 'solo',
          bodyWood: 'mah',
          neckWood: 'maple',
          fingerboardWood: 'rosewood',
          headstockWood: 'plain-maple',
          headstockShape: 'gt6',
           bridge: 'hipshotFixed',
           hardwareColor: 'chrome',
           knobs: 'black',
           pickupConfiguration: 'hh',
           inlay: 'id-white-pearl',
           topCoat: 'gloss',
           topWood: 'none',
           finishType: 'solid',
           finishColor: 'black',
           dexterity: 'right',
           strings: '6',
           multiscale: 'off',
           scaleLength: '25.5',
           case: 'none',
           bevel: 'off',
           neckConstruction: '1piece',
           frets: 'stainless',
           neckRearFinish: 'tungOil',
           trussRodCover: 'black',
           electronicsType: 'passive',
           bridgePickupModel: 'vantium',
           middlePickupModel: 'none',
           neckPickupModel: 'vantium',
           pickupColor: 'bobbins',
           pickupColorVariant: 'black',
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
         },
       },
       delos: {
        label: 'Delos',
        note: 'Contoured body build',
        defaultConfig: {
          body: 'delos',
          bodyWood: 'mah',
          neckWood: 'maple',
          fingerboardWood: 'rosewood',
          headstockWood: 'plain-maple',
          headstockShape: 'gt6',
           bridge: 'hipshotTremolo',
           hardwareColor: 'chrome',
           knobs: 'black',
           pickupConfiguration: 'hss',
           inlay: 'id-white-pearl',
           topCoat: 'gloss',
           topWood: 'none',
           finishType: 'solid',
           finishColor: 'black',
           dexterity: 'right',
           strings: '6',
           multiscale: 'off',
           scaleLength: '25.5',
           case: 'none',
           bevel: 'off',
           neckConstruction: '1piece',
           frets: 'stainless',
           neckRearFinish: 'tungOil',
            trussRodCover: 'black',
            electronicsType: 'passive',
            bridgePickupModel: 'vantium',
            middlePickupModel: 'none',
            neckPickupModel: 'vantium',
            pickupColor: 'bobbins',
            pickupColorVariant: 'black',
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
        },
      },
    },
  },
  bass: {
    label: 'Bass Guitar',
    icon: 'Bass',
    models: {
      vader: {
        label: 'Vader',
        note: 'Modern aggressive bass shape',
        defaultConfig: {
          bassType: 'vader',
          bodyWood: 'alder',
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
          dexterity: 'right',
          multiscale: 'off',
          scaleLength: '34',
          case: 'none',
          bevel: 'off',
          topWood: 'none',
          topCoat: 'clearGloss',
          finishType: 'solid',
          burstFinish: 'none',
          neckConstruction: '1piece',
          inlayShape: 'dots',
          inlayMaterial: 'pearl',
          frets: 'stainlessRegular',
          neckRearFinish: 'tungOil',
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
        },
      },
      pb: {
        label: 'Precision',
        note: 'Classic P-bass style',
        defaultConfig: {
          bassType: 'pb',
          bodyWood: 'alder',
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
          pickupTypeStyle: 'p',
          hardware: 'chrome',
          strings: '4',
          pickupConfig: 'p',
          logo: 'standard',
          backplate: 'standard',
          pickupScrews: 'black',
          controlPlate: 'black',
          dexterity: 'right',
          multiscale: 'off',
          scaleLength: '34',
          case: 'none',
          bevel: 'off',
          topWood: 'none',
          topCoat: 'clearGloss',
          finishType: 'solid',
          burstFinish: 'none',
          neckConstruction: '1piece',
          inlayShape: 'dots',
          inlayMaterial: 'pearl',
          frets: 'stainlessRegular',
          neckRearFinish: 'tungOil',
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
        },
      },
      jb: {
        label: 'Jazz',
        note: 'Modern J-bass style',
        defaultConfig: {
          bassType: 'jb',
          bodyWood: 'alder',
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
          dexterity: 'right',
          multiscale: 'off',
          scaleLength: '34',
          case: 'none',
          bevel: 'off',
          topWood: 'none',
          topCoat: 'clearGloss',
          finishType: 'solid',
          burstFinish: 'none',
          neckConstruction: '1piece',
          inlayShape: 'dots',
          inlayMaterial: 'pearl',
          frets: 'stainlessRegular',
          neckRearFinish: 'tungOil',
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
        },
      },
    },
  },
}

// ============================================================
// OPTION GROUPS & FIELDS
// ============================================================

/**
 * Each option field defines:
 *   key: config property name
 *   label: Display label
 *   type: 'select' | 'image-select' | 'color' | 'toggle'
 *   options: Array of { value, label, note, price?, preview? }
 *   condition: Optional function(config) => boolean to show/hide
 *   previewResolver: Function(category, model, value) => image URL or null
 *   section: The section it belongs to
 */

export const OPTION_FIELDS = [
  // ============================================================
  // 1. GENERAL OPTIONS
  // ============================================================
  {
    section: 'General',
    key: 'dexterity',
    label: 'Dexterity',
    type: 'select',
    options: [
      { value: 'right', label: 'Right Handed', note: 'Standard orientation', price: 0 },
      { value: 'left', label: 'Left Handed', note: 'Reversed orientation', price: 0 },
    ],
  },
  {
    section: 'General',
    key: 'strings',
    label: 'Number of Strings',
    type: 'select',
    options: [
      { value: '6', label: '6 Strings', note: 'Standard six-string', price: 0 },
      { value: '7', label: '7 Strings', note: 'Extended range', price: 0 },
      { value: '8', label: '8 Strings', note: 'Extended range', price: 0 },
    ],
  },
  {
    section: 'General',
    key: 'multiscale',
    label: 'Multiscale',
    type: 'select',
    options: [
      { value: 'off', label: 'Off', note: 'Straight scale', price: 0 },
      { value: 'on', label: 'On', note: 'Multiscale fan', price: 0 },
    ],
  },
  {
    section: 'General',
    key: 'scaleLength',
    label: 'Scale Length',
    type: 'select',
    options: [
      { value: '25.5', label: '25.5"', note: 'Standard scale', price: 0 },
      { value: '26.5', label: '26.5"', note: 'Baritone scale', price: 0 },
      { value: '27', label: '27"', note: 'Multiscale low', price: 0 },
    ],
  },
  {
    section: 'General',
    key: 'case',
    label: 'Case',
    type: 'select',
    options: [
      { value: 'none', label: 'No Case', note: 'No case included', price: 0 },
      { value: 'gigbag', label: 'Gig Bag', note: 'Padded gig bag', price: 60 },
      { value: 'hardcase', label: 'Hard Case', note: 'Molded hard case', price: 120 },
    ],
  },

  // ============================================================
  // 2. BODY OPTIONS
  // ============================================================
  {
    section: 'Body',
    key: 'bodyWood',
    label: 'Body Wood',
    type: 'image-select',
    previewResolver: (category, model, value) => resolveBodyWoodAsset(category, model, value),
    options: [
      { value: 'ald', label: 'Alder', note: 'Balanced tonewood', price: 0 },
      { value: 'ash2', label: 'Ash', note: 'Bright snappy tone', price: 0 },
      { value: 'mah', label: 'Mahogany', note: 'Warm resonant tone', price: 0 },
      { value: 'lmb', label: 'Black Limba', note: 'Exotic dark wood', price: 0 },
      { value: 'roasted-ash', label: 'Roasted Ash', note: 'Aged balanced tone', price: 0 },
      { value: 'summer-ash1', label: 'Summer Ash', note: 'Lightweight tone', price: 0 },
      { value: 'wal', label: 'Walnut', note: 'Warm rich tone', price: 0 },
    ],
  },
  {
    section: 'Body',
    key: 'topWood',
    label: 'Top Wood',
    type: 'image-select',
    previewResolver: (category, model, value) => {
      if (value === 'none') return null
      return resolveTopWoodAsset(category, model, value)
    },
    options: [
      { value: 'none', label: 'None', note: 'No top wood', price: 0, noImage: true },
      { value: 'buckeye', label: 'Buckeye Burl', note: 'Figured burl top', price: 0 },
      { value: 'burled-maple', label: 'Burled Maple', note: 'Burled maple top', price: 0 },
      { value: 'claro-walnut', label: 'Claro Walnut', note: 'Premium walnut top', price: 0 },
      { value: 'flamed-koa', label: 'Flamed Koa', note: 'Exotic flamed top', price: 0 },
      { value: 'flamed-maple', label: 'Flamed Maple', note: 'Classic flamed top', price: 0 },
      { value: 'quilted-maple', label: 'Quilted Maple', note: 'Premium quilted top', price: 0 },
      { value: 'spalted-maple', label: 'Spalted Maple', note: 'Unique spalted top', price: 0 },
    ],
  },
  {
    section: 'Body',
    key: 'bevel',
    label: 'Beveled Body Edges',
    type: 'select',
    options: [
      { value: 'off', label: 'Off', note: 'Square body edges', price: 0 },
      { value: 'on', label: 'On', note: 'Beveled body edges', price: 40 },
    ],
  },
  {
    section: 'Body',
    key: 'finishType',
    label: 'Finish Type',
    type: 'select',
    options: [
      { value: 'solid', label: 'Solid', note: 'Opaque color finish', price: 0 },
      { value: 'translucent', label: 'Translucent', note: 'See-through color', price: 35 },
      { value: 'metallic', label: 'Metallic', note: 'Metallic flake finish', price: 35 },
      { value: 'sparkle', label: 'Sparkle', note: 'Sparkle finish', price: 40 },
      { value: 'burst', label: 'Burst', note: 'Gradient burst edges', price: 45 },
      { value: 'fade', label: 'Fade', note: 'Smooth color fade', price: 45 },
    ],
  },
  {
    section: 'Body',
    key: 'finishColor',
    label: 'Finish Color',
    type: 'image-select',
    dependency: 'finishType',
    previewResolver: (category, model, value, config) => {
      if (!config.finishType || config.finishType === 'burst' || config.finishType === 'fade') {
        return getButtonPreview(category, model, 'finish', `${config.finishType || 'solid'}/${value}`)
      }
      return resolveFinishAsset(category, model, config.finishType || 'solid', value)
    },
    getOptions: (config) => {
      const finishType = config.finishType || 'solid'
      // Metallic finish colors -> loads from woods-colors/colors/metallics/
      if (finishType === 'metallic') {
        return [
          { value: 'black', label: 'Black Metallic', price: 35 },
          { value: 'red', label: 'Red Metallic', price: 35 },
          { value: 'blue', label: 'Blue Metallic', price: 35 },
          { value: 'green', label: 'Green Metallic', price: 35 },
          { value: 'silver', label: 'Silver Metallic', price: 35 },
          { value: 'gold', label: 'Gold Metallic', price: 35 },
          { value: 'purple', label: 'Purple Metallic', price: 35 },
          { value: 'gunmetal', label: 'Gunmetal Metallic', price: 35 },
        ]
      }
      // Translucent finish colors -> loads from woods-colors/colors/transluscents/
      if (finishType === 'translucent') {
        return [
          { value: 'black', label: 'Transparent Black', price: 35 },
          { value: 'red', label: 'Transparent Red', price: 35 },
          { value: 'blue', label: 'Transparent Blue', price: 35 },
          { value: 'green', label: 'Transparent Green', price: 35 },
          { value: 'amber', label: 'Transparent Amber', price: 35 },
          { value: 'purple', label: 'Transparent Purple', price: 35 },
          { value: 'yellow', label: 'Transparent Yellow', price: 35 },
        ]
      }
      // Sparkle finish colors -> loads from woods-colors/colors/sparkle/
      if (finishType === 'sparkle') {
        return [
          { value: 'black', label: 'Black Sparkle', price: 40 },
          { value: 'red', label: 'Red Sparkle', price: 40 },
          { value: 'blue', label: 'Blue Sparkle', price: 40 },
          { value: 'gold', label: 'Gold Sparkle', price: 40 },
          { value: 'silver', label: 'Silver Sparkle', price: 40 },
          { value: 'purple', label: 'Purple Sparkle', price: 40 },
          { value: 'green', label: 'Green Sparkle', price: 40 },
        ]
      }
      // Fade finish colors -> loads from woods-colors/colors/fades/
      if (finishType === 'fade') {
        return [
          { value: 'black-to-red', label: 'Black to Red', price: 45 },
          { value: 'black-to-blue', label: 'Black to Blue', price: 45 },
          { value: 'black-to-green', label: 'Black to Green', price: 45 },
          { value: 'white-to-black', label: 'White to Black', price: 45 },
          { value: 'red-to-yellow', label: 'Red to Yellow', price: 45 },
          { value: 'blue-to-purple', label: 'Blue to Purple', price: 45 },
        ]
      }
      if (finishType === 'burst') {
        return [
          { value: 'black', label: 'Black Burst', price: 45 },
          { value: 'red', label: 'Red Burst', price: 45 },
          { value: 'blue', label: 'Blue Burst', price: 45 },
          { value: 'tobacco', label: 'Tobacco Burst', price: 45 },
        ]
      }
      // Solid finishes (default) -> loads from woods-colors/colors/solids/
      return [
        { value: 'black', label: 'Black', price: 25 },
        { value: 'white', label: 'White', price: 25 },
        { value: 'red', label: 'Red', price: 30 },
        { value: 'blue', label: 'Blue', price: 30 },
        { value: 'green', label: 'Green', price: 30 },
        { value: 'yellow', label: 'Yellow', price: 30 },
        { value: 'orange', label: 'Orange', price: 30 },
        { value: 'purple', label: 'Purple', price: 30 },
        { value: 'turquoise', label: 'Turquoise', price: 35 },
        { value: 'candy-apple-red', label: 'Candy Apple Red', price: 35 },
        { value: 'coral', label: 'Coral', price: 35 },
        { value: 'light-blue', label: 'Light Blue', price: 35 },
      ]
    },
  },
  {
    section: 'Body',
    key: 'topCoat',
    label: 'Top Coat',
    type: 'image-select',
    previewResolver: (category, model, value) => resolveTopCoatAsset(category, model, value),
    options: [
      { value: 'gloss', label: 'Clear Gloss', note: 'High-gloss clear coat', price: 0 },
      { value: 'matte', label: 'Satin Matte', note: 'Low-sheen satin', price: 0 },
      { value: 'open-pore', label: 'Open Pore', note: 'Natural open pore finish', price: 0 },
    ],
  },

  // ============================================================
  // 3. NECK OPTIONS
  // ============================================================
  {
    section: 'Neck',
    key: 'neckWood',
    label: 'Neck Wood',
    type: 'image-select',
    previewResolver: (category, model, value) => resolveNeckWoodAsset(category, model, value),
    options: [
      { value: 'maple', label: 'Maple', note: 'Bright clear tone', price: 0 },
      { value: 'plain-maple', label: 'Plain Maple', note: 'Standard maple neck', price: 0 },
      { value: '3mp', label: '3-Piece Maple', note: 'Stable 3-piece maple', price: 0 },
      { value: '3mm', label: '3-Piece Maple/Mahogany', note: 'Warm 3-piece neck', price: 0 },
      { value: '3mw', label: '3-Piece Maple/Walnut', note: 'Balanced 3-piece neck', price: 0 },
      { value: '5mp', label: '5-Piece Maple', note: 'Ultra-stable 5-piece', price: 0 },
      { value: '5mw', label: '5-Piece Maple/Walnut', note: 'Premium 5-piece neck', price: 0 },
      { value: '5ml', label: '5-Piece Maple/Limba', note: 'Exotic 5-piece neck', price: 0 },
      { value: 'waln', label: 'Walnut', note: 'Warm walnut neck', price: 95 },
      { value: 'rfmn', label: 'Roasted Flamed Maple', note: 'Aged flamed maple', price: 75 },
      { value: 'lmbn', label: 'Black Limba', note: 'Exotic limba neck', price: 0 },
    ],
  },
  {
    section: 'Neck',
    key: 'neckConstruction',
    label: 'Neck Construction',
    type: 'select',
    options: [
      { value: '1piece', label: '1-Piece', note: 'Single-piece neck', price: 0 },
      { value: '3piece', label: '3-Piece', note: 'Three-piece neck', price: 0 },
      { value: '5piece', label: '5-Piece', note: 'Five-piece neck', price: 0 },
    ],
  },
  {
    section: 'Neck',
    key: 'fingerboardWood',
    label: 'Fingerboard Wood',
    type: 'image-select',
    previewResolver: (category, model, value) => resolveFingerboardWoodAsset(category, model, value),
    options: [
      { value: 'maple', label: 'Maple', note: 'Clean and bright', price: 0 },
      { value: 'rosewood', label: 'Rosewood', note: 'Classic dark board', price: 60 },
      { value: 'ebony', label: 'Ebony', note: 'Snappy premium board', price: 80 },
      { value: 'flamed-maple', label: 'Flamed Maple', note: 'Figured maple board', price: 0 },
      { value: 'birdseye-maple', label: 'Birdseye Maple', note: 'Unique birdseye grain', price: 0 },
      { value: 'roasted-maple', label: 'Roasted Maple', note: 'Aged maple board', price: 0 },
      { value: 'roasted-flame', label: 'Roasted Flame', note: 'Aged flamed board', price: 0 },
      { value: 'pale-moon-ebony', label: 'Pale Moon Ebony', note: 'Exotic pale ebony', price: 0 },
      { value: 'zebrawood', label: 'Zebrawood', note: 'Striking zebra grain', price: 0 },
      { value: 'ziricote', label: 'Ziricote', note: 'Exotic dark grain', price: 0 },
      { value: 'purple-heart', label: 'Purple Heart', note: 'Vibrant purple wood', price: 0 },
      { value: 'bloodwood', label: 'Bloodwood', note: 'Deep red board', price: 0 },
      { value: 'royal-ebony', label: 'Royal Ebony', note: 'Premium dark board', price: 0 },
      { value: 'richlite', label: 'Richlite', note: 'Modern composite board', price: 0 },
    ],
  },
  {
    section: 'Neck',
    key: 'inlayShape',
    label: 'Inlay Shape',
    type: 'image-select',
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'inlay-shape', value),
    options: [
      { value: 'dots', label: 'Dots', note: 'Classic dot inlays (id)', price: 0 },
      { value: 'diamonds', label: 'Diamonds', note: 'Diamond inlays (idia)', price: 30 },
      { value: 'blocks', label: 'Blocks', note: 'Block inlays (ib)', price: 30 },
    ],
  },
  {
    section: 'Neck',
    key: 'inlayMaterial',
    label: 'Inlay Material',
    type: 'image-select',
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'inlay-material', value),
    options: [
      { value: 'motherOfPearl', label: 'Mother of Pearl', note: 'Classic mother of pearl', price: 0 },
      { value: 'green', label: 'Green Acrylic', note: 'Green acrylic inlay', price: 35 },
      { value: 'pink', label: 'Pink', note: 'Pink acrylic inlay', price: 35 },
      { value: 'red', label: 'Red', note: 'Red acrylic inlay', price: 35 },
      { value: 'white', label: 'White', note: 'White inlay', price: 35 },
      { value: 'black', label: 'Black', note: 'Black inlay', price: 0 },
      { value: 'abalone', label: 'Abalone', note: 'Shell-like abalone material', price: 35 },
      { value: 'luminlay', label: 'Luminlay', note: 'Glow-in-the-dark material', price: 35 },
    ],
  },
  {
    section: 'Neck',
    key: 'frets',
    label: 'Frets',
    type: 'select',
    options: [
      { value: 'stainless', label: 'Stainless Steel', note: 'Durable stainless frets', price: 60 },
      { value: 'gold', label: 'Gold EVO', note: 'Premium gold EVO frets', price: 70 },
      { value: 'nickel', label: 'Nickel Silver', note: 'Standard nickel frets', price: 0 },
    ],
  },
  {
    section: 'Neck',
    key: 'neckRearFinish',
    label: 'Neck Rear Finish',
    type: 'select',
    options: [
      { value: 'none', label: 'Natural', note: 'Natural neck rear', price: 0 },
      { value: 'tungOil', label: 'Tung Oil', note: 'Tung oil neck finish', price: 0 },
      { value: 'satin', label: 'Satin', note: 'Smooth satin finish', price: 0 },
    ],
  },
  {
    section: 'Neck',
    key: 'headstockShape',
    label: 'Headstock Shape',
    type: 'image-select',
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'headstock-shape', value),
    options: [
      { value: 'gt6', label: 'GT6', note: 'Straight 6-in-line', price: 0 },
      { value: 'gt6r', label: 'GT6R', note: 'Reverse 6-in-line', price: 20 },
      { value: 'h33', label: 'H33', note: 'Classic inline', price: 45 },
      { value: 'h33r', label: 'H33R', note: 'Reverse inline', price: 55 },
      { value: '6in', label: '6 Inline', note: 'Standard 6 inline', price: 0 },
      { value: '6inr', label: '6 Inline Reverse', note: 'Reverse 6 inline', price: 20 },
       { value: '6kr', label: '6 KR', note: '6 KR headstock', price: 0 },
       { value: '624', label: '2×4', note: '2×4 headstock', price: 20 },
     ],
  },
  {
    section: 'Neck',
    key: 'trussRodCover',
    label: 'Truss Rod Cover',
    type: 'image-select',
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'truss-cover', value),
    options: [
      { value: 'black', label: 'Black', note: 'Black truss rod cover', price: 0 },
      { value: 'creme', label: 'Cream', note: 'Cream cover', price: 10 },
      { value: 'white', label: 'White', note: 'White cover', price: 10 },
      { value: 'pearloid', label: 'Pearloid', note: 'Pearloid cover', price: 15 },
      { value: 'ebony', label: 'Ebony', note: 'Ebony cover', price: 20 },
      { value: 'purpleheart', label: 'Purpleheart', note: 'Purpleheart cover', price: 25 },
      { value: 'red-tortoise', label: 'Red Tortoise', note: 'Red tortoise cover', price: 15 },
    ],
  },

  // ============================================================
  // 4. ELECTRONICS OPTIONS
  // ============================================================
  {
    section: 'Electronics',
    key: 'electronicsType',
    label: 'Electronics Type',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    options: [
      { value: 'passive', label: 'Passive', note: 'Standard passive electronics', price: 0 },
      { value: 'active', label: 'Active', note: 'Active preamp electronics', price: 80 },
    ],
  },
  {
    section: 'Electronics',
    key: 'pickupConfiguration',
    label: 'Pickup Configuration',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    // Responsible for defining available pickup configuration layouts (HH / H-S-H)
    options: [
      { value: 'hh', label: 'HH (Dual Humbuckers)', note: 'Two humbuckers', price: 135 },
      { value: 'hss', label: 'H-S-H (Humbucker-Single-Humbucker)', note: 'Bridge humbucker, middle single, neck humbucker', price: 110 },
    ],
  },
  {
    section: 'Electronics',
    key: 'bridgePickupModel',
    label: 'Bridge Pickup',
    type: 'select',
    
    // Responsible for defining bridge humbucker pickup model options
    dependency: 'pickupConfiguration',
    condition: (config) => {
      if (config.bassType === 'vader') return false
      const cfg = config.pickupConfiguration || 'hh'
      if (cfg === 'hh') return true
      if (cfg === 'hss') return true
      return false
    },
    options: [
      { value: 'beryllium', label: 'Beryllium', note: 'Beryllium bridge pickup', price: 0 },
      { value: 'holdsworth', label: 'Holdsworth', note: 'Holdsworth bridge pickup', price: 0 },
      { value: 'lithium', label: 'Lithium', note: 'Lithium bridge pickup', price: 0 },
      { value: 'illusionist', label: 'Illusionist', note: 'Illusionist bridge pickup', price: 0 },
      { value: 'thorium', label: 'Thorium', note: 'Thorium bridge pickup', price: 0 },
      { value: 'vantium', label: 'Vantium', note: 'Vantium bridge pickup', price: 0 },
    ],
  },
  {
    section: 'Electronics',
    key: 'middlePickupModel',
    label: 'Middle Pickup',
    type: 'select',
    // Responsible for defining middle single coil pickup model options
    condition: (config) => {
      if (config.bassType === 'vader') return false
      const cfg = config.pickupConfiguration || 'hh'
      return cfg === 'hss'
    },
    options: [
      { value: 'none', label: 'None', note: 'No middle pickup', price: 0 },
      { value: 'single-coil', label: 'Single Coil', note: 'Standard single coil', price: 0 },
    ],
  },
  {
    section: 'Electronics',
    key: 'neckPickupModel',
    label: 'Neck Pickup',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    // Responsible for defining neck humbucker pickup model options
    options: [
      { value: 'beryllium', label: 'Beryllium', note: 'Beryllium neck pickup', price: 0 },
      { value: 'holdsworth', label: 'Holdsworth', note: 'Holdsworth neck pickup', price: 0 },
      { value: 'lithium', label: 'Lithium', note: 'Lithium neck pickup', price: 0 },
      { value: 'empyrean', label: 'Empyrean', note: 'Empyrean neck pickup', price: 0 },
      { value: 'vantium', label: 'Vantium', note: 'Vantium neck pickup', price: 0 },
      { value: 'delete', label: 'Delete Neck Pickup', note: 'Remove neck pickup', price: 0 },
    ],
  },
  {
    section: 'Electronics',
    key: 'vaderBridgePickup',
    label: 'Pickup Model',
    type: 'select',
    condition: (config) => config.bassType === 'vader',
    options: [
      { value: 'radiumHumbucker', label: 'Radium Radiused Humbucker', note: 'Radium radiused humbucker', price: 0 },
      { value: 'radiumSingle', label: 'Radium Radiused Single Coil', note: 'Radium radiused single coil', price: 0 },
      { value: 'singleHbSweetSpot', label: 'Single HB Alnico Humbucker In Sweet Spot', note: 'Single HB Alnico in sweet spot', price: 0 },
      { value: 'hbAlnico', label: 'HB Alnico Humbucker', note: 'HB Alnico humbucker', price: 0 },
      { value: 'fishmanFluence', label: 'Fishman Fluence', note: 'Fishman Fluence pickup', price: 0 },
    ],
  },
  {
    section: 'Electronics',
    key: 'vaderNeckPickup',
    label: 'Neck Pickup',
    type: 'select',
    condition: (config) => {
      if (config.bassType !== 'vader') return false
      const bridge = config.vaderBridgePickup || 'radiumHumbucker'
      if (bridge === 'singleHbSweetSpot') return false
      return true
    },
    getOptions: (config) => {
      const bridge = config.vaderBridgePickup || 'radiumHumbucker'
      if (bridge === 'radiumHumbucker') {
        return [
          { value: 'radiumHumbucker', label: 'Radium Radiused Humbucker', note: 'Radium radiused humbucker', price: 0 },
        ]
      }
      if (bridge === 'radiumSingle') {
        return [
          { value: 'radiumHumbucker', label: 'Radium Radiused Humbucker', note: 'Radium radiused humbucker', price: 0 },
          { value: 'scpSplitCoil', label: 'SCP Split-Coil Alnico', note: 'SCP split-coil Alnico', price: 0 },
        ]
      }
      if (bridge === 'hbAlnico') {
        return [
          { value: 'jvaSingleCoil', label: 'JVA Single Coil', note: 'JVA single coil', price: 0 },
        ]
      }
      if (bridge === 'fishmanFluence') {
        return [
          { value: 'fishmanFluence', label: 'Fishman Fluence', note: 'Fishman Fluence neck', price: 0 },
        ]
      }
      return []
    },
  },
  {
    section: 'Electronics',
    key: 'vaderPickupColor',
    label: 'Pickup Color',
    type: 'select',
    condition: (config) => {
      if (config.bassType !== 'vader') return false
      const bridge = config.vaderBridgePickup || 'radiumHumbucker'
      const neck = config.vaderNeckPickup || 'none'
      const bridgeOpts = VADER_PICKUP_OPTIONS[bridge]
      const neckOpts = VADER_PICKUP_OPTIONS[neck]
      const colorPickups = ['radiumHumbucker', 'radiumSingle', 'jvaSingleCoil', 'scpSplitCoil']
      const hasColor = colorPickups.includes(bridge) || colorPickups.includes(neck)
      return hasColor || (bridgeOpts?.supportsColor || neckOpts?.supportsColor || false)
    },
    options: [
      { value: 'none', label: 'None (Stock)', note: 'No color customization', price: 0 },
      { value: 'custom', label: 'Custom RGB Color', note: 'Apply custom RGB color shift', price: 10 },
    ],
  },
  {
    section: 'Electronics',
    key: 'vaderPickupColorRgb',
    label: 'Pickup RGB Color',
    type: 'color',
    condition: (config) => {
      if (config.bassType !== 'vader') return false
      return config.vaderPickupColor === 'custom'
    },
  },
  {
    section: 'Hardware',
    key: 'hardware',
    label: 'Hardware Color',
    type: 'select',
    condition: (config) => config.bassType === 'vader',
    options: [
      { value: 'chrome', label: 'Chrome', note: 'Standard bright hardware', price: 0 },
      { value: 'black', label: 'Black', note: 'Stealth hardware', price: 45 },
    ],
  },
  {
    section: 'Hardware',
    key: 'knobs',
    label: 'Knobs',
    type: 'select',
    condition: (config) => config.bassType === 'pb' || config.bassType === 'jb',
    options: [
      { value: 'black', label: 'Black', note: 'Standard black knobs', price: 0 },
      { value: 'chrome', label: 'Chrome', note: 'Shiny chrome finish', price: 15 },
      { value: 'tamarind', label: 'Tamarind', note: 'Warm wood-look knobs', price: 20 },
      { value: 'pearl', label: 'Pearl Inlay', note: 'White pearl inlay knobs', price: 25 },
      { value: 'abalone', label: 'Abalone Inlay', note: 'Premium abalone inlay', price: 40 },
    ],
  },
  {
    section: 'Hardware',
    key: 'vaderStrapButtons',
    label: 'Strap Buttons',
    type: 'select',
    condition: (config) => config.bassType === 'vader',
    options: [
      { value: 'standard', label: 'Standard Straplocks', note: 'Standard strap buttons front and rear', price: 0 },
      { value: 'straplocks', label: 'Dunlop Straplocks', note: 'Dunlop straplocks front and rear', price: 50 },
    ],
  },
  {
    section: 'Hardware',
    key: 'vaderElectronicsCavityCover',
    label: 'Electronics Cavity Cover',
    type: 'select',
    condition: (config) => config.bassType === 'vader',
    options: [
      { value: 'black', label: 'Black', note: 'Black rear plate', price: 0 },
      { value: 'ebony', label: 'Ebony', note: 'Ebony rear plate', price: 15 },
      { value: 'purpleheart', label: 'Purpleheart', note: 'Purpleheart rear plate', price: 20 },
    ],
  },
  {
    section: 'Electronics',
    key: 'pickupColor',
    label: 'Pickup Color',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    // Responsible for defining pickup color/style type options (bobbins, painted, wooden, covers)
    options: [
      { value: 'bobbins', label: 'Bobbin Colors', note: 'Open coil bobbins', price: 0 },
      { value: 'painted', label: 'Painted Bobbins (RGB)', note: 'Custom RGB painted bobbins', price: 10 },
      { value: 'wooden', label: 'Wooden Bobbins', note: 'Wood grain bobbins', price: 15 },
      { value: 'covers', label: 'Covers', note: 'Covered pickup style', price: 10 },
    ],
  },
  {
    section: 'Electronics',
    key: 'pickupColorVariant',
    label: 'Pickup Color Variant',
    type: 'select',
    // Responsible for defining specific color variants within each pickup color type
    dependency: 'pickupColor',
    condition: (config) => config.bassType !== 'vader' && !!config.pickupColor && config.pickupColor !== 'none',
    getOptions: (config) => {
      const type = config.pickupColor || 'bobbins'
      if (type === 'bobbins') {
        return [
          { value: 'black', label: 'Black', note: 'Black bobbins', price: 0 },
          { value: 'white', label: 'White', note: 'White bobbins', price: 0 },
          { value: 'cream', label: 'Cream', note: 'Cream bobbins', price: 0 },
          { value: 'racing-green', label: 'Racing Green', note: 'Racing green bobbins', price: 0 },
          { value: 'white-black', label: 'White & Black', note: 'White and black bobbins', price: 0 },
          { value: 'black-cream', label: 'Black & Cream', note: 'Black and cream bobbins', price: 0 },
          { value: 'racing-green-black', label: 'Racing Green & Black', note: 'Racing green and black bobbins', price: 0 },
        ]
      }
      if (type === 'covers') {
        return [
          { value: 'black', label: 'Black', note: 'Black covers', price: 0 },
          { value: 'chrome', label: 'Chrome', note: 'Chrome covers', price: 10 },
          { value: 'gold', label: 'Gold', note: 'Gold covers', price: 15 },
        ]
      }
      return []
    },
  },
  {
    section: 'Electronics',
    key: 'pickupPaintedColor',
    label: 'Painted Color (RGB)',
    type: 'color',
    // Responsible for defining RGB color input for painted bobbins
    condition: (config) => config.bassType !== 'vader' && config.pickupColor === 'painted',
  },
  {
    section: 'Electronics',
    key: 'pickupWoodType',
    label: 'Wood Type',
    type: 'image-select',
    // Responsible for defining wood type options for wooden bobbins
    previewResolver: (category, model, value) => resolveBodyWoodAsset(category, model, value),
    condition: (config) => config.bassType !== 'vader' && config.pickupColor === 'wooden',
    options: [
      { value: 'black', label: 'Black', note: 'Dark wood grain', price: 0 },
      { value: 'white', label: 'White', note: 'Light wood grain', price: 0 },
      { value: 'cream', label: 'Cream', note: 'Cream wood grain', price: 0 },
      { value: 'racing-green', label: 'Racing Green', note: 'Green wood grain', price: 0 },
    ],
  },
  {
    section: 'Electronics',
    key: 'pickupPoleColor',
    label: 'Pole Piece Color',
    type: 'image-select',
    // Responsible for defining pole piece color options (black, silver, gold)
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'pole-pieces', value),
    condition: (config) => config.bassType !== 'vader',
    options: [
      { value: 'black', label: 'Black', note: 'Black pole pieces', price: 0 },
      { value: 'silver', label: 'Silver', note: 'Silver pole pieces', price: 10 },
      { value: 'gold', label: 'Gold', note: 'Gold pole pieces', price: 10 },
    ],
  },
  {
    section: 'Electronics',
    key: 'controls',
    label: 'Controls',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    // Responsible for defining controls layout options (Off, DTC, DTMV)
    options: [
      { value: 'off', label: 'Off', note: 'Standard control layout', price: 0 },
      { value: 'deleteTone', label: 'Delete Tone Control', note: 'Remove tone control', price: 0 },
      { value: 'deleteToneMoveVolume', label: 'Delete Tone Control and Move Volume to Tone Position', note: 'Move volume to tone position', price: 0 },
    ],
  },

  // ============================================================
  // 5. HARDWARE OPTIONS
  // ============================================================
  {
    section: 'Hardware',
    key: 'bridge',
    label: 'Bridge',
    type: 'image-select',
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'bridge', value),
    getOptions: (config, category, model) => {
      const body = config.body || model || 'dc'
      const allowed = BRIDGE_OPTIONS_BY_BODY[body] || BRIDGE_OPTIONS_BY_BODY.delos
      return Object.entries(BRIDGE_OPTIONS)
        .filter(([key]) => allowed.includes(key))
        .map(([key, opt]) => ({ value: key, label: opt.label, note: opt.note, price: opt.price }))
    },
    options: [
      { value: 'hipshotFixed', label: 'Hipshot Hardtail', note: 'Modern hardtail bridge', price: 45 },
      { value: 'hipshotTremolo', label: 'Hipshot Tremolo', note: 'Six-string tremolo bridge', price: 75 },
      { value: 'floydRoseTremolo', label: 'Floyd Rose Tremolo', note: 'Locking trem bridge', price: 90 },
      { value: 'gotoh', label: 'Gotoh', note: 'Precision Gotoh bridge', price: 85 },
      { value: 'evertune', label: 'Evertune', note: 'Automatic tuning bridge', price: 150 },
    ],
  },
  {
    section: 'Hardware',
    key: 'hardwareColor',
    label: 'Hardware Color',
    type: 'image-select',
    previewResolver: (category, model, value) => getButtonPreview(category, model, 'hardware-color', value),
    condition: (config) => config.bassType !== 'vader',
    options: [
      { value: 'chrome', label: 'Chrome', note: 'Standard bright hardware', price: 0 },
      { value: 'black', label: 'Black', note: 'Stealth hardware', price: 35 },
      { value: 'gold', label: 'Gold', note: 'Premium gold finish', price: 60 },
    ],
  },
  {
    section: 'Hardware',
    key: 'knobs',
    label: 'Knobs',
    type: 'image-select',
    previewResolver: (category, model, value, config) => {
      if (config.body === 'dc') {
        const opt = KNOB_STYLE_OPTIONS[value]
        if (opt?.fileKey) return resolveKnobStyleOverlay(category, model, opt.fileKey)
        return null
      }
      return getButtonPreview(category, model, 'knob', value)
    },
    getOptions: (config, category, model) => {
      if (model === 'dc') {
        return Object.entries(KNOB_STYLE_OPTIONS).map(([value, option]) => ({
          value, label: option.label, note: option.note, price: option.price,
        }))
      }
      return [
        { value: 'black-dome', label: 'Black Dome', note: 'Black dome knobs', price: 0 },
        { value: 'chrome-dome', label: 'Chrome Dome', note: 'Chrome dome knobs', price: 0 },
        { value: 'gold-dome', label: 'Gold Dome', note: 'Gold dome knobs', price: 0 },
        { value: 'black-plastic', label: 'Black Plastic', note: 'Black plastic knobs', price: 10 },
        { value: 'white-plastic', label: 'White Plastic', note: 'White plastic knobs', price: 10 },
        { value: 'tamarind', label: 'Tamarind', note: 'Warm wood-look knobs', price: 15 },
      ]
    },
    condition: (config) => ['dc', 'solo', 'delos'].includes(config.body),
  },
  {
    section: 'Hardware',
    key: 'nut',
    label: 'Nut',
    type: 'select',
    options: [
      { value: 'blackGraphTech', label: 'Black Graph Tech TUSQ Nut', note: 'Black TUSQ nut', price: 25 },
      { value: 'ivoryGraphTech', label: 'Ivory Graph Tech TUSQ Nut', note: 'Ivory TUSQ nut', price: 25 },
    ],
  },
  {
    section: 'Hardware',
    key: 'tuning',
    label: 'Tuning',
    type: 'select',
    disclaimer: TUNING_DISCLAIMER,
    options: [
      { value: 'eStandard', label: 'E Standard (10-46)', note: 'Standard tuning gauge', price: 0 },
      { value: 'dStandard', label: 'D Standard (10-46)', note: 'Down a step', price: 0 },
      { value: 'cStandard', label: 'C Standard (11-56)', note: 'Requires custom nut filing', price: 0 },
      { value: 'dropC', label: 'Drop C (10-52)', note: 'Requires custom nut filing', price: 0 },
      { value: 'dropB', label: 'Drop B (11-56)', note: 'Requires custom nut filing', price: 0 },
    ],
  },
  {
    section: 'Hardware',
    key: 'stringBrand',
    label: 'String Brand',
    type: 'select',
    options: [
      { value: 'elixir1046', label: 'Elixir 1046E', note: 'Standard gauge', price: 0 },
      { value: 'elixir942', label: 'Elixir 942E Super Light Gauge Strings', note: 'Super light gauge', price: 0 },
    ],
  },
  {
    section: 'Hardware',
    key: 'outputJack',
    label: 'Output Jack',
    type: 'toggle',
    options: [
      { value: 'off', label: 'Off', note: 'No output jack shown', price: 0 },
      { value: 'on', label: 'On', note: 'Output jack installed, matches hardware color', price: 0 },
    ],
  },
  {
    section: 'Hardware',
    key: 'strapButtons',
    label: 'Strap Buttons',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    options: [
      { value: 'none', label: 'None', note: 'No strap buttons', price: 0 },
      { value: 'standard', label: 'Standard', note: 'Standard strap buttons', price: 10 },
      { value: 'dunlopStraplocks', label: 'Dunlop Straplocks', note: 'Locking strap buttons', price: 25 },
    ],
  },
  {
    section: 'Hardware',
    key: 'tunerButtons',
    label: 'Tuner Buttons',
    type: 'select',
    options: [
      { value: 'none', label: 'None', note: 'No tuner button style overlay', price: 0 },
      { value: 'whitePearloid', label: 'White Pearloid', note: 'Pearloid tuner buttons', price: 15 },
      { value: 'black', label: 'Black', note: 'Black tuner buttons', price: 0 },
    ],
  },
  {
    section: 'Hardware',
    key: 'electronicsCavityCover',
    label: 'Electronics Cavity Cover',
    type: 'select',
    condition: (config) => config.bassType !== 'vader',
    options: [
      { value: 'black', label: 'Black', note: 'Default cover, includes backplate screws', price: 0 },
      { value: 'ebony', label: 'Ebony', note: 'Ebony cover, includes backplate screws', price: 15 },
    ],
  },
  {
    section: 'Hardware',
    key: 'tremoloCover',
    label: 'Tremolo Cover',
    type: 'image-select',
    condition: (config) => config.bridge === 'hipshotTremolo' || config.bridge === 'floydRoseTremolo',
    previewResolver: (category, model, value, config) => {
      const byBridge = TREMOLO_COVER_OPTIONS_BY_BRIDGE[config.bridge]
      const opt = byBridge?.[value]
      if (!opt?.fileKey) return null
      return resolveTremoloCoverAsset(category, model, opt.fileKey)
    },
    getOptions: (config) => {
      const byBridge = TREMOLO_COVER_OPTIONS_BY_BRIDGE[config.bridge]
      if (!byBridge) return []
      return Object.entries(byBridge).map(([value, option]) => ({
        value, label: option.label, note: option.note, price: option.price,
      }))
    },
    options: [
      { value: 'none', label: 'None', note: 'No tremolo cover', price: 0 },
    ],
  },
]

// ============================================================
// HELPER: Get options for a field (supports dynamic getOptions)
// ============================================================

export function getFieldOptions(field, config, category, model) {
  if (typeof field.getOptions === 'function') {
    return field.getOptions(config, category, model)
  }
  return field.options || []
}

// ============================================================
// HELPER: Check if a field should be visible
// ============================================================

export function isFieldVisible(field, config) {
  if (!field.condition) return true
  return field.condition(config)
}

// ============================================================
// HELPER: Get fields by section
// ============================================================

export function getFieldsBySection(section) {
  return OPTION_FIELDS.filter(f => f.section === section)
}

// ============================================================
// HELPER: Build default config for a category/model
// ============================================================

export function getDefaultConfig(category, model) {
  const catData = CATEGORIES[category]
  if (!catData) return {}
  
  if (model && catData.models[model]) {
    return { ...catData.models[model].defaultConfig }
  }
  
  // Build from fields if no model-specific default
  const defaults = {}
  OPTION_FIELDS.forEach(field => {
    if (field.options && field.options.length > 0) {
      defaults[field.key] = field.options[0].value
    }
  })
  return defaults
}

// ============================================================
// HELPER: Get model label
// ============================================================

export function getModelLabel(category, model) {
  return CATEGORIES[category]?.models[model]?.label || model
}

export function getCategoryLabel(category) {
  return CATEGORIES[category]?.label || category
}

export default {
  CATEGORIES,
  OPTION_FIELDS,
  getFieldOptions,
  isFieldVisible,
  getFieldsBySection,
  getDefaultConfig,
  getModelLabel,
  getCategoryLabel,
}