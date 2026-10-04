import Holidays from 'date-holidays'

const calendar = new Holidays('PH')
const cache = new Map()

export function getHolidaysForYear(year) {
  if (!cache.has(year)) {
    const map = {}
    for (const holiday of calendar.getHolidays(year)) {
      // Observances are commemorations, rather than shop closure days.
      if (!['public', 'bank', 'optional'].includes(holiday.type)) continue
      const key = String(holiday.date).slice(0, 10)
      map[key] ||= holiday.name
    }
    cache.set(year, map)
  }
  return cache.get(year)
}

export function getCalendarHolidays(years, extraDates = [], openOverrides = []) {
  const labels = Object.assign({}, ...years.map(getHolidaysForYear))
  const normalize = (entry) => {
    if (typeof entry === 'string') return entry.slice(0, 10)
    if (entry?.date) return normalize(entry.date)
    if (entry instanceof Date) {
      return `${entry.getFullYear()}-${String(entry.getMonth() + 1).padStart(2, '0')}-${String(entry.getDate()).padStart(2, '0')}`
    }
    return null
  }
  for (const entry of extraDates) {
    const key = normalize(entry)
    if (key) labels[key] ||= entry?.name || 'Holiday'
  }
  const closedDates = new Set(Object.keys(labels))
  for (const entry of openOverrides) closedDates.delete(normalize(entry))
  return { labels, closedDates }
}
