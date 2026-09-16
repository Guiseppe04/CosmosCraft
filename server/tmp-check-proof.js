// Diagnostic: Check whether installment payments have proof_url stored
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { pool } = require('./config/database');

async function main() {
  try {
    // Check the most recent installment payments
    const res = await pool.query(`
      SELECT 
        p.payment_id,
        p.order_id,
        p.amount,
        p.status,
        p.reference_number,
        p.proof_url,
        p.created_at,
        p.metadata->>'type' AS payment_type,
        p.metadata->>'installment_number' AS installment_number,
        p.metadata->>'schedule_id' AS schedule_id,
        pis.schedule_id AS linked_schedule_id,
        pis.installment_number AS linked_installment_number,
        pis.payment_id AS schedule_payment_id
      FROM payments p
      LEFT JOIN project_installment_schedules pis ON pis.payment_id = p.payment_id
      WHERE p.metadata->>'type' = 'installment'
         OR p.metadata->>'schedule_id' IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 20
    `);

    console.log('=== INSTALLMENT PAYMENTS ===');
    console.log(`Found ${res.rows.length} installment payments`);
    res.rows.forEach((row, i) => {
      console.log(`\n--- Payment ${i + 1} ---`);
      console.log(`payment_id: ${row.payment_id}`);
      console.log(`status: ${row.status}`);
      console.log(`reference_number: ${row.reference_number}`);
      console.log(`proof_url: ${JSON.stringify(row.proof_url)}`);
      console.log(`payment_type: ${row.payment_type}`);
      console.log(`installment_number: ${row.installment_number}`);
      console.log(`schedule_id (metadata): ${row.schedule_id}`);
      console.log(`linked_schedule_id: ${row.linked_schedule_id}`);
      console.log(`linked_installment_number: ${row.linked_installment_number}`);
      console.log(`schedule_payment_id: ${row.schedule_payment_id}`);
      console.log(`created_at: ${row.created_at}`);
    });

    // Also check if there are any payments with proof_url but no metadata type
    const res2 = await pool.query(`
      SELECT payment_id, order_id, amount, status, reference_number, proof_url, created_at
      FROM payments
      WHERE proof_url IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    console.log('\n=== RECENT PAYMENTS WITH PROOF_URL ===');
    console.log(`Found ${res2.rows.length} payments with proof_url`);
    res2.rows.forEach((row, i) => {
      console.log(`\n--- ${i + 1} ---`);
      console.log(`payment_id: ${row.payment_id}`);
      console.log(`status: ${row.status}`);
      console.log(`proof_url: ${JSON.stringify(row.proof_url)}`);
      console.log(`created_at: ${row.created_at}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();