require('dotenv').config();
const { pool } = require('./config/database');

const CUSTOM_BUILD_DOWN_PAYMENT_RATE = 0.50;
const DEFAULT_TENURE_MONTHS = 6;
const MONTHLY_INTEREST_RATE = 0.03;

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure installment table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS project_installment_schedules (
        schedule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
        installment_number INT NOT NULL CHECK (installment_number > 0),
        amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
        due_date DATE NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
        paid_at TIMESTAMPTZ,
        payment_id UUID REFERENCES payments(payment_id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(project_id, installment_number)
      );
    `);

    // Find orders that are custom build orders with payment_plan = 'full_payment' (or null)
    // but have a payment amount less than the total (indicating a down payment was made)
    const affectedOrdersRes = await client.query(
      `SELECT o.order_id, o.total_amount, o.initial_payment_percentage, o.installment_tenure_months,
              COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0) AS verified_payment_total
       FROM orders o
       JOIN payments p ON p.order_id = o.order_id
       WHERE o.order_type = 'customization'
         AND (o.payment_plan = 'full_payment' OR o.payment_plan IS NULL)
         AND o.deleted_at IS NULL
       GROUP BY o.order_id, o.total_amount, o.initial_payment_percentage, o.installment_tenure_months
       HAVING COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0) > 0
          AND COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'verified'), 0) < o.total_amount`
    );

    const affectedOrders = affectedOrdersRes.rows;
    console.log(`Found ${affectedOrders.length} order(s) to fix`);

    for (const order of affectedOrders) {
      const totalAmount = Number(order.total_amount) || 0;
      const initialPaymentPercentage = Number(order.initial_payment_percentage) || CUSTOM_BUILD_DOWN_PAYMENT_RATE;
      const tenureMonths = Number(order.installment_tenure_months) || DEFAULT_TENURE_MONTHS;

      const initialPaymentAmount = Math.round(totalAmount * initialPaymentPercentage * 100) / 100;
      const financedAmount = totalAmount - initialPaymentAmount;
      const monthlyInstallmentAmount = financedAmount > 0
        ? Math.round((financedAmount * (1 + MONTHLY_INTEREST_RATE) / tenureMonths) * 100) / 100
        : 0;

      await client.query(
        `UPDATE orders
         SET payment_plan = 'installment',
             initial_payment_percentage = $1,
             installment_tenure_months = $2,
             initial_payment_amount = $3,
             monthly_installment_amount = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $5`,
        [initialPaymentPercentage, tenureMonths, initialPaymentAmount, monthlyInstallmentAmount, order.order_id]
      );

      console.log(`  ✓ Updated order ${order.order_id}: payment_plan -> installment, initial_payment=${initialPaymentAmount}, monthly=${monthlyInstallmentAmount}`);

      // Create installment schedule for the project if it exists and doesn't have one
      const projectRes = await client.query(
        `SELECT project_id FROM projects WHERE order_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [order.order_id]
      );

      if (projectRes.rows.length > 0) {
        const projectId = projectRes.rows[0].project_id;

        const existingScheduleRes = await client.query(
          `SELECT COUNT(*)::int AS count FROM project_installment_schedules WHERE project_id = $1`,
          [projectId]
        );

        if (existingScheduleRes.rows[0].count === 0) {
          const today = new Date();
          for (let i = 1; i <= tenureMonths; i++) {
            const dueDate = new Date(today);
            dueDate.setMonth(dueDate.getMonth() + i);
            dueDate.setDate(1);

            await client.query(
              `INSERT INTO project_installment_schedules
               (project_id, installment_number, amount, due_date, status)
               VALUES ($1, $2, $3, $4, 'pending')`,
              [projectId, i, monthlyInstallmentAmount, dueDate.toISOString().split('T')[0]]
            );
          }
          console.log(`    → Created ${tenureMonths} installment schedules for project ${projectId}`);
        } else {
          console.log(`    → Project ${projectId} already has ${existingScheduleRes.rows[0].count} installment schedule(s), skipping`);
        }
      }
    }

    await client.query('COMMIT');
    console.log('\nMigration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMigration();
