const assert = require('assert');
const { buildElectricCustomizeSeedPayloads } = require('../services/builderPartsService');

const sampleModule = {
  BODY_OPTIONS: { dc: { label: 'DC', price: 180 } },
  BODY_WOOD_OPTIONS: { maple: { label: 'Maple', price: 0 } },
  BODY_FINISH_OPTIONS: { black: { label: 'Black', price: 25 } },
  NECK_OPTIONS: { maple: { label: 'Maple', price: 0 } },
  FRETBOARD_OPTIONS: { rosewood: { label: 'Rosewood', price: 60 } },
  HEADSTOCK_OPTIONS: { gt6: { label: 'GT6', price: 0 } },
  HEADSTOCK_WOOD_OPTIONS: { rosewood: { label: 'Rosewood', price: 0 } },
  INLAY_OPTIONS: { pearl: { label: 'Pearl', price: 0 } },
  BRIDGE_OPTIONS: { hipshotFixed: { label: 'Hipshot Fixed', price: 0 } },
  PICKGUARD_OPTIONS_BY_BODY: { dc: { none: { label: 'None', price: 0 } } },
  KNOB_OPTIONS_BY_BODY: { dc: { black: { label: 'Black', price: 0 } } },
  HARDWARE_OPTIONS: { chrome: { label: 'Chrome', price: 0 } },
  PICKUP_OPTIONS: { hss: { label: 'HSS', price: 0 } },
  DEXTERITY_OPTIONS: { right: { label: 'Right Handed', price: 0 } },
  STRING_COUNT_OPTIONS: { '6': { label: '6 Strings', price: 0 } },
  MULTISCALE_OPTIONS: { off: { label: 'Off', price: 0 } },
  SCALE_LENGTH_OPTIONS: { '25.5': { label: '25.5"', price: 0 } },
  CASE_OPTIONS: { none: { label: 'No Case', price: 0 } },
  BEVEL_OPTIONS: { off: { label: 'Off', price: 0 } },
  TOP_WOOD_OPTIONS: { none: { label: 'None', price: 0 } },
  FINISH_TYPE_OPTIONS: { metallic: { label: 'Metallic', price: 35 } },
  TOP_COAT_OPTIONS: { clearGloss: { label: 'Clear Gloss', price: 0 } },
  BURST_FINISH_OPTIONS: { none: { label: 'None', price: 0 } },
  NECK_CONSTRUCTION_OPTIONS: { '1piece': { label: '1-Piece', price: 0 } },
  FRET_OPTIONS: { regularNickel: { label: 'Regular Nickel', price: 0 } },
  NECK_REAR_FINISH_OPTIONS: { none: { label: 'None', price: 0 } },
  HEADSTOCK_SHAPE_OPTIONS: { inlineGT: { label: 'Inline GT', price: 0 } },
  TRUSS_ROD_COVER_OPTIONS: { black: { label: 'Black', price: 0 } },
  ELECTRONICS_TYPE_OPTIONS: { passive: { label: 'Passive', price: 0 } },
  PICKUP_CONFIGURATION_OPTIONS: { hss: { label: 'HSS', price: 0 } },
  PICKUP_MODEL_BRIDGE_OPTIONS: { beryllium: { label: 'Beryllium', price: 0 } },
  PICKUP_MODEL_MIDDLE_OPTIONS: { none: { label: 'None', price: 0 } },
  PICKUP_MODEL_NECK_OPTIONS: { beryllium: { label: 'Beryllium', price: 0 } },
  PICKUP_BOBBIN_OPTIONS: { standard: { label: 'Standard', price: 0 } },
  PICKUP_POLE_COLOR_OPTIONS: { black: { label: 'Black', price: 0 } },
  CONTROLS_OPTIONS: { standard: { label: 'Standard', price: 0 } },
  SADDLE_OPTIONS: { chrome: { label: 'Chrome', price: 0 } },
  NUT_OPTIONS: { blackGraphTech: { label: 'Black Graph Tech TUSQ', price: 25 } },
  TUNING_OPTIONS: { eStandard: { label: 'E Standard', price: 0 } },
  STRING_BRAND_OPTIONS: { elixir1046: { label: 'Elixir 10-46', price: 0 } },
  OUTPUT_JACK_OPTIONS: { none: { label: 'None', price: 0 } },
  STRAP_BUTTON_OPTIONS: { off: { label: 'Off', price: 0 } },
  TUNER_BUTTON_OPTIONS: { off: { label: 'Off', price: 0 } },
  ELECTRONICS_CAVITY_COVER_OPTIONS: { none: { label: 'None', price: 0 } },
  TREMOLO_COVER_OPTIONS: { none: { label: 'None', price: 0 } },
};

const payloads = buildElectricCustomizeSeedPayloads('guitarBuilderData', sampleModule);
const dexterityPayload = payloads.find((entry) => entry.type_mapping === 'dexterity');
const topWoodPayload = payloads.find((entry) => entry.type_mapping === 'topWood');
const outputJackPayload = payloads.find((entry) => entry.type_mapping === 'outputJack');

assert.ok(dexterityPayload, 'Expected dexterity catalog payloads to be generated');
assert.strictEqual(dexterityPayload.metadata.option_key, 'right');
assert.ok(topWoodPayload, 'Expected top wood catalog payloads to be generated');
assert.strictEqual(topWoodPayload.metadata.option_key, 'none');
assert.ok(outputJackPayload, 'Expected output jack catalog payloads to be generated');
assert.strictEqual(outputJackPayload.metadata.option_key, 'none');

console.log(`Verified ${payloads.length} electric builder catalog payloads`);
