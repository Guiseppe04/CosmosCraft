const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { pool } = require('../../config/database');

const ids = {
  customer: '10000000-0000-4000-8000-000000000001', admin: '10000000-0000-4000-8000-000000000002',
  other: '10000000-0000-4000-8000-000000000003', staff: '10000000-0000-4000-8000-000000000004',
  order: '20000000-0000-4000-8000-000000000001', product: '30000000-0000-4000-8000-000000000001',
};
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN5kAAAAASUVORK5CYII=';

async function createFixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE users(user_id UUID PRIMARY KEY,first_name TEXT,last_name TEXT,email TEXT);
    CREATE TABLE products(product_id UUID PRIMARY KEY,name TEXT);
    CREATE TABLE orders(order_id UUID PRIMARY KEY,user_id UUID,order_number TEXT,status TEXT,payment_status TEXT,
      delivered_at TIMESTAMPTZ DEFAULT now(), received_at TIMESTAMPTZ,created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ,total_amount NUMERIC,notes TEXT);
    CREATE TABLE payments(payment_id UUID DEFAULT gen_random_uuid(),order_id UUID,amount NUMERIC,status TEXT,payment_method TEXT,created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ);
    CREATE TABLE order_items(order_item_id BIGSERIAL PRIMARY KEY,order_id UUID,product_id UUID,product_name TEXT,unit_price NUMERIC,quantity INT);
    CREATE TABLE product_images(product_id UUID,image_url TEXT,is_primary BOOLEAN);
    CREATE TABLE product_reviews(order_id UUID,order_item_id BIGINT,deleted_at TIMESTAMPTZ);
    CREATE TABLE customization_feedback(order_id UUID,deleted_at TIMESTAMPTZ);
    CREATE TABLE projects(project_id UUID,order_id UUID,title TEXT,status TEXT,fulfillment_status TEXT,deleted_at TIMESTAMPTZ);
    CREATE TABLE refund_requests(refund_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),order_id UUID,user_id UUID,
      status VARCHAR(30) DEFAULT 'pending',reason TEXT,customer_notes TEXT,request_number TEXT,deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),updated_at TIMESTAMPTZ,reviewed_by UUID,reviewed_at TIMESTAMPTZ,refunded_at TIMESTAMPTZ,
      amount_requested NUMERIC,approved_amount NUMERIC,refunded_amount NUMERIC,refund_type TEXT,refund_reference TEXT,refund_method TEXT,
      rejection_reason TEXT,admin_notes TEXT,approved_at TIMESTAMPTZ,processing_at TIMESTAMPTZ,
      CONSTRAINT refund_requests_status_check CHECK(status IN ('pending','approved','processing','refunded','rejected','withdrawn')));
    CREATE TABLE refund_request_items(refund_request_id UUID,order_item_id BIGINT,product_id UUID,product_name TEXT,quantity INT,
      unit_price NUMERIC,refund_amount NUMERIC,deleted_at TIMESTAMPTZ);
    CREATE TABLE refund_request_images(refund_request_id UUID,image_url TEXT,sort_order INT,deleted_at TIMESTAMPTZ);
    CREATE TABLE refund_request_counters(prefix TEXT PRIMARY KEY,date DATE,last_number INT,updated_at TIMESTAMPTZ);
    CREATE TABLE audit_logs(user_id UUID,action TEXT,entity_type TEXT,entity_id UUID,previous_status TEXT,new_status TEXT,
      details JSONB,context JSONB,changes JSONB,ip_address TEXT,user_agent TEXT,search_text TEXT);
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../../migrations/42_order_refund_workflow.sql'), 'utf8'));
  // Rerunning the additive migration must leave records and files intact.
  await db.exec(fs.readFileSync(path.join(__dirname, '../../migrations/42_order_refund_workflow.sql'), 'utf8'));
  for (const [name,id] of Object.entries(ids).filter(([name]) => ['customer','admin','other','staff'].includes(name))) {
    await db.query('INSERT INTO users VALUES($1,$2,$3,$4)', [id,name,'Test',`${name}@example.test`]);
  }
  await db.query('INSERT INTO products VALUES($1,$2)', [ids.product,'Test Guitar']);
  await db.query("INSERT INTO orders(order_id,user_id,order_number,status,payment_status,total_amount) VALUES($1,$2,'TEST-ORDER','received','approved',1000)", [ids.order,ids.customer]);
  await db.query("INSERT INTO payments(order_id,amount,status,payment_method) VALUES($1,1000,'verified','e_wallet')", [ids.order]);
  await db.query("INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity) VALUES($1,$2,'Test Guitar',500,2)", [ids.order,ids.product]);

  const originalQuery = pool.query, originalConnect = pool.connect;
  const query = async (sql, params = []) => db.query(sql, params);
  pool.query = query;
  pool.connect = async () => ({ query, release() {} });
  const auth = require('../../middleware/auth');
  const originalAuthenticate = auth.authenticateToken;
  // Test identity provider only; routes retain their real authorization and validators.
  auth.authenticateToken = (req,res,next) => {
    const actor = req.headers['x-test-actor'];
    if (!['customer','other','staff','admin'].includes(actor)) return res.status(401).json({ message: 'Unauthorized' });
    req.user = { id: ids[actor], user_id: ids[actor], role: actor === 'other' ? 'customer' : actor };
    next();
  };
  delete require.cache[require.resolve('../../routes/orderRoutes')];
  const router = require('../../routes/orderRoutes');
  auth.authenticateToken = originalAuthenticate;
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/orders', router);
  app.use((err,req,res,next) => res.status(err.statusCode || 400).json({ message: err.message }));
  return { db, app, ids, png, async close() { pool.query = originalQuery; pool.connect = originalConnect; await db.close(); } };
}
module.exports = { createFixture, ids, png };
