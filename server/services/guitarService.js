const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const MAX_SAVED_CUSTOMIZATIONS_PER_USER = 10;

let customizationColumnsReady = false;
let customizationColumnsPromise = null;

async function ensureCustomizationColumns() {
  if (customizationColumnsReady) return;
  if (!customizationColumnsPromise) {
    customizationColumnsPromise = pool.query(`
      ALTER TABLE customizations
      ADD COLUMN IF NOT EXISTS config_json JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS stickers JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS preview_image TEXT
    `).then(() => {
      customizationColumnsReady = true;
    }).catch((error) => {
      customizationColumnsPromise = null;
      throw error;
    });
  }
  await customizationColumnsPromise;
}

async function getCustomizationLockInfo(customizationId, userId) {
  const res = await pool.query(
    `SELECT
       linked_order.order_id AS active_order_id,
       linked_project.project_id AS active_project_id
     FROM customizations c
     LEFT JOIN LATERAL (
       SELECT o.order_id
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       WHERE oi.customization_id = c.customization_id
         AND o.user_id = c.user_id
         AND o.status <> 'cancelled'
       ORDER BY o.created_at DESC
       LIMIT 1
     ) linked_order ON TRUE
     LEFT JOIN LATERAL (
       SELECT p.project_id
       FROM projects p
       JOIN orders o ON o.order_id = p.order_id
       JOIN order_items oi ON oi.order_id = o.order_id
       WHERE oi.customization_id = c.customization_id
         AND o.user_id = c.user_id
         AND COALESCE(p.is_deleted, false) = false
         AND p.status <> 'cancelled'
       ORDER BY p.created_at DESC
       LIMIT 1
     ) linked_project ON TRUE
     WHERE c.customization_id = $1
       AND c.user_id = $2`,
    [customizationId, userId]
  );

  return res.rows[0] || null;
}

// ─── CUSTOMIZATIONS ──────────────────────────────────────────────────────────

exports.getAllCustomizations = async ({ search, guitar_type, is_saved, user_id } = {}) => {
  await ensureCustomizationColumns();
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
  await ensureCustomizationColumns();
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
  await ensureCustomizationColumns();
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

exports.getMyCustomizations = async (userId) => {
  await ensureCustomizationColumns();
  const res = await pool.query(
    `SELECT *
     FROM customizations
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );
  for (const customization of res.rows) {
    const lockInfo = await getCustomizationLockInfo(customization.customization_id, userId);
    customization.active_order_id = lockInfo?.active_order_id || null;
    customization.active_project_id = lockInfo?.active_project_id || null;
    customization.is_locked = Boolean(lockInfo?.active_order_id);
  }

  return res.rows;
};

exports.getMyCustomizationById = async (customizationId, userId) => {
  await ensureCustomizationColumns();
  const res = await pool.query(
    `SELECT *
     FROM customizations
     WHERE customization_id = $1 AND user_id = $2`,
    [customizationId, userId]
  );
  const customization = res.rows[0] || null;
  if (!customization) return null;

  const lockInfo = await getCustomizationLockInfo(customizationId, userId);
  customization.active_order_id = lockInfo?.active_order_id || null;
  customization.active_project_id = lockInfo?.active_project_id || null;
  customization.is_locked = Boolean(lockInfo?.active_order_id);

  return customization;
};

exports.createMyCustomization = async (userId, payload) => {
  await ensureCustomizationColumns();
  const {
    name,
    guitar_type,
    body_wood,
    neck_wood,
    fingerboard_wood,
    bridge_type,
    pickups,
    color,
    finish_type,
    total_price,
    is_saved,
    config_json,
    stickers,
    preview_image,
  } = payload;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM customizations
     WHERE user_id = $1`,
    [userId]
  );

  const totalSavedBuilds = Number(countRes.rows[0]?.total || 0);
  if (totalSavedBuilds >= MAX_SAVED_CUSTOMIZATIONS_PER_USER) {
    throw new AppError(
      'You can only save up to 10 guitar builds. Please delete an existing build before creating a new one.',
      400
    );
  }

  const res = await pool.query(
    `INSERT INTO customizations (
      user_id, name, guitar_type, body_wood, neck_wood, fingerboard_wood,
      bridge_type, pickups, color, finish_type, total_price, is_saved,
      config_json, stickers, preview_image
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      COALESCE($13::jsonb, '{}'::jsonb),
      COALESCE($14::jsonb, '[]'::jsonb),
      $15
    )
    RETURNING *`,
    [
      userId, name, guitar_type, body_wood, neck_wood, fingerboard_wood,
      bridge_type, pickups, color, finish_type, total_price, is_saved ?? true,
      config_json ? JSON.stringify(config_json) : null,
      stickers ? JSON.stringify(stickers) : null,
      preview_image || null,
    ]
  );
  return res.rows[0];
};

exports.updateMyCustomization = async (customizationId, userId, payload) => {
  await ensureCustomizationColumns();
  const lockInfo = await getCustomizationLockInfo(customizationId, userId);

  if (lockInfo?.active_order_id) {
    throw new AppError('This custom build is already attached to an active order and can no longer be edited.', 409);
  }

  const {
    name,
    guitar_type,
    body_wood,
    neck_wood,
    fingerboard_wood,
    bridge_type,
    pickups,
    color,
    finish_type,
    total_price,
    is_saved,
    config_json,
    stickers,
    preview_image,
  } = payload;

  const res = await pool.query(
    `UPDATE customizations SET
      name             = COALESCE($1, name),
      guitar_type      = COALESCE($2, guitar_type),
      body_wood        = COALESCE($3, body_wood),
      neck_wood        = COALESCE($4, neck_wood),
      fingerboard_wood = COALESCE($5, fingerboard_wood),
      bridge_type      = COALESCE($6, bridge_type),
      pickups          = COALESCE($7, pickups),
      color            = COALESCE($8, color),
      finish_type      = COALESCE($9, finish_type),
      total_price      = COALESCE($10, total_price),
      is_saved         = COALESCE($11, is_saved),
      config_json      = COALESCE($12::jsonb, config_json),
      stickers         = COALESCE($13::jsonb, stickers),
      preview_image    = COALESCE($14, preview_image),
      updated_at       = now()
    WHERE customization_id = $15 AND user_id = $16
    RETURNING *`,
    [
      name, guitar_type, body_wood, neck_wood, fingerboard_wood, bridge_type,
      pickups, color, finish_type, total_price, is_saved,
      config_json ? JSON.stringify(config_json) : null,
      stickers ? JSON.stringify(stickers) : null,
      preview_image || null,
      customizationId, userId,
    ]
  );

  return res.rows[0] || null;
};

exports.deleteMyCustomization = async (customizationId, userId) => {
  await ensureCustomizationColumns();
  const lockInfo = await getCustomizationLockInfo(customizationId, userId);

  if (lockInfo?.active_order_id) {
    throw new AppError('This custom build is already attached to an active order and can no longer be deleted.', 409);
  }

  const res = await pool.query(
    `DELETE FROM customizations
     WHERE customization_id = $1 AND user_id = $2
     RETURNING customization_id`,
    [customizationId, userId]
  );

  return res.rows[0] || null;
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
