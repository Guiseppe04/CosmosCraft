const a = require('@aivangogh/ph-address');

const regions = a.getAllRegions();
const provinces = a.getAllProvinces();

// Build a lookup of municipality psgcCode -> {name, provinceCode}
const all = [];
for (const prov of provinces) {
  const munis = a.getMunicipalitiesByProvince(prov.psgcCode);
  for (const m of munis) {
    all.push({
      city: m.name,
      cityCode: m.psgcCode,
      province: prov.name,
      provinceCode: prov.psgcCode,
      regionCode: prov.regionCode,
    });
  }
}

// Write province list and municipality list
const fs = require('fs');
fs.writeFileSync('dump-provinces.json', JSON.stringify(provinces, null, 0));
fs.writeFileSync('dump-municipalities.json', JSON.stringify(all, null, 0));
console.log('regions', regions.length);
console.log('provinces', provinces.length);
console.log('municipalities+cities', all.length);
// Show a few examples for Bulacan and Pampanga
const show = all.filter(x => x.province === 'Bulacan' || x.province === 'Pampanga');
console.log(JSON.stringify(show.slice(0, 20), null, 2));
