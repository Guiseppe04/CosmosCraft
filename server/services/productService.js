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

exports.getAllProducts = async ({
  search,
  category_id,
  brand,
  is_active,
  min_price,
  max_price,
  page = 1,
  pageSize = 10,
  sortBy = 'created_at',
  sortDir = 'desc',
} = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (search) {
    where.push(`(p.name ILIKE $${idx} OR p.sku ILIKE $${idx} OR p.brand ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (category_id) {
    where.push(`p.category_id = $${idx}`);
    params.push(category_id);
    idx++;
  }
  if (brand) {
    where.push(`p.brand ILIKE $${idx}`);
    params.push(`%${brand}%`);
    idx++;
  }
  if (is_active !== undefined) {
    where.push(`p.is_active = $${idx}`);
    params.push(is_active === 'true' || is_active === true);
    idx++;
  }
  if (min_price !== undefined && min_price !== '') {
    where.push(`p.price >= $${idx}`);
    params.push(Number(min_price));
    idx++;
  }
  if (max_price !== undefined && max_price !== '') {
    where.push(`p.price <= $${idx}`);
    params.push(Number(max_price));
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortableColumns = {
    created_at: 'p.created_at',
    name: 'p.name',
    price: 'p.price',
    stock: 'i.stock',
  };
  const orderColumn = sortableColumns[sortBy] || sortableColumns.created_at;
  const orderDirection = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedPageSize;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM products p
     LEFT JOIN inventory i ON p.product_id = i.product_id
     ${condition}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const res = await pool.query(
    `SELECT p.*, c.name AS category_name,
            i.cost_price, i.stock, i.low_stock_threshold,
            (SELECT image_url FROM product_images WHERE product_id = p.product_id AND is_primary = true LIMIT 1) AS primary_image
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN inventory i ON p.product_id = i.product_id
     ${condition}
     ORDER BY ${orderColumn} ${orderDirection}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, normalizedPageSize, offset]
  );

  return {
    items: res.rows,
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      totalPages: Math.max(Math.ceil(total / normalizedPageSize), 1),
    },
  };
};

exports.getProductById = async (id) => {
  const res = await pool.query(
    `SELECT p.*, c.name AS category_name,
            i.cost_price, i.stock, i.low_stock_threshold, i.inventory_id,
            (SELECT image_url
             FROM product_images
             WHERE product_id = p.product_id AND is_primary = true
             LIMIT 1) AS primary_image
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.category_id
     LEFT JOIN inventory i ON p.product_id = i.product_id
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

exports.createProduct = async ({ sku, name, description, price, brand, cost_price, category_id, stock, low_stock_threshold, is_active }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create product record
    const productRes = await client.query(
      `INSERT INTO products (sku, name, description, price, brand, category_id, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sku, name, description || null, price, brand || null, category_id || null, is_active ?? true]
    );
    const product = productRes.rows[0];
    
    // Create inventory record
    await client.query(
      `INSERT INTO inventory (product_id, cost_price, stock, low_stock_threshold)
       VALUES ($1, $2, $3, $4)`,
      [product.product_id, cost_price || null, stock ?? 0, low_stock_threshold ?? 10]
    );
    
    await client.query('COMMIT');
    
    // Return product with inventory data
    return {
      ...product,
      cost_price: cost_price || null,
      stock: stock ?? 0,
      low_stock_threshold: low_stock_threshold ?? 10
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.updateProduct = async (id, { sku, name, description, price, brand, cost_price, category_id, stock, low_stock_threshold, is_active }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update product record
    const productRes = await client.query(
      `UPDATE products SET
         sku                = COALESCE($1, sku),
         name               = COALESCE($2, name),
         description        = COALESCE($3, description),
         price              = COALESCE($4, price),
         brand              = COALESCE($5, brand),
         category_id        = COALESCE($6, category_id),
         is_active          = COALESCE($7, is_active),
         updated_at         = now()
       WHERE product_id = $8
       RETURNING *`,
      [sku, name, description, price, brand, category_id, is_active, id]
    );
    
    if (!productRes.rows[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    
    // Update or create inventory record
    const inventoryRes = await client.query(
      `SELECT inventory_id FROM inventory WHERE product_id = $1`,
      [id]
    );
    
    if (inventoryRes.rows.length > 0) {
      // Update existing inventory record
      await client.query(
        `UPDATE inventory SET
           cost_price           = COALESCE($1, cost_price),
           stock                = COALESCE($2, stock),
           low_stock_threshold  = COALESCE($3, low_stock_threshold),
           updated_at           = now()
         WHERE product_id = $4`,
        [cost_price, stock, low_stock_threshold, id]
      );
    } else {
      // Create new inventory record if it doesn't exist
      await client.query(
        `INSERT INTO inventory (product_id, cost_price, stock, low_stock_threshold)
         VALUES ($1, $2, $3, $4)`,
        [id, cost_price || null, stock ?? 0, low_stock_threshold ?? 10]
      );
    }
    
    await client.query('COMMIT');
    
    const product = productRes.rows[0];
    return {
      ...product,
      cost_price,
      stock,
      low_stock_threshold
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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
