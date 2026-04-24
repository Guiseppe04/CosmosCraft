const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp']);
const IMPORT_CONFIG = {
  electric: {
    sourceDir: path.resolve(__dirname, '../../builder/electric_models'),
    cloudinaryFolder: 'cosmoscraft/electric_guitars',
    importCategory: 'electric_guitar',
  },
  bass: {
    sourceDir: path.resolve(__dirname, '../../builder/bass_models'),
    cloudinaryFolder: 'cosmoscraft/bass_guitars',
    importCategory: 'bass_guitar',
  },
};
const VALID_PART_CATEGORIES = new Set([
  'body',
  'neck',
  'fretboard',
  'bridge',
  'pickups',
  'electronics',
  'hardware',
  'tuners',
  'strings',
  'finish',
  'wood_type',
  'pickguard',
  'misc',
]);

let cloudinaryReady = false;

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const titleCase = (value) =>
  String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const inferPartCategory = (normalizedRelativePath) => {
  const checks = [
    ['pickguard', 'pickguard'],
    ['pickups', 'pickups'],
    ['pickup', 'pickups'],
    ['bridges', 'bridge'],
    ['bridge', 'bridge'],
    ['knobs', 'hardware'],
    ['headstocks', 'misc'],
    ['headstock', 'misc'],
    ['fretboard', 'fretboard'],
    ['fingerboard', 'fretboard'],
    ['necks', 'neck'],
    ['neck', 'neck'],
    ['inlays', 'misc'],
    ['inlay', 'misc'],
    ['tuners', 'tuners'],
    ['strings', 'strings'],
    ['electronics', 'electronics'],
    ['body-woods', 'wood_type'],
    ['neck-woods', 'wood_type'],
    ['headstock-woods', 'wood_type'],
    ['woods', 'wood_type'],
    ['finish', 'finish'],
    ['colors', 'finish'],
    ['body', 'body'],
  ];
  for (const [needle, category] of checks) {
    if (normalizedRelativePath.includes(`/${needle}/`) || normalizedRelativePath.endsWith(`/${needle}`)) {
      return category;
    }
  }
  return 'misc';
};

const toValidPartCategory = (value) => {
  const normalized = normalizeKey(value);
  return VALID_PART_CATEGORIES.has(normalized) ? normalized : 'misc';
};

const inferTypeMapping = (partCategory, normalizedRelativePath) => {
  if (normalizedRelativePath.includes('/headstock/') || normalizedRelativePath.includes('/headstocks/')) {
    return 'headstock';
  }
  if (normalizedRelativePath.includes('/inlay/') || normalizedRelativePath.includes('/inlays/')) {
    return 'inlays';
  }
  if (partCategory === 'wood_type') {
    if (normalizedRelativePath.includes('headstock')) return 'headstockWood';
    if (normalizedRelativePath.includes('neck')) return 'neckWood';
    if (normalizedRelativePath.includes('fretboard') || normalizedRelativePath.includes('fingerboard')) return 'fretboard';
    return 'bodyWood';
  }
  if (partCategory === 'finish') return 'bodyFinish';
  if (partCategory === 'inlays') return 'inlays';
  if (partCategory === 'bridge') return 'bridge';
  if (partCategory === 'pickups') return 'pickups';
  if (partCategory === 'pickguard') return 'pickguard';
  if (partCategory === 'knobs') return 'knobs';
  if (partCategory === 'headstock') return 'headstock';
  if (partCategory === 'fretboard') return 'fretboard';
  if (partCategory === 'neck') return 'neck';
  if (partCategory === 'body') return 'body';
  if (partCategory === 'tuners') return 'tuners';
  if (partCategory === 'strings') return 'strings';
  if (partCategory === 'electronics') return 'electronics';
  return 'misc';
};

const makeCloudinaryPublicId = (guitarType, relativePath) => {
  const normalized = normalizeKey(relativePath.replace(/\\/g, '/'));
  const hash = crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 12);
  const baseName = path
    .basename(normalized, path.extname(normalized))
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'asset';
  return `${guitarType}_${hash}_${baseName}`;
};

const listImageFilesRecursive = async (dirPath) => {
  const results = [];
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await listImageFilesRecursive(absolute);
      results.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      results.push(absolute);
    }
  }
  return results;
};

const ensureCloudinaryConfigured = () => {
  if (cloudinaryReady) return;
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasKeySet = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
  if (!hasUrl && !hasKeySet) {
    throw new AppError('Cloudinary is not configured. Set CLOUDINARY_URL or CLOUDINARY_* env vars.', 500);
  }
  if (hasKeySet) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
  cloudinaryReady = true;
};

const uploadToCloudinary = async ({ localPath, guitarType, relativePath }) => {
  const importConfig = IMPORT_CONFIG[guitarType];
  const publicId = makeCloudinaryPublicId(guitarType, relativePath);
  try {
    const uploaded = await cloudinary.uploader.upload(localPath, {
      folder: importConfig.cloudinaryFolder,
      public_id: publicId,
      overwrite: false,
      unique_filename: false,
      resource_type: 'image',
      use_filename: false,
    });
    return {
      secureUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      reused: false,
    };
  } catch (error) {
    const message = String(error?.message || '').toLowerCase();
    if (!message.includes('already exists')) {
      throw error;
    }
    const existingPublicId = `${importConfig.cloudinaryFolder}/${publicId}`;
    const existing = await cloudinary.api.resource(existingPublicId, { resource_type: 'image' });
    return {
      secureUrl: existing.secure_url,
      publicId: existing.public_id,
      reused: true,
    };
  }
};

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

