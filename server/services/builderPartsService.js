const { pool } = require('../config/database');

exports.getAllParts = async ({
  search,
  type_mapping,
  guitar_type,
  part_category,
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
    where.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (type_mapping) {
    where.push(`type_mapping = $${idx}`);
    params.push(type_mapping);
    idx++;
  }
  if (guitar_type) {
    where.push(`guitar_type = $${idx}`);
    params.push(guitar_type);
    idx++;
  }
  if (part_category) {
    where.push(`part_category = $${idx}`);
    params.push(part_category);
    idx++;
  }
  if (is_active !== undefined && is_active !== '') {
    where.push(`is_active = $${idx}`);
    params.push(is_active === 'true' || is_active === true);
    idx++;
  }
  if (min_price !== undefined && min_price !== '') {
    where.push(`price >= $${idx}`);
    params.push(Number(min_price));
    idx++;
  }
  if (max_price !== undefined && max_price !== '') {
    where.push(`price <= $${idx}`);
    params.push(Number(max_price));
    idx++;
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortableColumns = {
    created_at: 'created_at',
    name: 'name',
    price: 'price',
    stock: 'stock',
    guitar_type: 'guitar_type',
    part_category: 'part_category',
  };
  const orderColumn = sortableColumns[sortBy] || sortableColumns.created_at;
  const orderDirection = String(sortDir).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 100);
  const normalizedPage = Math.max(Number(page) || 1, 1);
  const offset = (normalizedPage - 1) * normalizedPageSize;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total FROM guitar_builder_parts ${condition}`,
    params
  );
  const total = countRes.rows[0]?.total || 0;

  const res = await pool.query(
    `SELECT * FROM guitar_builder_parts
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

exports.getPartById = async (id) => {
  const res = await pool.query('SELECT * FROM guitar_builder_parts WHERE part_id = $1', [id]);
  return res.rows[0] || null;
};

exports.createPart = async ({ name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active }) => {
  const res = await pool.query(
    `INSERT INTO guitar_builder_parts (name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active)
     VALUES ($1, $2, COALESCE($3, 'electric'), COALESCE($4, 'misc'), $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [name, description || null, guitar_type || null, part_category || null, folder_key || null, type_mapping, price || 0, stock || 0, image_url || null, metadata || null, is_active ?? true]
  );
  return res.rows[0];
};

exports.updatePart = async (id, { name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active }) => {
  const res = await pool.query(
    `UPDATE guitar_builder_parts SET
       name         = COALESCE($1, name),
       description  = COALESCE($2, description),
       guitar_type  = COALESCE($3, guitar_type),
       part_category= COALESCE($4, part_category),
       folder_key   = COALESCE($5, folder_key),
       type_mapping = COALESCE($6, type_mapping),
       price        = COALESCE($7, price),
       stock        = COALESCE($8, stock),
       image_url    = COALESCE($9, image_url),
       metadata     = COALESCE($10, metadata),
       is_active    = COALESCE($11, is_active),
       updated_at   = now()
     WHERE part_id = $12
     RETURNING *`,
    [name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active, id]
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
