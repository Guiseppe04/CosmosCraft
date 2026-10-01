require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const fs = require('fs')
const path = require('path')
const { pool } = require('../config/database')

async function runMigration() {
  const client = await pool.connect()
  try {
    const sql = fs.readFileSync(path.join(__dirname, '27_add_customization_body_model.sql'), 'utf-8')
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('Migration 27 completed successfully.')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Migration 27 failed:', error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()