exports.importPartsFromModelFolder = async ({ guitarType }) => {
  const normalizedType = normalizeKey(guitarType);
  const importConfig = IMPORT_CONFIG[normalizedType];
  if (!importConfig) {
    throw new AppError('Invalid guitar type for import. Use "electric" or "bass".', 400);
  }
  if (!fs.existsSync(importConfig.sourceDir)) {
    throw new AppError(`Import source folder not found: ${importConfig.sourceDir}`, 404);
  }

  ensureCloudinaryConfigured();

  const imageFiles = await listImageFilesRecursive(importConfig.sourceDir);
  if (imageFiles.length === 0) {
    return {
      guitarType: normalizedType,
      sourceDir: importConfig.sourceDir,
      imported: { created: 0, updated: 0, skipped: 0, failed: 0, uploaded: 0, reusedUploads: 0, totalFiles: 0 },
      countsByType: {},
    };
  }

  const existingRes = await pool.query(
    `SELECT *
     FROM guitar_builder_parts
     WHERE guitar_type = $1`,
    [normalizedType]
  );

  const existingBySourcePath = new Map();
  const existingByIdentity = new Map();

  for (const row of existingRes.rows) {
    const sourcePath = normalizeKey(row?.metadata?.import_source?.relative_path);
    if (sourcePath) existingBySourcePath.set(sourcePath, row);
    const identityKey = `${normalizeKey(row.type_mapping)}|${normalizeKey(row.part_category)}|${normalizeKey(row.name)}`;
    if (!existingByIdentity.has(identityKey)) {
      existingByIdentity.set(identityKey, row);
    }
  }

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    uploaded: 0,
    reusedUploads: 0,
    totalFiles: imageFiles.length,
  };
  const failures = [];

  for (const filePath of imageFiles) {
    const relativePath = path.relative(importConfig.sourceDir, filePath).replace(/\\/g, '/');
    const normalizedRelativePath = normalizeKey(`/${relativePath}`);
    const parsed = path.parse(relativePath);
    const category = toValidPartCategory(inferPartCategory(normalizedRelativePath));
    const typeMapping = inferTypeMapping(category, normalizedRelativePath);
    const parentName = titleCase(path.basename(parsed.dir || '').slice(0, 40));
    const baseName = titleCase(parsed.name.slice(0, 80));
    const displayName = [titleCase(normalizedType), baseName, parentName].filter(Boolean).join(' - ');
    const identityKey = `${normalizeKey(typeMapping)}|${normalizeKey(category)}|${normalizeKey(displayName)}`;

    let uploadResult;
    try {
      uploadResult = await uploadToCloudinary({
        localPath: filePath,
        guitarType: normalizedType,
        relativePath,
      });
      if (uploadResult.reused) stats.reusedUploads += 1;
      else stats.uploaded += 1;
    } catch (error) {
      stats.failed += 1;
      failures.push({ relativePath, error: error?.message || 'Cloudinary upload failed' });
      console.error(`[builder-import:${normalizedType}] Upload failed for ${relativePath}:`, error?.message || error);
      continue;
    }

    const folderKey = `${normalizedType}/${normalizeKey(parsed.dir).replace(/\\/g, '/').slice(0, 90)}`.replace(/\/+/g, '/');
    const payload = {
      name: displayName,
      description: `Imported from ${relativePath}`,
      guitar_type: normalizedType,
      part_category: category,
      folder_key: folderKey,
      type_mapping: typeMapping,
      price: 0,
      stock: 30,
      image_url: uploadResult.secureUrl,
      metadata: {
        import_category: importConfig.importCategory,
        import_source: {
          relative_path: relativePath,
          source_root: importConfig.sourceDir,
        },
        cloudinary: {
          public_id: uploadResult.publicId,
          folder: importConfig.cloudinaryFolder,
        },
      },
      is_active: true,
    };

    try {
      const existing = existingBySourcePath.get(normalizeKey(relativePath)) || existingByIdentity.get(identityKey);
      if (existing?.part_id) {
        const updated = await exports.updatePart(existing.part_id, payload);
        if (updated) {
          stats.updated += 1;
          existingBySourcePath.set(normalizeKey(relativePath), updated);
          existingByIdentity.set(identityKey, updated);
        } else {
          stats.skipped += 1;
        }
      } else {
        const created = await exports.createPart(payload);
        stats.created += 1;
        existingBySourcePath.set(normalizeKey(relativePath), created);
        existingByIdentity.set(identityKey, created);
      }
    } catch (error) {
      stats.failed += 1;
      failures.push({ relativePath, error: error?.message || 'Database upsert failed' });
      console.error(`[builder-import:${normalizedType}] Upsert failed for ${relativePath}:`, error?.message || error);
    }
  }

  const countsRes = await pool.query(
    `SELECT guitar_type, COUNT(*)::int AS total
     FROM guitar_builder_parts
     WHERE guitar_type IN ('electric', 'bass')
     GROUP BY guitar_type`
  );
  const countsByType = countsRes.rows.reduce((acc, row) => {
    acc[row.guitar_type] = Number(row.total || 0);
    return acc;
  }, {});

  console.info(
    `[builder-import:${normalizedType}] created=${stats.created} updated=${stats.updated} failed=${stats.failed} total=${stats.totalFiles}`
  );

  return {
    guitarType: normalizedType,
    sourceDir: importConfig.sourceDir,
    cloudinaryFolder: importConfig.cloudinaryFolder,
    imported: stats,
    countsByType,
    failures: failures.slice(0, 25),
  };
};
