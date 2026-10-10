const { getAllProvinces, getAllMunicipalities, getBarangaysByMunicipality } = require('@aivangogh/ph-address');
const provinces = getAllProvinces();
const allCities = getAllMunicipalities();
const cities = allCities.filter(c => c.provinceCode !== '1380600000');
const provinceCodes = new Set(provinces.map(p => p.psgcCode));
const cityProvince = c => c.psgcCode !== '1908703000' && provinceCodes.has(c.provinceCode) ? c.provinceCode : '';
const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim();
const matches = (item, value) => item.psgcCode === value || normalize(item.name) === normalize(value);
function barangaysFor(code) {
  const codes = code === '1380600000' ? allCities.filter(c => c.provinceCode === code).map(c => c.psgcCode) : [code];
  return codes.flatMap(getBarangaysByMunicipality);
}
function normalizeShippingAddress(address) {
  const provinceValue = address.stateProvince ?? address.province;
  const province = provinces.find(p => matches(p, provinceValue));
  const candidates = cities.filter(c => matches(c, address.city) && (province ? cityProvince(c) === province.psgcCode : !cityProvince(c)));
  const city = candidates.find(c => barangaysFor(c.psgcCode).some(b => matches(b, address.barangay))) || candidates[0];
  if (!city) throw new Error('Select a valid city and its province. Province is required for cities belonging to a province.');
  const requiresProvince = Boolean(cityProvince(city));
  if (!requiresProvince && provinceValue && !/^(metro manila|national capital region( \(ncr\))?|ncr)$/i.test(String(provinceValue).trim())) {
    throw new Error('The selected city does not belong to the selected province.');
  }
  if (address.addressLocationCityCode && address.addressLocationCityCode !== city.psgcCode) throw new Error('City name and PSGC code do not match.');
  if (address.regionCode && address.regionCode !== city.psgcCode.slice(0, 2) + '00000000') throw new Error('The selected city does not belong to the selected region.');
  const barangay = barangaysFor(city.psgcCode).find(b => matches(b, address.barangay));
  if (!barangay) throw new Error('Select a barangay belonging to the selected city.');
  if (address.country && address.country !== 'PH') throw new Error('Shipping country must be Philippines.');
  return { ...address, city: city.name, stateProvince: requiresProvince ? province.name : null, barangay: barangay.name, country: 'PH' };
}
function validateShippingAddress(value, helpers) {
  try { return normalizeShippingAddress(value); } catch (error) { return helpers.message({ custom: error.message }); }
}
module.exports = { normalizeShippingAddress, validateShippingAddress, barangaysFor };
