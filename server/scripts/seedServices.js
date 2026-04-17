/**
 * Service Seeder
 * Run: node server/scripts/seedServices.js
 * Inserts default services into the database
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const services = [
  {
    id: 'setup-standard',
    category_id: 'setup',
    name: 'Standard Setup',
    description: 'Complete intonation, action, and neck adjustment. (1-3 days)',
    price: 80,
    lead_time_days: 3,
  },
  {
    id: 'setup-full',
    category_id: 'setup',
    name: 'Full Setup',
    description: 'Includes fret polishing and deep cleaning. (up to 7 days)',
    price: 120,
    lead_time_days: 7,
  },
  {
    id: 'refinish-basic',
    category_id: 'refinishing',
    name: 'Basic Refinish',
    description: 'Standard solid color. (2-3 weeks)',
    price: 300,
    lead_time_days: 21,
  },
  {
    id: 'refinish-custom',
    category_id: 'refinishing',
    name: 'Custom Refinish',
    description: 'Burst, metallic, or custom art. (4-6+ weeks)',
    price: 500,
    lead_time_days: 42,
  },
  {
    id: 'repair-minor',
    category_id: 'repair',
    name: 'Minor Repairs',
    description: 'String replacement, minor wiring fix. (Same day)',
    price: 40,
    lead_time_days: 0,
  },
  {
    id: 'repair-moderate',
    category_id: 'repair',
    name: 'Moderate Repairs',
    description: 'Fret leveling, nut replacement. (2-7 days)',
    price: 150,
    lead_time_days: 7,
  },
  {
    id: 'repair-major',
    category_id: 'repair',
    name: 'Major Repairs',
    description: 'Structural fix, headstock repair. (1-3 weeks or more)',
    price: 350,
    lead_time_days: 21,
  },
  {
    id: 'elec-simple',
    category_id: 'electronics',
    name: 'Simple Upgrade',
    description: 'Pots, output jack, capacitors. (Same day)',
    price: 60,
    lead_time_days: 0,
  },
  {
    id: 'elec-moderate',
    category_id: 'electronics',
    name: 'Moderate Upgrade',
    description: 'Pickup installation, wiring cleanup. (1-3 days)',
    price: 120,
    lead_time_days: 3,
  },
  {
    id: 'elec-advanced',
    category_id: 'electronics',
    name: 'Advanced Mods',
    description: 'Coil-splitting, custom wiring, shielding. (3-7 days)',
    price: 200,
    lead_time_days: 7,
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE services 
      ADD COLUMN IF NOT EXISTS category_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS service_key VARCHAR(50) UNIQUE
    `);
    console.log('📦 Columns ensured: category_id, lead_time_days, service_key');

    await client.query('DELETE FROM services');
    console.log('🗑️  Cleared existing services');

    for (const service of services) {
      const durationMinutes = service.lead_time_days === 0 ? 30 : Math.min(service.lead_time_days * 60, 1440);
      await client.query(
        `INSERT INTO services (service_key, category_id, name, description, price, duration_minutes, lead_time_days, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true, now(), now())`,
        [service.id, service.category_id, service.name, service.description, service.price, durationMinutes, service.lead_time_days]
      );

      console.log(`✅  Inserted: ${service.name} (₱${service.price})`);
    }

    console.log(`\n📊  Seeding complete: ${services.length} services inserted`);
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
