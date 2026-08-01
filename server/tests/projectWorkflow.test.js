const assert = require('assert');
const path = require('path');

const projectServiceModulePath = path.resolve(__dirname, '../services/projectService.js');
const projectService = require(projectServiceModulePath);

const buildRequiredPartsPayload = projectService.__testOnlyBuildRequiredPartsPayload;
const getProjectPartReceiptState = projectService.__testOnlyGetProjectPartReceiptState;

if (!buildRequiredPartsPayload) {
  throw new Error('Expected projectService to expose __testOnlyBuildRequiredPartsPayload');
}

if (!getProjectPartReceiptState) {
  throw new Error('Expected projectService to expose __testOnlyGetProjectPartReceiptState');
}

const sampleCustomization = {
  customization_id: '11111111-1111-1111-1111-111111111111',
  guitar_type: 'electric',
  body_wood: 'Rosewood',
  neck_wood: 'Maple',
  fingerboard_wood: 'Ebony',
  bridge_type: 'Fixed',
  pickups: 'HSS',
  color: 'Black',
  finish_type: 'Gloss',
};

const sampleParts = [
  {
    part_id: '22222222-2222-2222-2222-222222222222',
    part_name: 'Pickguard',
    quantity: 2,
    price: 250,
    product_id: '33333333-3333-3333-3333-333333333333',
    stock: 0,
    is_active: true,
  },
];

const payload = buildRequiredPartsPayload(sampleCustomization, sampleParts);
assert.ok(Array.isArray(payload), 'expected an array of required parts');
const configPart = payload.find((part) => part.source === 'configuration');
const additionalPart = payload.find((part) => part.source === 'additional_parts');
assert.ok(configPart, 'expected a configuration-sourced part');
assert.strictEqual(configPart.category, 'body');
assert.strictEqual(configPart.name, 'Rosewood');
assert.ok(additionalPart, 'expected an additional-parts entry');
assert.strictEqual(additionalPart.category, 'additional_parts');
assert.strictEqual(additionalPart.name, 'Pickguard');
assert.strictEqual(additionalPart.stock_status, 'out_of_stock');
assert.strictEqual(additionalPart.needs_purchase, true);
assert.strictEqual(additionalPart.is_received, false);
assert.strictEqual(additionalPart.received_quantity, 0);
assert.strictEqual(additionalPart.pending_quantity, 2);
assert.strictEqual(additionalPart.is_fully_received, false);
assert.ok(additionalPart.part_key.includes('additional_parts'));

const receiptState = getProjectPartReceiptState([
  {
    details: {
      event: 'project_part_received',
      part_key: 'additional_parts-pickguard',
      received_quantity: 2,
      received_at: '2024-01-01T00:00:00.000Z',
      received_by: 'user-1',
      supplier: 'Acme Parts',
    },
  },
  {
    details: {
      event: 'project_ready_for_assembly',
      status: 'in_progress',
    },
  },
]);

assert.ok(receiptState.has('additional_parts-pickguard'), 'expected receipt state for the received part');
assert.strictEqual(receiptState.get('additional_parts-pickguard').received_quantity, 2);
assert.strictEqual(receiptState.get('additional_parts-pickguard').supplier, 'Acme Parts');
console.log('project workflow test passed');
