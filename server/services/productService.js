const { pool } = require('../config/database');

// ─── CATEGORIES ─────────────────────────────────────────────────────────────

exports.getAllCategories = async () => {
  const res = await pool.query(
    `SELECT c.*, parent.name AS parent_name
     FROM categories c
     LEFT JOIN categories parent ON c.parent_id = parent.category_id
     ORDER BY c.sort_order ASC, c.name ASC`
  );
  return res.rows;
};

exports.getCategoryById = async (id) => {
  const res = await pool.query(
    'SELECT * FROM categories WHERE category_id = $1', [id]
  );
  return res.rows[0] || null;
};

exports.createCategory = async ({ name, slug, description, parent_id, sort_order }) => {
  const res = await pool.query(
    `INSERT INTO categories (name, slug, description, parent_id, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [name, slug, description || null, parent_id || null, sort_order ?? 0]
  );
  return res.rows[0];
};

exports.updateCategory = async (id, { name, slug, description, parent_id, sort_order, is_active }) => {
  const res = await pool.query(
    `UPDATE categories SET
       name        = COALESCE($1, name),
       slug        = COALESCE($2, slug),
       description = COALESCE($3, description),
       parent_id   = $4,
       sort_order  = COALESCE($5, sort_order),
       is_active   = COALESCE($6, is_active),
       updated_at  = now()
     WHERE category_id = $7
     RETURNING *`,
    [name, slug, description, parent_id || null, sort_order, is_active, id]
  );
  return res.rows[0] || null;
};

exports.deleteCategory = async (id) => {
  await pool.query('DELETE FROM categories WHERE category_id = $1', [id]);
};

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

exports.getAllProducts = async ({ search, category_id, is_active } = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (search) {
    where.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (category_id) {
    where.push(`p.category_id = $${idx}`);
    params.push(category_id);
    idx++;
  }
  if (is_active !== undefined) {
    where.push(`p.is_active = $${idx}`);
    params.push(is_active === 'true' || is_active === true);
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT p.*, c.name AS category_name,
            (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = true LIMIT 1) AS primary_image
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     ${condition}
     ORDER BY p.created_at DESC`,
    params
  );
  return res.rows;
};

exports.getProductById = async (id) => {
  const res = await pool.query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     WHERE p.product_id = $1`,
    [id]
  );
  if (!res.rows[0]) return null;
  
  const images = await pool.query(
    'SELECT * FROM product_images WHERE product_id = $1 ORDER BY sort_order ASC',
    [id]
  );
  return { ...res.rows[0], images: images.rows };
};

exports.createProduct = async ({ sku, name, description, price, cost, category_id, stock, low_stock_threshold, is_active }) => {
  const res = await pool.query(
    `INSERT INTO products (sku, name, description, price, cost, category_id, stock, low_stock_threshold, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [sku, name, description || null, price, cost || null, category_id || null, stock ?? 0, low_stock_threshold ?? 10, is_active ?? true]
  );
  return res.rows[0];
};

exports.updateProduct = async (id, { sku, name, description, price, cost, category_id, stock, low_stock_threshold, is_active }) => {
  const res = await pool.query(
    `UPDATE products SET
       sku                = COALESCE($1, sku),
       name               = COALESCE($2, name),
       description        = COALESCE($3, description),
       price              = COALESCE($4, price),
       cost               = COALESCE($5, cost),
       category_id        = COALESCE($6, category_id),
       stock              = COALESCE($7, stock),
       low_stock_threshold= COALESCE($8, low_stock_threshold),
       is_active          = COALESCE($9, is_active),
       updated_at         = now()
     WHERE product_id = $10
     RETURNING *`,
    [sku, name, description, price, cost, category_id, stock, low_stock_threshold, is_active, id]
  );
  return res.rows[0] || null;
};

exports.deleteProduct = async (id) => {
  // Soft delete
  const res = await pool.query(
    `UPDATE products SET is_active = false, updated_at = now()
     WHERE product_id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
};

// ─── PRODUCT IMAGES ──────────────────────────────────────────────────────────

exports.addProductImage = async (product_id, { image_url, alt_text, sort_order, is_primary }) => {
  if (is_primary) {
    await pool.query(
      'UPDATE product_images SET is_primary = false WHERE product_id = $1', [product_id]
    );
  }
  const res = await pool.query(
    `INSERT INTO product_images (product_id, image_url, alt_text, sort_order, is_primary)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [product_id, image_url, alt_text || null, sort_order ?? 0, is_primary ?? false]
  );
  return res.rows[0];
};

exports.deleteProductImage = async (image_id) => {
  await pool.query('DELETE FROM product_images WHERE image_id = $1', [image_id]);
};
