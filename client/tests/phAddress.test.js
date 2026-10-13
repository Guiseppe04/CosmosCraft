import assert from 'node:assert/strict'
import { test } from 'node:test'
import { regions, provinces, cities, regionOf, provinceOf, barangaysFor, resolveSavedLocation } from '../src/app/utils/phAddress.js'
import { getAllBarangays } from '@aivangogh/ph-address'

test('every region, province, city and barangay has a valid unique PSGC mapping', () => {
  assert.equal(regions.length, 18);
  const regionCodes = new Set(regions.map(r => r.psgcCode));
  for (const province of provinces) assert.ok(regionCodes.has(province.regionCode), province.name);
  const all = [];
  for (const city of cities) {
    assert.ok(regionCodes.has(regionOf(city)), city.name);
    const parent = provinceOf(city);
    if (parent) assert.equal(provinces.find(p => p.psgcCode === parent).regionCode, regionOf(city));
    all.push(...barangaysFor(city.psgcCode));
  }
  assert.equal(all.length, getAllBarangays().length);
  assert.equal(new Set(all.map(b => b.psgcCode)).size, all.length);
});
test('legacy names and codes hydrate the right region without confusing Quezon City with Quezon', () => {
  for (const province of [null, '', 'Metro Manila']) {
    const location = resolveSavedLocation({ province, city: 'Quezon City', barangay: 'Batasan Hills' });
    assert.equal(location.city, '1381300000'); assert.equal(location.region, '1300000000'); assert.equal(location.province, '');
  }
  const bulacan = resolveSavedLocation({ province: 'Bulacan', city: 'Malolos City', barangay: 'Longos' });
  assert.equal(bulacan.region, '0300000000'); assert.equal(bulacan.province, '0301400000');
});
