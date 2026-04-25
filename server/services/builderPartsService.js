const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
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
let builderModelImagesReady = false;
let builderModelImagesPromise = null;

const BUILDER_MODEL_IMAGE_CONFIG = {
  electric: [
    { model_key: 'strat', display_name: 'Strat' },
    { model_key: 'solo', display_name: 'Solo' },
    { model_key: 'dc', display_name: 'DC' },
    { model_key: 'delos', display_name: 'Delos' },
  ],
  bass: [
    { model_key: 'vader', display_name: 'Vader' },
    { model_key: 'pb', display_name: 'Precision' },
    { model_key: 'jb', display_name: 'Jazz' },
  ],
};

const CUSTOMIZE_CATALOG_MODULES = {
  electric: {
    source: 'guitarBuilderData',
    filePath: path.resolve(__dirname, '../../client/src/app/lib/guitarBuilderData.js'),
  },
  bass: {
    source: 'bassBuilderData',
    filePath: path.resolve(__dirname, '../../client/src/app/lib/bassBuilderData.js'),
  },
};

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

const titleCase = (value) =>
  String(value || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const pickOptionImage = (option) => {
  if (!option || typeof option !== 'object') return null;
  if (option.src) return option.src;
  if (option.texture) return option.texture;
  if (option.bodySrc) return option.bodySrc;
  if (option.logo) return option.logo;
  if (option.assets && typeof option.assets === 'object') {
    return option.assets.chrome || option.assets.black || option.assets.gold || Object.values(option.assets)[0] || null;
  }
  return null;
};

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

const ensureBuilderModelImagesTable = async () => {
  if (builderModelImagesReady) return;
  if (!builderModelImagesPromise) {
    builderModelImagesPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS builder_model_images (
          model_image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          guitar_type_code VARCHAR(50) NOT NULL REFERENCES builder_guitar_types(guitar_type_code) ON DELETE CASCADE,
          model_key VARCHAR(100) NOT NULL,
          display_name VARCHAR(120) NOT NULL,
          image_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (guitar_type_code, model_key)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_builder_model_images_guitar_type
        ON builder_model_images(guitar_type_code)
      `);

      const seedRows = Object.entries(BUILDER_MODEL_IMAGE_CONFIG).flatMap(([guitarType, models]) =>
        models.map((model) => [guitarType, model.model_key, model.display_name])
      );

      for (const [guitarType, modelKey, displayName] of seedRows) {
        await pool.query(
          `INSERT INTO builder_model_images (guitar_type_code, model_key, display_name)
           VALUES ($1, $2, $3)
           ON CONFLICT (guitar_type_code, model_key) DO NOTHING`,
          [guitarType, modelKey, displayName]
        );
      }

      builderModelImagesReady = true;
    })().catch((error) => {
      builderModelImagesPromise = null;
      throw error;
    });
  }

  await builderModelImagesPromise;
};

const resolveModelDefinition = (guitarType, modelKey) => {
  const normalizedType = normalizeKey(guitarType);
  const normalizedModelKey = normalizeKey(modelKey);
  const modelConfig = BUILDER_MODEL_IMAGE_CONFIG[normalizedType] || [];
  return modelConfig.find((entry) => normalizeKey(entry.model_key) === normalizedModelKey) || null;
};

const loadCustomizeCatalogModule = async (guitarType) => {
  const normalizedType = normalizeKey(guitarType);
  const config = CUSTOMIZE_CATALOG_MODULES[normalizedType];
  if (!config) {
    throw new AppError('Invalid customize catalog type. Use "electric" or "bass".', 400);
  }

  const importedModule = await import(pathToFileURL(config.filePath).href);
  return { normalizedType, source: config.source, module: importedModule };
};

const buildElectricCustomizeSeedPayloads = (catalogSource, module) => {
  const {
    BODY_OPTIONS,
    BODY_WOOD_OPTIONS,
    BODY_FINISH_OPTIONS,
    NECK_OPTIONS,
    FRETBOARD_OPTIONS,
    HEADSTOCK_OPTIONS,
    HEADSTOCK_WOOD_OPTIONS,
    INLAY_OPTIONS,
    BRIDGE_OPTIONS,
    PICKGUARD_OPTIONS_BY_BODY,
    KNOB_OPTIONS_BY_BODY,
    HARDWARE_OPTIONS,
    PICKUP_OPTIONS,
  } = module;

  const electricBodyKeys = Object.entries(BODY_OPTIONS || {})
    .filter(([, option]) => Array.isArray(option?.types) ? option.types.includes('electric') : true)
    .map(([optionKey]) => optionKey);

  const payloads = [];
  const pushPayload = ({ name, description, typeMapping, partCategory, imageUrl, price, metadata }) => {
    payloads.push({
      name,
      description,
      guitar_type: 'electric',
      part_category: partCategory,
      folder_key: `electric/${partCategory}`,
      type_mapping: typeMapping,
      price: Number(price || 0),
      stock: 30,
      image_url: imageUrl || null,
      metadata: {
        ...(metadata || {}),
        seed_source: 'customize_catalog',
        source: catalogSource,
        import_category: 'electric_guitar',
      },
      is_active: true,
    });
  };

  const addFlatOptions = (options, config) => {
    Object.entries(options || {}).forEach(([optionKey, option]) => {
      if (optionKey === 'none') return;
      if (Array.isArray(config.allowedOptionKeys) && config.allowedOptionKeys.length > 0 && !config.allowedOptionKeys.includes(optionKey)) return;
      const label = option?.label || optionKey;
      pushPayload({
        name: `Electric ${config.label} - ${label}`,
        description: option?.note || `${config.label} option for Electric guitar builder`,
        typeMapping: config.typeMapping,
        partCategory: config.partCategory,
        imageUrl: pickOptionImage(option),
        price: option?.price || 0,
        metadata: {
          group: config.group,
          option_key: optionKey,
          option_identity: `${config.group}:${optionKey}`,
        },
      });
    });
  };

  const addNestedOptions = (options, config) => {
    Object.entries(options || {}).forEach(([variantKey, variantOptions]) => {
      if (Array.isArray(config.allowedVariants) && config.allowedVariants.length > 0 && !config.allowedVariants.includes(variantKey)) return;
      Object.entries(variantOptions || {}).forEach(([optionKey, option]) => {
        if (optionKey === 'none') return;
        const label = option?.label || optionKey;
        pushPayload({
          name: `Electric ${config.label} - ${variantKey.toUpperCase()} - ${label}`,
          description: option?.note || `${config.label} option for ${variantKey.toUpperCase()} electric`,
          typeMapping: config.typeMapping,
          partCategory: config.partCategory,
          imageUrl: pickOptionImage(option),
          price: option?.price || 0,
          metadata: {
            group: config.group,
            variant: variantKey,
            option_key: optionKey,
            option_identity: `${config.group}:${variantKey}:${optionKey}`,
          },
        });
      });
    });
  };

  addFlatOptions(BODY_OPTIONS, { label: 'Body', typeMapping: 'body', partCategory: 'body', group: 'BODY_OPTIONS', allowedOptionKeys: electricBodyKeys });
  addFlatOptions(BODY_WOOD_OPTIONS, { label: 'Body Wood', typeMapping: 'bodyWood', partCategory: 'wood_type', group: 'BODY_WOOD_OPTIONS' });
  addFlatOptions(BODY_FINISH_OPTIONS, { label: 'Body Finish', typeMapping: 'bodyFinish', partCategory: 'finish', group: 'BODY_FINISH_OPTIONS' });
  addFlatOptions(NECK_OPTIONS, { label: 'Neck', typeMapping: 'neck', partCategory: 'neck', group: 'NECK_OPTIONS' });
  addFlatOptions(FRETBOARD_OPTIONS, { label: 'Fretboard', typeMapping: 'fretboard', partCategory: 'fretboard', group: 'FRETBOARD_OPTIONS' });
  addFlatOptions(HEADSTOCK_OPTIONS, { label: 'Headstock Style', typeMapping: 'headstock', partCategory: 'misc', group: 'HEADSTOCK_OPTIONS' });
  addFlatOptions(HEADSTOCK_WOOD_OPTIONS, { label: 'Headstock Wood', typeMapping: 'headstockWood', partCategory: 'wood_type', group: 'HEADSTOCK_WOOD_OPTIONS' });
  addFlatOptions(INLAY_OPTIONS, { label: 'Inlays', typeMapping: 'inlays', partCategory: 'misc', group: 'INLAY_OPTIONS' });
  addFlatOptions(BRIDGE_OPTIONS, { label: 'Bridge', typeMapping: 'bridge', partCategory: 'bridge', group: 'BRIDGE_OPTIONS' });
  addFlatOptions(HARDWARE_OPTIONS, { label: 'Hardware', typeMapping: 'hardware', partCategory: 'hardware', group: 'HARDWARE_OPTIONS' });
  addFlatOptions(PICKUP_OPTIONS, { label: 'Pickup Set', typeMapping: 'pickups', partCategory: 'pickups', group: 'PICKUP_OPTIONS' });

  addNestedOptions(PICKGUARD_OPTIONS_BY_BODY, {
    label: 'Pickguard',
    typeMapping: 'pickguard',
    partCategory: 'pickguard',
    group: 'PICKGUARD_OPTIONS_BY_BODY',
    allowedVariants: electricBodyKeys,
  });
  addNestedOptions(KNOB_OPTIONS_BY_BODY, {
    label: 'Knobs',
    typeMapping: 'knobs',
    partCategory: 'hardware',
    group: 'KNOB_OPTIONS_BY_BODY',
    allowedVariants: electricBodyKeys,
  });

  return payloads;
};

const buildBassCustomizeSeedPayloads = (catalogSource, module) => {
  const {
    BASS_BODY_OPTIONS,
    BASS_BODY_WOOD_OPTIONS,
    BASS_BODY_FINISH_OPTIONS,
    BASS_NECK_OPTIONS,
    BASS_FRETBOARD_OPTIONS,
    BASS_HEADSTOCK_WOOD_OPTIONS,
    BASS_HEADSTOCK_STYLE_OPTIONS,
    BASS_INLAY_OPTIONS,
    BASS_HARDWARE_OPTIONS,
    BASS_PICKUP_OPTIONS,
    BASS_PICKUP_TYPE_STYLE_OPTIONS,
    BASS_PICKUP_CONFIG_OPTIONS,
    BASS_STRING_OPTIONS,
    BASS_CONTROL_PLATE_OPTIONS,
    BASS_BRIDGE_OPTIONS,
    BASS_PICKGUARD_OPTIONS,
    BASS_KNOB_OPTIONS,
    BASS_LOGO_OPTIONS,
    BASS_BACKPLATE_OPTIONS,
    BASS_PICKUP_SCREW_OPTIONS,
  } = module;

  const payloads = [];
  const pushPayload = ({ name, description, typeMapping, partCategory, imageUrl, price, metadata }) => {
    payloads.push({
      name,
      description,
      guitar_type: 'bass',
      part_category: partCategory,
      folder_key: `bass/${partCategory}`,
      type_mapping: typeMapping,
      price: Number(price || 0),
      stock: 30,
      image_url: imageUrl || null,
      metadata: {
        ...(metadata || {}),
        seed_source: 'customize_catalog',
        source: catalogSource,
        import_category: 'bass_guitar',
      },
      is_active: true,
    });
  };

  const addFlatOptions = (options, config) => {
    Object.entries(options || {}).forEach(([optionKey, option]) => {
      if (optionKey === 'none') return;
      const label = option?.label || optionKey;
      pushPayload({
        name: `Bass ${config.label} - ${label}`,
        description: option?.note || `${config.label} option for Bass builder`,
        typeMapping: config.typeMapping,
        partCategory: config.partCategory,
        imageUrl: pickOptionImage(option),
        price: option?.price || 0,
        metadata: {
          group: config.group,
          option_key: optionKey,
          option_identity: `${config.group}:${optionKey}`,
        },
      });
    });
  };

  const addNestedOptions = (options, config) => {
    Object.entries(options || {}).forEach(([variantKey, variantOptions]) => {
      Object.entries(variantOptions || {}).forEach(([optionKey, option]) => {
        if (optionKey === 'none') return;
        const label = option?.label || optionKey;
        pushPayload({
          name: `Bass ${config.label} - ${variantKey.toUpperCase()} - ${label}`,
          description: option?.note || `${config.label} option for ${variantKey.toUpperCase()} bass`,
          typeMapping: config.typeMapping,
          partCategory: config.partCategory,
          imageUrl: pickOptionImage(option),
          price: option?.price || 0,
          metadata: {
            group: config.group,
            variant: variantKey,
            option_key: optionKey,
            option_identity: `${config.group}:${variantKey}:${optionKey}`,
          },
        });
      });
    });
  };

  addFlatOptions(BASS_BODY_OPTIONS, { label: 'Body', typeMapping: 'body', partCategory: 'body', group: 'BASS_BODY_OPTIONS' });
  addFlatOptions(BASS_BODY_WOOD_OPTIONS, { label: 'Body Wood', typeMapping: 'bodyWood', partCategory: 'wood_type', group: 'BASS_BODY_WOOD_OPTIONS' });
  addFlatOptions(BASS_BODY_FINISH_OPTIONS, { label: 'Body Finish', typeMapping: 'bodyFinish', partCategory: 'finish', group: 'BASS_BODY_FINISH_OPTIONS' });
  addFlatOptions(BASS_NECK_OPTIONS, { label: 'Neck', typeMapping: 'neck', partCategory: 'neck', group: 'BASS_NECK_OPTIONS' });
  addFlatOptions(BASS_FRETBOARD_OPTIONS, { label: 'Fretboard', typeMapping: 'fretboard', partCategory: 'fretboard', group: 'BASS_FRETBOARD_OPTIONS' });
  addFlatOptions(BASS_HEADSTOCK_WOOD_OPTIONS, { label: 'Headstock Wood', typeMapping: 'headstockWood', partCategory: 'wood_type', group: 'BASS_HEADSTOCK_WOOD_OPTIONS' });
  addFlatOptions(BASS_HEADSTOCK_STYLE_OPTIONS, { label: 'Headstock Style', typeMapping: 'headstock', partCategory: 'misc', group: 'BASS_HEADSTOCK_STYLE_OPTIONS' });
  addFlatOptions(BASS_INLAY_OPTIONS, { label: 'Inlays', typeMapping: 'inlays', partCategory: 'misc', group: 'BASS_INLAY_OPTIONS' });
  addFlatOptions(BASS_HARDWARE_OPTIONS, { label: 'Hardware', typeMapping: 'hardware', partCategory: 'hardware', group: 'BASS_HARDWARE_OPTIONS' });
  addFlatOptions(BASS_PICKUP_OPTIONS, { label: 'Pickup Set', typeMapping: 'pickups', partCategory: 'pickups', group: 'BASS_PICKUP_OPTIONS' });
  addFlatOptions(BASS_PICKUP_TYPE_STYLE_OPTIONS, { label: 'Pickup Type Style', typeMapping: 'pickupTypeStyle', partCategory: 'pickups', group: 'BASS_PICKUP_TYPE_STYLE_OPTIONS' });
  addFlatOptions(BASS_PICKUP_CONFIG_OPTIONS, { label: 'Pickup Config', typeMapping: 'pickupConfig', partCategory: 'pickups', group: 'BASS_PICKUP_CONFIG_OPTIONS' });
  addFlatOptions(BASS_STRING_OPTIONS, { label: 'String Setup', typeMapping: 'strings', partCategory: 'strings', group: 'BASS_STRING_OPTIONS' });
  addFlatOptions(BASS_CONTROL_PLATE_OPTIONS, { label: 'Control Plate', typeMapping: 'controlPlate', partCategory: 'hardware', group: 'BASS_CONTROL_PLATE_OPTIONS' });

  addNestedOptions(BASS_BRIDGE_OPTIONS, { label: 'Bridge', typeMapping: 'bridge', partCategory: 'bridge', group: 'BASS_BRIDGE_OPTIONS' });
  addNestedOptions(BASS_PICKGUARD_OPTIONS, { label: 'Pickguard', typeMapping: 'pickguard', partCategory: 'pickguard', group: 'BASS_PICKGUARD_OPTIONS' });
  addNestedOptions(BASS_KNOB_OPTIONS, { label: 'Knobs', typeMapping: 'knobs', partCategory: 'hardware', group: 'BASS_KNOB_OPTIONS' });
  addNestedOptions(BASS_LOGO_OPTIONS, { label: 'Logo', typeMapping: 'logo', partCategory: 'misc', group: 'BASS_LOGO_OPTIONS' });
  addNestedOptions(BASS_BACKPLATE_OPTIONS, { label: 'Backplate', typeMapping: 'backplate', partCategory: 'misc', group: 'BASS_BACKPLATE_OPTIONS' });
  addNestedOptions(BASS_PICKUP_SCREW_OPTIONS, { label: 'Pickup Screws', typeMapping: 'pickupScrews', partCategory: 'hardware', group: 'BASS_PICKUP_SCREW_OPTIONS' });

  return payloads;
};

exports.seedCustomizeParts = async ({ guitarType }) => {
  const { normalizedType, source, module } = await loadCustomizeCatalogModule(guitarType);
  const payloads = normalizedType === 'electric'
    ? buildElectricCustomizeSeedPayloads(source, module)
    : buildBassCustomizeSeedPayloads(source, module);

  const existingRes = await pool.query(
    `SELECT *
     FROM guitar_builder_parts
     WHERE guitar_type = $1`,
    [normalizedType]
  );

  const existingBySeedIdentity = new Map();
  const existingByNameIdentity = new Map();

  for (const row of existingRes.rows) {
    const metadata = row?.metadata || {};
    const seedSource = normalizeKey(metadata.seed_source);
    const optionIdentity = normalizeKey(metadata.option_identity);
    if (seedSource === 'customize_catalog' && optionIdentity) {
      existingBySeedIdentity.set(optionIdentity, row);
    }

    const identityKey = `${normalizeKey(row.guitar_type)}|${normalizeKey(row.type_mapping)}|${normalizeKey(row.name)}`;
    if (!existingByNameIdentity.has(identityKey)) {
      existingByNameIdentity.set(identityKey, row);
    }
  }

  const stats = {
    created: 0,
    updated: 0,
    skipped: 0,
    total: payloads.length,
  };

  for (const payload of payloads) {
    const optionIdentity = normalizeKey(payload?.metadata?.option_identity);
    const nameIdentity = `${normalizeKey(payload.guitar_type)}|${normalizeKey(payload.type_mapping)}|${normalizeKey(payload.name)}`;
    const existing = existingBySeedIdentity.get(optionIdentity) || existingByNameIdentity.get(nameIdentity);

    if (existing?.part_id) {
      const updated = await exports.updatePart(existing.part_id, payload);
      if (updated) {
        stats.updated += 1;
        existingBySeedIdentity.set(optionIdentity, updated);
        existingByNameIdentity.set(nameIdentity, updated);
      } else {
        stats.skipped += 1;
      }
      continue;
    }

    const created = await exports.createPart(payload);
    stats.created += 1;
    existingBySeedIdentity.set(optionIdentity, created);
    existingByNameIdentity.set(nameIdentity, created);
  }

  return {
    guitarType: normalizedType,
    source,
    seeded: stats,
  };
};

exports.getModelImages = async ({ guitar_type } = {}) => {
  await ensureBuilderModelImagesTable();

  const params = [];
  const where = [];

  if (guitar_type) {
    params.push(normalizeKey(guitar_type));
    where.push(`guitar_type_code = $${params.length}`);
  }

  const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const res = await pool.query(
    `SELECT
       model_image_id,
       guitar_type_code AS guitar_type,
       model_key,
       display_name,
       image_url,
       created_at,
       updated_at
     FROM builder_model_images
     ${condition}
     ORDER BY guitar_type_code ASC, display_name ASC`,
    params
  );

  return res.rows;
};

exports.upsertModelImage = async ({ guitar_type, model_key, display_name, image_url }) => {
  await ensureBuilderModelImagesTable();

  const normalizedType = normalizeKey(guitar_type);
  const normalizedModelKey = normalizeKey(model_key);
  const definition = resolveModelDefinition(normalizedType, normalizedModelKey);

  if (!definition) {
    throw new AppError('Unsupported customize model image target.', 400);
  }

  const finalDisplayName = String(display_name || definition.display_name || '').trim() || definition.display_name;
  const finalImageUrl = image_url ? String(image_url).trim() : null;

  const res = await pool.query(
    `INSERT INTO builder_model_images (guitar_type_code, model_key, display_name, image_url)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (guitar_type_code, model_key)
     DO UPDATE SET
       display_name = EXCLUDED.display_name,
       image_url = EXCLUDED.image_url,
       updated_at = now()
     RETURNING
       model_image_id,
       guitar_type_code AS guitar_type,
       model_key,
       display_name,
       image_url,
       created_at,
       updated_at`,
    [normalizedType, normalizedModelKey, finalDisplayName, finalImageUrl]
  );

  return res.rows[0] || null;
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
  const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 10, 1), 500);
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
