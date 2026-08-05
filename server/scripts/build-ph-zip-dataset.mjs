import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const baseCore = path.join(__dirname, '..', '..', 'node_modules', '@ph-dev-utils', 'core', 'data');
const baseAddr = path.join(__dirname, '..', '..', 'node_modules', 'ph-addresses-locations', 'data');
const basePostal = path.join(__dirname, '..', '..', 'node_modules', '@ph-dev-utils', 'postal', 'data');

const libDump = path.join(__dirname, '..', '..', 'client', 'dump-municipalities.json');
const outputPath = path.join(__dirname, '..', 'data', 'ph-zip-codes.json');

const libMunis = JSON.parse(fs.readFileSync(libDump, 'utf8'));
const coreCities = JSON.parse(fs.readFileSync(baseCore + '/psgc-cities-municipalities-2024.json', 'utf8')).cities_municipalities;
const provinces = JSON.parse(fs.readFileSync(baseCore + '/provinces.json', 'utf8'));
const postal = JSON.parse(fs.readFileSync(basePostal + '/postal-codes-2024.json', 'utf8')).postal_codes;
const addrCities = JSON.parse(fs.readFileSync(baseAddr + '/cities.json', 'utf8'));

const provByCode = new Map(provinces.map(p => [p.code, p]));
const libByCode = new Map(libMunis.map(m => [m.cityCode, m]));
const coreByCode6 = new Map();
for (const c of coreCities) { if (c.province && c.code) coreByCode6.set(c.code, c); }

function coreToLibCityCode(code6, prov4) {
  if (!prov4) return null;
  const region = prov4.slice(0, 2);
  const provNum = parseInt(prov4.slice(2, 4), 10);
  const prov3 = String(provNum).padStart(3, '0');
  const city2 = code6.slice(4, 6);
  return region + prov3 + city2 + '000';
}
const normCity = (s) => {
  let t = String(s || '').toLowerCase();
  t = t.replace(/doña/g, 'dona').replace(/ñ/g, 'n');
  t = t.replace(/\bsta\./g, 'santa').replace(/\bst\./g, 'saint').replace(/\bgen\./g, 'general');
  t = t.replace(/\bsto\./g, 'santo').replace(/\bst\.\s/g, 'saint ');
  t = t.replace(/\bcity of\b/g, '').replace(/\bof\b/g, '');
  t = t.replace(/\bcity\b/g, '');
  t = t.replace(/[^a-z0-9]/g, '');
  return t;
};
const normProv = (s) => {
  let t = String(s || '').toLowerCase();
  t = t.replace(/doña/g, 'dona').replace(/ñ/g, 'n');
  t = t.replace(/[^a-z0-9]/g, '');
  return t;
};

const cityZips = new Map();
function addZip(cityCode, zip) {
  const z = String(zip || '').trim();
  if (!cityCode || !z || !/^\d{3,6}$/.test(z)) return;
  let s = cityZips.get(cityCode); if (!s) { s = new Set(); cityZips.set(cityCode, s); } s.add(z);
}

let codeMatched = 0;
for (const p of postal) {
  if (!p.cityMunCode) continue;
  const core = coreByCode6.get(p.cityMunCode);
  if (!core) continue;
  const libCode = coreToLibCityCode(core.code, core.province);
  if (!libCode) continue;
  if (libByCode.get(libCode)) { addZip(libCode, p.zip); codeMatched++; }
}

let bMatched = 0;
for (const c of addrCities) {
  const lib = libByCode.get(c.code);
  if (!lib) continue;
  bMatched++;
  addZip(c.code, c.zipCode);
}

function postalProvinceName(p) {
  if (!p.province) return null;
  const pr = provByCode.get(p.province);
  return pr ? pr.name : null;
}
const libByProvCity = new Map();
for (const m of libMunis) {
  const key = normProv(m.province) + '|' + normCity(m.city);
  if (!libByProvCity.has(key)) libByProvCity.set(key, []);
  libByProvCity.get(key).push(m);
}
let nameMatched = 0, nameAmbiguous = 0;
for (const p of postal) {
  const pn = postalProvinceName(p);
  if (!pn) continue;
  const key = normProv(pn) + '|' + normCity(p.cityMun);
  const cand = libByProvCity.get(key);
  if (!cand || cand.length === 0) continue;
  if (cand.length > 1) { nameAmbiguous++; continue; }
  addZip(cand[0].cityCode, p.zip);
  nameMatched++;
}

// Override table for known source-data errors (verified against PHLPost, PhilAtlas)
const ZIP_OVERRIDES = {
  '0402122000': ['4109'],
};

const citiesOut = [];
for (const m of libMunis) {
  const zips = cityZips.get(m.cityCode);
  const zipArr = zips ? [...zips] : [];
  citiesOut.push({ code: m.cityCode, provinceCode: m.provinceCode, province: m.province, city: m.city, zips: zipArr });
}

const appliedOverrides = [];
for (const [code, zips] of Object.entries(ZIP_OVERRIDES)) {
  const idx = citiesOut.findIndex(c => c.code === code);
  if (idx >= 0) {
    const old = citiesOut[idx].zips;
    citiesOut[idx].zips = zips;
    appliedOverrides.push({ code, city: citiesOut[idx].city, province: citiesOut[idx].province, oldZips: old, newZips: zips });
  }
}
if (appliedOverrides.length) {
  console.log('Applied zip overrides:', JSON.stringify(appliedOverrides, null, 2));
}

const byZip = {};
for (const city of citiesOut) {
  for (const z of city.zips) {
    if (!byZip[z]) byZip[z] = [];
    byZip[z].push({ code: city.code, provinceCode: city.provinceCode, province: city.province, city: city.city });
  }
}

const withZip = citiesOut.filter(c => c.zips.length > 0).length;
console.log('postal entries:', postal.length);
console.log('code-matched adds:', codeMatched, '| addr-matched:', bMatched, '| name-matched adds:', nameMatched, '| name-ambiguous skipped:', nameAmbiguous);
console.log('library cities total:', citiesOut.length, '| WITH zip:', withZip, '| WITHOUT:', citiesOut.length - withZip, '(' + (100 * (citiesOut.length - withZip) / citiesOut.length).toFixed(1) + '%)');
console.log('distinct zips:', Object.keys(byZip).length);

fs.writeFileSync(outputPath, JSON.stringify({ cities: citiesOut, byZip, meta: { sources: ['@aivangogh/ph-address (PSGC 10-digit codes)', '@ph-dev-utils/postal & core (GeoNames/PHLPost)', 'ph-addresses-locations'], overrides: appliedOverrides } }));
console.log('WROTE ph-zip-codes.json to:', outputPath);
