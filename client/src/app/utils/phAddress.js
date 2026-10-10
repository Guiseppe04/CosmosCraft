import { getAllRegions, getAllProvinces, getAllMunicipalities, getBarangaysByMunicipality } from '@aivangogh/ph-address'

export const regions = getAllRegions()
export const provinces = getAllProvinces()
const allCities = getAllMunicipalities()
const provinceCodes = new Set(provinces.map(p => p.psgcCode))
export const cities = allCities.filter(c => c.provinceCode !== '1380600000')
export const regionOf = city => city?.psgcCode.slice(0, 2) + '00000000'
// Cotabato City is an independent component city despite its geographic province code.
export const provinceOf = city => city?.psgcCode !== '1908703000' && provinceCodes.has(city?.provinceCode) ? city.provinceCode : ''
export const matchLocation = (items, value) => {
  const normalize = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^city of /, '').replace(/ city$/, '').trim()
  const exact = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  return items.find(item => item.psgcCode === value || exact(item.name) === exact(value))
    || items.find(item => normalize(item.name) === normalize(value))
}
export const provincesInRegion = region => provinces.filter(p => p.regionCode === region)
export const citiesFor = (region, province = '') => cities.filter(c => regionOf(c) === region && provinceOf(c) === province)
export const barangaysFor = code => {
  const codes = code === '1380600000' ? allCities.filter(c => c.provinceCode === code).map(c => c.psgcCode) : [code]
  return codes.flatMap(getBarangaysByMunicipality).sort((a, b) => a.name.localeCompare(b.name))
}
export function resolveSavedLocation(address = {}) {
  const province = matchLocation(provinces, address.stateProvince ?? address.province)
  const candidates = province ? cities.filter(c => provinceOf(c) === province.psgcCode) : cities
  const city = matchLocation(candidates, address.city) || matchLocation(cities.filter(c => !provinceOf(c)), address.city)
  const region = city ? regionOf(city) : province?.regionCode || ''
  const barangay = city && matchLocation(barangaysFor(city.psgcCode), address.barangay)
  return { region, province: city ? provinceOf(city) : province?.psgcCode || '', city: city?.psgcCode || '', barangay: barangay?.psgcCode || '' }
}
