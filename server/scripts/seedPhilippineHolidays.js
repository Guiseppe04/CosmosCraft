const { Client } = require('pg');

const PH_PH_PIN = {
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.ohhycwstbiqjecgvemzc',
  password: 'TRW&NJx64Ch!?hz',
  ssl: { rejectUnauthorized: false },
};

const PHILIPPINE_HOLIDAYS = [
  { month: 1, day: 1, name: 'New Year\'s Day' },
  { month: 4, day: 9, name: 'Araw ng Kagitingan (Bataan Day)' },
  { month: 5, day: 1, name: 'Labor Day' },
  { month: 6, day: 12, name: 'Independence Day' },
  { month: 8, day: 21, name: 'Ninoy Aquino Day' },
  { month: 8, day: 30, name: 'National Heroes Day' },
  { month: 11, day: 1, name: 'All Saints\' Day' },
  { month: 11, day: 30, name: 'Bonifacio Day' },
  { month: 12, day: 8, name: 'Feast of the Immaculate Conception' },
  { month: 12, day: 25, name: 'Christmas Day' },
  { month: 12, day: 30, name: 'Rizal Day' },
];

const EASTER_HOLIDAYS = [
  { daysBefore: 2, name: 'Maundy Thursday' },
  { daysBefore: 1, name: 'Good Friday' },
];

function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getHolidaysForYear(year) {
  const holidays = [];
  
  for (const holiday of PHILIPPINE_HOLIDAYS) {
    holidays.push({
      date: new Date(year, holiday.month - 1, holiday.day),
      name: holiday.name,
    });
  }
  
  try {
    const easterDate = calculateEaster(year);
    for (const holiday of EASTER_HOLIDAYS) {
      const easterHoliday = new Date(easterDate);
      easterHoliday.setDate(easterDate.getDate() - holiday.daysBefore);
      holidays.push({
        date: easterHoliday,
        name: holiday.name,
      });
    }
  } catch (e) {
    console.warn('Could not calculate Easter for year', year, e.message);
  }
  
  holidays.sort((a, b) => a.date - b.date);
  return holidays;
}

async function seedHolidays(year = new Date().getFullYear(), adminUserId = null) {
  const client = new Client(PH_PH_PIN);
  
  try {
    await client.connect();
    console.log('Connected to database');
    
    const holidays = getHolidaysForYear(year);
    console.log(`Found ${holidays.length} holidays for ${year}`);
    
    let inserted = 0;
    let skipped = 0;
    
    for (const holiday of holidays) {
      const dateStr = holiday.date.toISOString().split('T')[0];
      
      try {
        const result = await client.query(
          `INSERT INTO unavailable_dates (date, reason, is_recurring, created_by)
           VALUES ($1, $2, TRUE, $3)
           ON CONFLICT (date) DO NOTHING
           RETURNING id`,
          [dateStr, holiday.name, adminUserId]
        );
        
        if (result.rows.length > 0) {
          console.log(`Inserted: ${dateStr} - ${holiday.name}`);
          inserted++;
        } else {
          skipped++;
        }
      } catch (err) {
        if (err.code === '23505') {
          skipped++;
        } else {
          console.error(`Error inserting ${dateStr}:`, err.message);
        }
      }
    }
    
    console.log(`\nSeeding complete: ${inserted} inserted, ${skipped} skipped (already exists)`);
    
  } catch (err) {
    console.error('Seed error:', err.message);
    throw err;
  } finally {
    await client.end();
  }
}

const year = process.argv[2] ? parseInt(process.argv[2], 10) : new Date().getFullYear();
const adminUserId = process.argv[3] || null;

seedHolidays(year, adminUserId)
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });