const Holidays = require('date-holidays');
const calendar = new Holidays('PH');
const cache = new Map();

function getHolidaysForYear(year) {
  if (!cache.has(year)) {
    const map = {};
    for (const holiday of calendar.getHolidays(year)) {
      if (!['public', 'bank', 'optional'].includes(holiday.type)) continue;
      map[String(holiday.date).slice(0, 10)] ||= holiday.name;
    }
    cache.set(year, map);
  }
  return cache.get(year);
}

function appointmentDateKey(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

function isHoliday(date) {
  const key = appointmentDateKey(date);
  return Boolean(getHolidaysForYear(Number(key.slice(0, 4)))[key]);
}

module.exports = { getHolidaysForYear, appointmentDateKey, isHoliday };
