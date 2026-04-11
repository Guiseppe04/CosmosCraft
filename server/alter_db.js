require('dotenv').config();
const { pool } = require('./config/database');

async function alter() {
  try {
    await pool.query('ALTER TABLE users ADD COLUMN birth_date DATE;');
    console.log('Successfully altered users table to add birth_date');
  } catch (err) {
    if (err.message.includes('already exists')) {
        console.log('Column birth_date already exists');
    } else {
        console.error(err);
    }
  } finally {
    const p = await pool; // It might be an unwrapped object depending on how config exports it
  if(p.end) p.end();
  setTimeout(()=>process.exit(0), 1000);
  }
}
alter();
