const test = require('node:test');
const assert = require('node:assert/strict');
const { addAddressSchema, updateAddressSchema, createOrderSchema } = require('../utils/validation');
const { normalizeShippingAddress, barangaysFor } = require('../utils/phAddress');
const geo = require('@aivangogh/ph-address');
const base = { streetLine1: '123 Example Street', city: 'Quezon City', barangay: 'Batasan Hills', postalZipCode: '1126', country: 'PH' };
test('NCR saves without province, accepts null/empty, and normalizes legacy Metro Manila', () => {
  for (const stateProvince of [undefined, null, '', 'Metro Manila']) {
    const result = addAddressSchema.validate({ ...base, stateProvince });
    assert.ifError(result.error); assert.equal(result.value.stateProvince, null); assert.equal(result.value.country, 'PH');
  }
});
test('province cities require correct province, region and barangay', () => {
  const bulacan = { ...base, city: 'Malolos City', stateProvince: 'Bulacan', barangay: 'Longos', regionCode: '0300000000' };
  assert.ifError(addAddressSchema.validate(bulacan).error);
  for (const patch of [{ stateProvince: null }, { stateProvince: 'Cebu' }, { regionCode: '1300000000' }, { barangay: 'Batasan Hills' }, { country: 'US' }]) assert.ok(addAddressSchema.validate({ ...bulacan, ...patch }).error);
  assert.ok(addAddressSchema.validate({ ...base, stateProvince: 'Bulacan' }).error);
});
test('all 16 NCR cities and Pateros have accessible barangays including Manila districts', () => {
  const ncr = geo.getAllMunicipalities().filter(c => c.provinceCode === '1300000000');
  assert.equal(ncr.length, 17); assert.ok(ncr.some(c => c.name === 'Pateros'));
  for (const city of ncr) {
    const barangays = barangaysFor(city.psgcCode); assert.ok(barangays.length, city.name);
    const result = addAddressSchema.validate({ ...base, city: city.name, barangay: barangays[0].name });
    assert.ifError(result.error); assert.equal(result.value.stateProvince, null);
  }
  assert.equal(barangaysFor('1380600000').length, geo.getAllBarangays().filter(b => b.municipalCityCode.startsWith('13806')).length);
});
test('special administrative locations save without invented provinces', () => {
  for (const name of ['Baguio City', 'Isabela City', 'Cotabato City']) {
    const city = geo.getAllMunicipalities().find(c => c.name === name);
    const result = addAddressSchema.validate({ ...base, city: name, barangay: barangaysFor(city.psgcCode)[0].name });
    assert.ifError(result.error); assert.equal(result.value.stateProvince, null);
  }
});
test('partial update schema accepts clearing province, merged validation rejects incomplete hierarchy', () => {
  assert.ifError(updateAddressSchema.validate({ stateProvince: null }).error);
  assert.throws(() => normalizeShippingAddress({ ...base, city: 'Malolos City', stateProvince: null }));
  assert.equal(normalizeShippingAddress({ ...base, stateProvince: null }).stateProvince, null);
});
test('order billing address accepts NCR without province and rejects mismatched barangay', () => {
  const schema = createOrderSchema.extract('billingAddress');
  const address = { street: base.streetLine1, city: base.city, barangay: base.barangay, postalCode: base.postalZipCode, country: 'PH', stateProvince: null };
  assert.ifError(schema.validate(address).error);
  assert.ok(schema.validate({ ...address, barangay: 'Longos' }).error);
});
test('migration is idempotent and stores NCR null provinces without altering existing rows', async () => {
  const { PGlite } = require('@electric-sql/pglite');
  const fs = require('node:fs'); const path = require('node:path'); const db = new PGlite();
  try {
    await db.exec("CREATE TABLE addresses (city text, province varchar(80) NOT NULL); INSERT INTO addresses VALUES ('Malolos City', 'Bulacan');");
    const sql = fs.readFileSync(path.join(__dirname, '../migrations/45_shipping_address_nullable_province.sql'), 'utf8');
    await db.exec(sql); await db.exec(sql); await db.query('INSERT INTO addresses VALUES ($1, $2)', ['Quezon City', null]);
    assert.deepEqual((await db.query('SELECT * FROM addresses ORDER BY city')).rows, [{ city: 'Malolos City', province: 'Bulacan' }, { city: 'Quezon City', province: null }]);
  } finally { await db.close(); }
});

test('NCR postal coverage accepts district ZIPs while keeping strict checks for covered cities', () => {
  const { validateZipCode } = require('../utils/phZipValidator');
  assert.equal(validateZipCode('1381300000', '1126').valid, true);
  assert.equal(validateZipCode('1381300000', 'abc').valid, false);
  assert.equal(validateZipCode('0301410000', '3000').valid, true);
  assert.equal(validateZipCode('0301410000', '1126').valid, false);
});

test('signup primary shipping address follows the same NCR hierarchy', () => {
  const { emailSignupSchema } = require('../utils/validation');
  const address = { ...base, stateProvince: null, regionCode: '1300000000', addressLocationCityCode: '1381300000', stateAddressProvinceCode: '' };
  assert.ifError(emailSignupSchema.extract('address').validate(address).error);
  assert.ok(emailSignupSchema.extract('address').validate({ ...address, addressLocationCityCode: '1381701000' }).error);
});
