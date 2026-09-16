require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('./config/database');

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`ALTER TYPE order_status_enum ADD VALUE IF NOT EXISTS 'received'`);
    console.log('✓ Added received to order_status_enum');

    // Add received_at column to orders table if it doesn't exist
    const receivedAtColRes = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'orders' AND column_name = 'received_at'`
    );
    if (receivedAtColRes.rows.length === 0) {
      await client.query(`ALTER TABLE orders ADD COLUMN received_at TIMESTAMPTZ`);
      console.log('✓ Added received_at column to orders table');
    } else {
      console.log('✓ received_at column already exists');
    }

    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_received_at ON orders(received_at) WHERE received_at IS NOT NULL`);
    console.log('✓ Created idx_orders_received_at index');

    await client.query(`
      CREATE TABLE IF NOT EXISTS refund_requests (
        refund_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
        reason TEXT NOT NULL,
        customer_notes TEXT,
        admin_notes TEXT,
        reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
        reviewed_at TIMESTAMPTZ,
        refunded_at TIMESTAMPTZ,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ Created refund_requests table');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_requests_order_id ON refund_requests(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON refund_requests(user_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_requests_created_at ON refund_requests(created_at DESC)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_requests_deleted_at ON refund_requests(deleted_at) WHERE deleted_at IS NOT NULL`);
    console.log('✓ Created refund_requests indexes');

    await client.query(`
      CREATE TABLE IF NOT EXISTS refund_request_items (
        refund_request_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        refund_request_id UUID NOT NULL REFERENCES refund_requests(refund_request_id) ON DELETE CASCADE,
        order_item_id BIGINT NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
        product_name VARCHAR(150) NOT NULL,
        quantity INT NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
        refund_amount NUMERIC(12, 2) NOT NULL CHECK (refund_amount >= 0),
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ Created refund_request_items table');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_request_items_refund_request_id ON refund_request_items(refund_request_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_request_items_order_item_id ON refund_request_items(order_item_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_request_items_product_id ON refund_request_items(product_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_request_items_deleted_at ON refund_request_items(deleted_at) WHERE deleted_at IS NOT NULL`);
    console.log('✓ Created refund_request_items indexes');

    await client.query(`
      CREATE TABLE IF NOT EXISTS refund_request_images (
        refund_request_image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        refund_request_id UUID NOT NULL REFERENCES refund_requests(refund_request_id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        alt_text VARCHAR(200),
        sort_order SMALLINT NOT NULL DEFAULT 0,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    console.log('✓ Created refund_request_images table');

    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_request_images_refund_request_id ON refund_request_images(refund_request_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_refund_request_images_deleted_at ON refund_request_images(deleted_at) WHERE deleted_at IS NOT NULL`);
    console.log('✓ Created refund_request_images indexes');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
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
