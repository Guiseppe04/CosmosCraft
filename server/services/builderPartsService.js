const { pool } = require('../config/database');

exports.getAllParts = async ({ type_mapping, is_active } = {}) => {
  let where = [];
  let params = [];
  let idx = 1;

  if (type_mapping) {
    where.push(`type_mapping = $${idx}`);
    params.push(type_mapping);
    idx++;
  }
  if (is_active !== undefined) {
    where.push(`is_active = $${idx}`);
    params.push(is_active === 'true' || is_active === true);
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const res = await pool.query(
    `SELECT * FROM guitar_builder_parts
     ${condition}
     ORDER BY created_at DESC`,
    params
  );
  return res.rows;
};

exports.getPartById = async (id) => {
  const res = await pool.query('SELECT * FROM guitar_builder_parts WHERE part_id = $1', [id]);
  return res.rows[0] || null;
};

exports.createPart = async ({ name, description, type_mapping, price, stock, image_url, metadata, is_active }) => {
  const res = await pool.query(
    `INSERT INTO guitar_builder_parts (name, description, type_mapping, price, stock, image_url, metadata, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [name, description || null, type_mapping, price || 0, stock || 0, image_url || null, metadata || null, is_active ?? true]
  );
  return res.rows[0];
};

exports.updatePart = async (id, { name, description, type_mapping, price, stock, image_url, metadata, is_active }) => {
  const res = await pool.query(
    `UPDATE guitar_builder_parts SET
       name         = COALESCE($1, name),
       description  = COALESCE($2, description),
       type_mapping = COALESCE($3, type_mapping),
       price        = COALESCE($4, price),
       stock        = COALESCE($5, stock),
       image_url    = COALESCE($6, image_url),
       metadata     = COALESCE($7, metadata),
       is_active    = COALESCE($8, is_active),
       updated_at   = now()
     WHERE part_id = $9
     RETURNING *`,
    [name, description, type_mapping, price, stock, image_url, metadata, is_active, id]
  );
  return res.rows[0] || null;
};

exports.deletePart = async (id) => {
  // Soft delete
  const res = await pool.query(
    `UPDATE guitar_builder_parts SET is_active = false, updated_at = now()
     WHERE part_id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
};
