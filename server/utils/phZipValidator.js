const fs = require('fs');
const path = require('path');
const { getMunicipalityByCode, getProvinceByCode, getPostalCodesByMunicipality, getAllPostalCodes } = require('@aivangogh/ph-address');

let _dataset = null;
let _loadError = null;

function loadDataset() {
  if (_dataset !== null) return _dataset;
  if (_loadError) throw _loadError;

  try {
    const dataPath = path.join(__dirname, '..', 'data', 'ph-zip-codes.json');
    const raw = fs.readFileSync(dataPath, 'utf8');
    _dataset = JSON.parse(raw);
    return _dataset;
  } catch (err) {
    _loadError = err;
    throw err;
  }
}

function getCities() {
  const ds = loadDataset();
  return ds.cities;
}

function getByZip() {
  const ds = loadDataset();
  return ds.byZip;
}

function getMeta() {
  const ds = loadDataset();
  return ds.meta;
}

/**
 * Normalize a zip code string for comparison.
 * - Trims whitespace
 * Internal spaces, hyphens and missing digits remain invalid.
 */
function normalizeZipCode(zipCode) {
  if (zipCode == null) return '';
  return String(zipCode).trim();
}

/**
 * Validate that a zip code string matches the expected Philippine format.
 * Requires exactly four digits.
 */
function isValidFormat(zipCode) {
  const normalized = normalizeZipCode(zipCode);
  return /^\d{4}$/.test(normalized);
}

// These district records exist in the postal supplement but have no city code.
// Map only their documented district/code groups; never accept arbitrary digits.
function supplementalZips(cityCode) {
  const districtGroups = {
    '1380600000': ['Capital District', '10'],
    '1381300000': ['Eastern Manila District', '11'],
    '1381400000': ['Eastern Manila District', '150'],
  };
  const group = districtGroups[String(cityCode)];
  return [...new Set([
    ...getPostalCodesByMunicipality(String(cityCode)).map(p => p.postalCode),
    ...(group ? getAllPostalCodes().filter(p => !p.municipalityCode && p.regionName === 'Metro Manila'
      && p.provinceName === group[0] && p.postalCode.startsWith(group[1])).map(p => p.postalCode) : []),
  ])];
}

/**
 * Get all valid zip codes for a given city (10-digit PSGC code).
 * @param {string} cityCode - 10-digit PSGC city/municipality code
 * @returns {string[]|null} Array of valid zip codes, or null if city not found
 */
function getValidZipCodes(cityCode) {
  if (!cityCode) return null;
  const city = getCityByCode(cityCode);
  if (!city) return null;
  return city.zips.length > 0 ? [...city.zips] : null;
}

/**
 * Get city info by 10-digit PSGC code.
 * @param {string} cityCode - 10-digit PSGC city/municipality code
 * @returns {{code:string,city:string,province:string,provinceCode:string,zips:string[]}|null}
 */
function getCityByCode(cityCode) {
  if (!cityCode) return null;
  const cities = getCities();
  const city = cities.find(c => c.code === String(cityCode));
  if (!city) {
    const location = getMunicipalityByCode(String(cityCode));
    if (!location) return null;
    return {
      code: location.psgcCode, city: location.name,
      province: getProvinceByCode(location.provinceCode)?.name || '',
      provinceCode: location.provinceCode,
      zips: supplementalZips(location.psgcCode),
    };
  }
  return {
    code: city.code,
    city: city.city,
    province: city.province,
    provinceCode: city.provinceCode,
    zips: city.zips.length > 0 ? [...city.zips] : [],
  };
}

/**
 * Get city info by zip code (reverse lookup).
 * If multiple cities share a zip, the first is returned with all matches.
 * @param {string} zipCode - 4-digit Philippine zip code
 * @returns {{zip:string,cities:Array|null}}
 */
function getCitiesByZipCode(zipCode) {
  const normalized = normalizeZipCode(zipCode);
  if (!isValidFormat(normalized)) return { zip: normalized, cities: null };

  const byZip = getByZip();
  const matches = byZip[normalized];
  if (!matches || matches.length === 0) {
    return { zip: normalized, cities: [] };
  }
  return { zip: normalized, cities: matches };
}

/**
 * Validate a zip code against a city's known zip codes.
 * @param {string} cityCode - 10-digit PSGC city/municipality code
 * @param {string} zipCode - User-entered zip code
 * @returns {{valid:boolean, message:string, city?:object, zips?:string[]}}
 */
function validateZipCode(cityCode, zipCode) {
  if (!cityCode) {
    return { valid: false, message: 'No city selected.' };
  }

  const normalized = normalizeZipCode(zipCode);

  if (!normalized) {
    return { valid: false, message: 'Zip code is required.' };
  }

  if (!isValidFormat(normalized)) {
    return {
      valid: false,
      message: 'Philippine ZIP code must contain exactly four digits.',
    };
  }

  const city = getCityByCode(cityCode);
  if (!city) {
    return { valid: false, message: 'Selected city is not recognized.' };
  }

  if (city.zips.length === 0) {
    return {
      valid: false,
      message: 'Zip code data is not available for the selected city. Please try another location.',
      city: { code: city.code, city: city.city, province: city.province },
    };
  }

  const isValid = city.zips.includes(normalized);

  return {
    valid: isValid,
    message: isValid
      ? 'Zip code is valid for the selected city.'
      : `Invalid ZIP Code. The ZIP code does not match the selected Municipality/City (${city.city}, ${city.province}).`,
    city: { code: city.code, city: city.city, province: city.province },
    zips: [...city.zips],
  };
}

/**
 * Validate a zip code without a city context (general format + existence check).
 * @param {string} zipCode
 * @returns {{valid:boolean, message:string, exists:boolean}}
 */
function validateZipCodeGeneral(zipCode) {
  const normalized = normalizeZipCode(zipCode);

  if (!normalized) {
    return { valid: false, exists: false, message: 'Zip code is required.' };
  }

  if (!isValidFormat(normalized)) {
    return { valid: false, exists: false, message: 'Philippine ZIP code must contain exactly four digits.' };
  }

  const byZip = getByZip();
  const exists = Boolean(byZip[normalized]) || getAllPostalCodes().some(p => p.postalCode === normalized);

  return {
    valid: exists,
    exists,
    message: exists
      ? 'Zip code is valid.'
      : `Zip code ${normalized} is not recognized.`,
  };
}

function getDatasetInfo() {
  const ds = loadDataset();
  return {
    totalCities: ds.cities.length,
    citiesWithZip: ds.cities.filter(c => c.zips.length > 0).length,
    citiesWithoutZip: ds.cities.filter(c => c.zips.length === 0).length,
    distinctZips: Object.keys(ds.byZip).length,
    sources: ds.meta?.sources || [],
    overrides: ds.meta?.overrides || [],
  };
}

module.exports = {
  loadDataset,
  getCities,
  getByZip,
  getMeta,
  normalizeZipCode,
  isValidFormat,
  getValidZipCodes,
  getCityByCode,
  getCitiesByZipCode,
  validateZipCode,
  validateZipCodeGeneral,
  getDatasetInfo,
};
