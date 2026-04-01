const { pool } = require('../config/database');

// ─── CUSTOMIZATIONS ──────────────────────────────────────────────────────────

exports.getAllCustomizations = async ({ search, guitar_type, is_saved, user_id } = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (search) {
    where.push(`(c.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (guitar_type) {
    where.push(`c.guitar_type = $${idx}`);
    params.push(guitar_type);
    idx++;
  }
  if (is_saved !== undefined) {
    where.push(`c.is_saved = $${idx}`);
    params.push(is_saved === 'true' || is_saved === true);
    idx++;
  }
  if (user_id) {
    where.push(`c.user_id = $${idx}`);
    params.push(user_id);
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT c.*,
            u.email AS user_email,
            u.first_name || ' ' || u.last_name AS user_name
     FROM customizations c
     LEFT JOIN users u ON c.user_id = u.user_id
     ${condition}
     ORDER BY c.created_at DESC`,
    params
  );
  return res.rows;
};

exports.getCustomizationById = async (id) => {
  const res = await pool.query(
    `SELECT c.*, u.email AS user_email, u.first_name || ' ' || u.last_name AS user_name
     FROM customizations c
     LEFT JOIN users u ON c.user_id = u.user_id
     WHERE c.customization_id = $1`,
    [id]
  );
  if (!res.rows[0]) return null;

  const parts = await pool.query(
    `SELECT cp.*, p.name AS product_name
     FROM customization_parts cp
     LEFT JOIN products p ON cp.product_id = p.product_id
     WHERE cp.customization_id = $1
     ORDER BY cp.created_at ASC`,
    [id]
  );
  return { ...res.rows[0], parts: parts.rows };
};

exports.updateCustomization = async (id, { name, total_price, is_saved, body_wood, neck_wood, fingerboard_wood, bridge_type, pickups, color, finish_type }) => {
  const res = await pool.query(
    `UPDATE customizations SET
       name             = COALESCE($1, name),
       total_price      = COALESCE($2, total_price),
       is_saved         = COALESCE($3, is_saved),
       body_wood        = COALESCE($4, body_wood),
       neck_wood        = COALESCE($5, neck_wood),
       fingerboard_wood = COALESCE($6, fingerboard_wood),
       bridge_type      = COALESCE($7, bridge_type),
       pickups          = COALESCE($8, pickups),
       color            = COALESCE($9, color),
       finish_type      = COALESCE($10, finish_type),
       updated_at       = now()
     WHERE customization_id = $11
     RETURNING *`,
    [name, total_price, is_saved, body_wood, neck_wood, fingerboard_wood, bridge_type, pickups, color, finish_type, id]
  );
  return res.rows[0] || null;
};

exports.deleteCustomization = async (id) => {
  await pool.query('DELETE FROM customizations WHERE customization_id = $1', [id]);
};

// ─── CUSTOMIZATION PARTS ─────────────────────────────────────────────────────

exports.getAllParts = async ({ customization_id } = {}) => {
  const where = customization_id ? 'WHERE cp.customization_id = $1' : '';
  const params = customization_id ? [customization_id] : [];

  const res = await pool.query(
    `SELECT cp.*, p.name AS product_name, c.name AS customization_name
     FROM customization_parts cp
     LEFT JOIN products p ON cp.product_id = p.product_id
     LEFT JOIN customizations c ON cp.customization_id = c.customization_id
     ${where}
     ORDER BY cp.created_at DESC`,
    params
  );
  return res.rows;
};

exports.createPart = async ({ customization_id, product_id, part_name, quantity, price }) => {
  const res = await pool.query(
    `INSERT INTO customization_parts (customization_id, product_id, part_name, quantity, price)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [customization_id, product_id || null, part_name, quantity, price]
  );
  return res.rows[0];
};

exports.updatePart = async (id, { product_id, part_name, quantity, price }) => {
  const res = await pool.query(
    `UPDATE customization_parts SET
       product_id = COALESCE($1, product_id),
       part_name  = COALESCE($2, part_name),
       quantity   = COALESCE($3, quantity),
       price      = COALESCE($4, price)
     WHERE part_id = $5
     RETURNING *`,
    [product_id, part_name, quantity, price, id]
  );
  return res.rows[0] || null;
};

exports.deletePart = async (id) => {
  await pool.query('DELETE FROM customization_parts WHERE part_id = $1', [id]);
};
