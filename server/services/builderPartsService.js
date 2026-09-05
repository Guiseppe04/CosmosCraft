const syncStockToInventory = async (partId, delta) => {
  if (!partId || delta === 0) return;
  const partRes = await pool.query('SELECT product_id FROM guitar_builder_parts WHERE part_id = $1', [partId]);
  const productId = partRes.rows[0]?.product_id;
  if (!productId) return;
  await pool.query(
    `UPDATE inventory SET stock = stock + $1, updated_at = now() WHERE product_id = $2`,
    [delta, productId]
  );
};

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
    cloudinaryFolder: 'cosmoscraft_assets/customization_assets',
    importCategory: 'electric_guitar',
  },
  bass: {
    sourceDir: path.resolve(__dirname, '../../builder/bass_models'),
    cloudinaryFolder: 'cosmoscraft_assets/customization_assets',
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

const ensureBuilderModelImagesTable = async () => {
  if (builderModelImagesReady) return;
  if (builderModelImagesPromise) return builderModelImagesPromise;

  builderModelImagesPromise = (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS builder_model_images (
          model_image_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          guitar_type_code VARCHAR(50) NOT NULL REFERENCES builder_guitar_types(guitar_type_code) ON DELETE CASCADE,
          model_key VARCHAR(100) NOT NULL,
          display_name VARCHAR(120) NOT NULL,
          image_url TEXT,
          deleted_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE (guitar_type_code, model_key)
        );
      `);
      builderModelImagesReady = true;
    } catch (err) {
      console.warn('Could not create builder_model_images table (may already exist):', err.message);
      builderModelImagesReady = true;
    }
  })();

  return builderModelImagesPromise;
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

const resolveBuilderAssetRoot = (guitarType = 'electric') => {
  const normalizedType = normalizeKey(guitarType);
  if (normalizedType === 'bass') {
    return path.resolve(__dirname, '../../client/public/builder/bass_assets');
  }
  return path.resolve(__dirname, '../../client/public/builder/electric_assets');
};

const resolveSharedModelRoot = async (guitarType = 'electric') => {
  const root = resolveBuilderAssetRoot(guitarType)
  if (!fs.existsSync(root)) return null
  const entries = await fs.promises.readdir(root, { withFileTypes: true })
  const modelDirs = entries.filter(e => e.isDirectory() && e.name.endsWith('_assets'))
    .map(e => e.name)
    .sort()
  if (modelDirs.length > 0) {
    return path.join(root, modelDirs[0], 'models', 'all-models')
  }
  return null
}

const resolveModelSpecificRoot = (guitarType = 'electric', model = 'dc') => {
  const root = resolveBuilderAssetRoot(guitarType);
  const modelDir = `${model}_assets`;
  return path.join(root, modelDir, 'models', model);
};

const guessLabelFromFilename = (filename) => {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const scanFolder = async (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of files) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) {
      results.push({
        key: path.basename(entry.name, ext),
        filename: entry.name,
        label: guessLabelFromFilename(entry.name),
      });
    }
  }
  results.sort((a, b) => a.label.localeCompare(b.label));
  return results;
};

const getAssetFolderPatterns = (normalizedGroup, normalizedSubgroup, normalizedModel) => {
  const validColorFolders = ['metallics', 'transluscents', 'sparkle', 'fades', 'solids', 'bursts'];
  const model = normalizedModel || 'dc';
  switch (normalizedGroup) {
    case 'top-woods':
    case 'topwoods':
    case 'top woods':
      return ['%woods-colors/top-woods%'];
    case 'colors': {
      const folder = validColorFolders.includes(normalizedSubgroup) ? normalizedSubgroup : 'metallics';
      return [`%woods-colors/colors/${folder}%`];
    }
    case 'top-coat':
    case 'topcoat':
      return [`%models/${model}/back/shadows_highlights%`];
    case 'neck-woods':
    case 'neckwoods':
      return ['%woods-colors/neck-woods%'];
    case 'headstock-woods':
    case 'headstockwoods':
      return ['%woods-colors/headstock-woods%'];
    case 'fingerboard-woods':
    case 'fingerboardwoods':
      return ['%woods-colors/fingerboard-woods%'];
    case 'inlays':
      return ['%necks/6-string/front/24-fret-front/standard/inlays%'];
    case 'neck-rear-finish':
    case 'neckrearfinish':
      return [`%models/${model}/back/shadows_highlights%`];
    case 'backplates':
    case 'backplate':
      return [`%models/${model}/back/backplates%`];
    case 'output-jacks':
    case 'outputjacks':
      return [`%models/${model}/back/output-jacks%`];
    case 'back-strap-buttons':
    case 'backstrapbuttons':
      return [`%models/${model}/back/strap buttons%`];
    case 'string-ferrules':
    case 'stringferrules':
      return [`%models/${model}/back/string ferrules%`];
    case 'front-knobs':
    case 'frontknobs':
      return [`%models/${model}/bodies/front/knobs%`];
    case 'front-switches':
    case 'frontswitches':
      return [`%models/${model}/bodies/front/switches%`];
    case 'front-masks':
    case 'frontmasks':
      return [`%models/${model}/bodies/front/masks%`];
    case 'front-strap-buttons':
    case 'frontstrapbuttons':
      return [`%models/${model}/bodies/front/strap buttons%`];
    default:
      return [];
  }
};

const getAssetResponseKey = (normalizedGroup) => {
  switch (normalizedGroup) {
    case 'top-woods':
    case 'topwoods':
    case 'top woods':
      return 'topWoods';
    case 'colors':
      return 'finishColors';
    case 'top-coat':
    case 'topcoat':
      return 'topCoats';
    case 'neck-woods':
    case 'neckwoods':
      return 'neckWoods';
    case 'headstock-woods':
    case 'headstockwoods':
      return 'headstockWoods';
    case 'fingerboard-woods':
    case 'fingerboardwoods':
      return 'fingerboardWoods';
    case 'inlays':
      return 'inlays';
    case 'neck-rear-finish':
    case 'neckrearfinish':
      return 'neckRearFinishes';
    case 'backplates':
    case 'backplate':
      return 'backplates';
    case 'output-jacks':
    case 'outputjacks':
      return 'outputJacks';
    case 'back-strap-buttons':
    case 'backstrapbuttons':
      return 'backStrapButtons';
    case 'string-ferrules':
    case 'stringferrules':
      return 'stringFerrules';
    case 'front-knobs':
    case 'frontknobs':
      return 'frontKnobs';
    case 'front-switches':
    case 'frontswitches':
      return 'frontSwitches';
    case 'front-masks':
    case 'frontmasks':
      return 'frontMasks';
    case 'front-strap-buttons':
    case 'frontstrapbuttons':
      return 'frontStrapButtons';
    default:
      return null;
  }
};

const queryBuilderAssetRows = async (guitarType, patterns) => {
  if (!patterns || patterns.length === 0) return [];
  const params = [normalizeKey(guitarType || 'electric')];
  const conditions = patterns.map((_, index) => {
    const placeholder = `$${index + 2}`;
    return `(folder_key ILIKE ${placeholder} OR metadata->'import_source'->>'relative_path' ILIKE ${placeholder})`;
  });
  const sql = `
    SELECT part_id, name, folder_key, type_mapping, image_url, metadata
    FROM guitar_builder_parts
    WHERE guitar_type = $1
      AND is_active = true
      AND (${conditions.join(' OR ')})
  `;
  const res = await pool.query(sql, [...params, ...patterns]);
  return res.rows;
};

const buildAssetFromPartRow = (row, normalizedGroup) => {
  const importPath = row?.metadata?.import_source?.relative_path;
  let filename = null;
  if (typeof importPath === 'string' && importPath.trim()) {
    filename = path.basename(importPath.trim());
  } else if (typeof row?.image_url === 'string' && row.image_url.trim()) {
    try {
      filename = path.basename(new URL(row.image_url.trim()).pathname);
    } catch (_) {
      filename = path.basename(row.image_url.trim());
    }
  }

  const ext = filename ? path.extname(filename) : '';
  const key = filename ? path.basename(filename, ext) : normalizeKey(row.name || row.type_mapping || '');
  const label = guessLabelFromFilename(filename || row.name || key);
  const asset = {
    key,
    filename,
    label,
  };

  if (normalizedGroup === 'inlays') {
    const parts = typeof importPath === 'string' ? importPath.split('/') : [];
    const inlayIndex = parts.findIndex((part) => part === 'inlays');
    const shape = inlayIndex >= 0 && parts.length > inlayIndex + 1 ? parts[inlayIndex + 1] : null;
    let material = filename ? path.basename(filename, ext) : row.name || key;
    if (shape && material?.startsWith(shape)) {
      material = material.slice(shape.length) || material;
    }
    asset.shape = shape;
    asset.material = material;
  }

  return asset;
};

exports.listBuilderAssets = async ({ guitarType, group, subgroup, model } = {}) => {
  const normalizedType = normalizeKey(guitarType || 'electric');
  const normalizedGroup = normalizeKey(group || '');
  const normalizedSubgroup = normalizeKey(subgroup || '');
  const normalizedModel = normalizeKey(model || 'dc');
  const assets = {};

  const patterns = getAssetFolderPatterns(normalizedGroup, normalizedSubgroup, normalizedModel);
  if (patterns.length > 0) {
    try {
      const rows = await queryBuilderAssetRows(normalizedType, patterns);
      if (rows.length > 0) {
        const items = rows
          .map((row) => buildAssetFromPartRow(row, normalizedGroup))
          .sort((a, b) => String(a.label || '').localeCompare(String(b.label || '')));
        const responseKey = getAssetResponseKey(normalizedGroup);
        if (responseKey) {
          assets[responseKey] = items;
          return assets;
        }
      }
    } catch (error) {
      console.warn('Builder asset DB query failed, falling back to filesystem scan:', error?.message || error);
    }
  }

  if (normalizedGroup === 'top-woods' || normalizedGroup === 'top woods' || normalizedGroup === 'topwoods') {
    const sharedRoot = await resolveSharedModelRoot(normalizedType)
    if (!sharedRoot) return assets
    const dir = path.join(sharedRoot, 'woods-colors', 'top-woods')
    assets.topWoods = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'colors') {
    const folder = normalizedSubgroup || 'metallics'
    const validFolders = ['metallics', 'transluscents', 'sparkle', 'fades', 'solids', 'bursts']
    const targetFolder = validFolders.includes(folder) ? folder : 'metallics'
    const sharedRoot = await resolveSharedModelRoot(normalizedType)
    if (!sharedRoot) return assets
    const dir = path.join(sharedRoot, 'woods-colors', 'colors', targetFolder)
    assets.finishColors = await scanFolder(dir)
    assets.folder = targetFolder
    return assets
  }

  if (normalizedGroup === 'top-coat' || normalizedGroup === 'topcoat') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'back', 'shadows_highlights');
    assets.topCoats = await scanFolder(dir);
    return assets;
  }

  if (normalizedGroup === 'neck-woods' || normalizedGroup === 'neckwoods') {
    const sharedRoot = await resolveSharedModelRoot(normalizedType)
    if (!sharedRoot) return assets
    const dir = path.join(sharedRoot, 'woods-colors', 'neck-woods')
    assets.neckWoods = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'headstock-woods' || normalizedGroup === 'headstockwoods') {
    const sharedRoot = await resolveSharedModelRoot(normalizedType)
    if (!sharedRoot) return assets
    const dir = path.join(sharedRoot, 'woods-colors', 'headstock-woods')
    assets.headstockWoods = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'fingerboard-woods' || normalizedGroup === 'fingerboardwoods') {
    const sharedRoot = await resolveSharedModelRoot(normalizedType)
    if (!sharedRoot) return assets
    const dir = path.join(sharedRoot, 'woods-colors', 'fingerboard-woods')
    assets.fingerboardWoods = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'inlays') {
    const sharedRoot = await resolveSharedModelRoot(normalizedType)
    if (!sharedRoot) return assets
    const baseDir = path.join(sharedRoot, 'necks', '6-string', 'front', '24-fret-front', 'standard', 'inlays')
    const shapeDirs = await fs.promises.readdir(baseDir, { withFileTypes: true })
    const inlays = []
    for (const shapeDir of shapeDirs) {
      if (!shapeDir.isDirectory()) continue
      const shape = shapeDir.name
      const files = await fs.promises.readdir(path.join(baseDir, shape))
      for (const file of files) {
        const ext = path.extname(file).toLowerCase()
        if (!IMAGE_EXTENSIONS.has(ext)) continue
        const baseName = path.basename(file, ext)
        const material = baseName.startsWith(shape) ? baseName.slice(shape.length) : baseName
        const key = `${shape}-${material}`
        inlays.push({
          key,
          filename: file,
          label: `${guessLabelFromFilename(shape)} - ${guessLabelFromFilename(material)}`,
          shape,
          material,
        })
      }
    }
    inlays.sort((a, b) => a.label.localeCompare(b.label))
    assets.inlays = inlays
    return assets
  }

  if (normalizedGroup === 'neck-rear-finish' || normalizedGroup === 'neckrearfinish') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'back', 'shadows_highlights')
    assets.neckRearFinishes = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'backplates' || normalizedGroup === 'backplate') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'back', 'backplates')
    assets.backplates = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'output-jacks' || normalizedGroup === 'outputjacks') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'back', 'output-jacks')
    assets.outputJacks = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'back-strap-buttons' || normalizedGroup === 'backstrapbuttons') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'back', 'strap buttons')
    assets.backStrapButtons = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'string-ferrules' || normalizedGroup === 'stringferrules') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'back', 'string ferrules')
    assets.stringFerrules = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'front-knobs' || normalizedGroup === 'frontknobs') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'bodies', 'front', 'knobs')
    assets.frontKnobs = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'front-switches' || normalizedGroup === 'frontswitches') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'bodies', 'front', 'switches')
    assets.frontSwitches = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'front-masks' || normalizedGroup === 'frontmasks') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'bodies', 'front', 'masks')
    assets.frontMasks = await scanFolder(dir)
    return assets
  }

  if (normalizedGroup === 'front-strap-buttons' || normalizedGroup === 'frontstrapbuttons') {
    const dir = path.join(resolveModelSpecificRoot(normalizedType, normalizedModel), 'bodies', 'front', 'strap buttons')
    assets.frontStrapButtons = await scanFolder(dir)
    return assets
  }

  return assets;
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

const ELECTRIC_INVENTORY_CATEGORY_BY_GROUP = {
  BODY_OPTIONS: 'body',
  BODY_WOOD_OPTIONS: 'accessories',
  BODY_FINISH_OPTIONS: 'accessories',
  NECK_OPTIONS: 'neck',
  FRETBOARD_OPTIONS: 'neck',
  HEADSTOCK_OPTIONS: 'neck',
  HEADSTOCK_WOOD_OPTIONS: 'accessories',
  INLAY_OPTIONS: 'accessories',
  BRIDGE_OPTIONS: 'hardware',
  HARDWARE_OPTIONS: 'hardware',
  PICKUP_OPTIONS: 'pickups',
  DEXTERITY_OPTIONS: 'accessories',
  STRING_COUNT_OPTIONS: 'accessories',
  MULTISCALE_OPTIONS: 'accessories',
  SCALE_LENGTH_OPTIONS: 'accessories',
  CASE_OPTIONS: 'accessories',
  BEVEL_OPTIONS: 'accessories',
  TOP_WOOD_OPTIONS: 'accessories',
  FINISH_TYPE_OPTIONS: 'accessories',
  TOP_COAT_OPTIONS: 'accessories',
  BURST_FINISH_OPTIONS: 'accessories',
  NECK_CONSTRUCTION_OPTIONS: 'neck',
  INLAY_SHAPE_OPTIONS: 'accessories',
  INLAY_MATERIAL_OPTIONS: 'accessories',
  FRET_OPTIONS: 'neck',
  NECK_REAR_FINISH_OPTIONS: 'accessories',
  HEADSTOCK_SHAPE_OPTIONS: 'neck',
  TRUSS_ROD_COVER_OPTIONS: 'neck',
  ELECTRONICS_TYPE_OPTIONS: 'electronics',
  PICKUP_CONFIGURATION_OPTIONS: 'pickups',
  PICKUP_MODEL_BRIDGE_OPTIONS: 'pickups',
  PICKUP_MODEL_MIDDLE_OPTIONS: 'pickups',
  PICKUP_MODEL_NECK_OPTIONS: 'pickups',
  PICKUP_BOBBIN_OPTIONS: 'pickups',
  PICKUP_POLE_COLOR_OPTIONS: 'pickups',
  CONTROLS_OPTIONS: 'electronics',
  SADDLE_OPTIONS: 'hardware',
  NUT_OPTIONS: 'hardware',
  TUNING_OPTIONS: 'accessories',
  STRING_BRAND_OPTIONS: 'accessories',
  OUTPUT_JACK_OPTIONS: 'hardware',
  STRAP_BUTTON_OPTIONS: 'hardware',
  TUNER_BUTTON_OPTIONS: 'hardware',
  ELECTRONICS_CAVITY_COVER_OPTIONS: 'electronics',
  TREMOLO_COVER_OPTIONS: 'hardware',
  PICKGUARD_OPTIONS_BY_BODY: 'accessories',
  KNOB_OPTIONS_BY_BODY: 'hardware',
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
  const pushPayload = ({ name, description, typeMapping, partCategory, imageUrl, price, metadata, inventoryCategory }) => {
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
        ...(inventoryCategory ? { inventory_category: inventoryCategory } : {}),
      },
      is_active: true,
    });
  };

  const addFlatOptions = (options, config) => {
    Object.entries(options || {}).forEach(([optionKey, option]) => {
      if (Array.isArray(config.allowedOptionKeys) && config.allowedOptionKeys.length > 0 && !config.allowedOptionKeys.includes(optionKey)) return;
      const label = option?.label || optionKey;
      pushPayload({
        name: `Electric ${config.label} - ${label}`,
        description: option?.note || `${config.label} option for Electric guitar builder`,
        typeMapping: config.typeMapping,
        partCategory: config.partCategory,
        imageUrl: pickOptionImage(option),
        price: option?.price || 0,
        inventoryCategory: config.inventoryCategory || ELECTRIC_INVENTORY_CATEGORY_BY_GROUP[config.group],
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
          inventoryCategory: config.inventoryCategory || ELECTRIC_INVENTORY_CATEGORY_BY_GROUP[config.group],
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

  addFlatOptions(module.DEXTERITY_OPTIONS || {}, { label: 'Dexterity', typeMapping: 'dexterity', partCategory: 'misc', group: 'DEXTERITY_OPTIONS' });
  addFlatOptions(module.STRING_COUNT_OPTIONS || {}, { label: 'String Count', typeMapping: 'strings', partCategory: 'misc', group: 'STRING_COUNT_OPTIONS' });
  addFlatOptions(module.MULTISCALE_OPTIONS || {}, { label: 'Multiscale', typeMapping: 'multiscale', partCategory: 'misc', group: 'MULTISCALE_OPTIONS' });
  addFlatOptions(module.SCALE_LENGTH_OPTIONS || {}, { label: 'Scale Length', typeMapping: 'scaleLength', partCategory: 'misc', group: 'SCALE_LENGTH_OPTIONS' });
  addFlatOptions(module.CASE_OPTIONS || {}, { label: 'Case', typeMapping: 'case', partCategory: 'misc', group: 'CASE_OPTIONS' });
  addFlatOptions(module.BEVEL_OPTIONS || {}, { label: 'Bevel', typeMapping: 'bevel', partCategory: 'misc', group: 'BEVEL_OPTIONS' });
  addFlatOptions(module.TOP_WOOD_OPTIONS || {}, { label: 'Top Wood', typeMapping: 'topWood', partCategory: 'misc', group: 'TOP_WOOD_OPTIONS' });
  addFlatOptions(module.FINISH_TYPE_OPTIONS || {}, { label: 'Finish Type', typeMapping: 'finishType', partCategory: 'misc', group: 'FINISH_TYPE_OPTIONS' });
  addFlatOptions(module.TOP_COAT_OPTIONS || {}, { label: 'Top Coat', typeMapping: 'topCoat', partCategory: 'misc', group: 'TOP_COAT_OPTIONS' });
  addFlatOptions(module.BURST_FINISH_OPTIONS || {}, { label: 'Burst Finish', typeMapping: 'burstFinish', partCategory: 'misc', group: 'BURST_FINISH_OPTIONS' });
  addFlatOptions(module.NECK_CONSTRUCTION_OPTIONS || {}, { label: 'Neck Construction', typeMapping: 'neckConstruction', partCategory: 'misc', group: 'NECK_CONSTRUCTION_OPTIONS' });
  addFlatOptions(module.INLAY_SHAPE_OPTIONS || {}, { label: 'Inlay Shape', typeMapping: 'inlayShape', partCategory: 'misc', group: 'INLAY_SHAPE_OPTIONS' });
  addFlatOptions(module.INLAY_MATERIAL_OPTIONS || {}, { label: 'Inlay Material', typeMapping: 'inlayMaterial', partCategory: 'misc', group: 'INLAY_MATERIAL_OPTIONS' });
  addFlatOptions(module.FRET_OPTIONS || {}, { label: 'Frets', typeMapping: 'frets', partCategory: 'misc', group: 'FRET_OPTIONS' });
  addFlatOptions(module.NECK_REAR_FINISH_OPTIONS || {}, { label: 'Neck Rear Finish', typeMapping: 'neckRearFinish', partCategory: 'misc', group: 'NECK_REAR_FINISH_OPTIONS' });
  addFlatOptions(module.HEADSTOCK_SHAPE_OPTIONS || {}, { label: 'Headstock Shape', typeMapping: 'headstockShape', partCategory: 'misc', group: 'HEADSTOCK_SHAPE_OPTIONS' });
  addFlatOptions(module.TRUSS_ROD_COVER_OPTIONS || {}, { label: 'Truss Rod Cover', typeMapping: 'trussRodCover', partCategory: 'misc', group: 'TRUSS_ROD_COVER_OPTIONS' });
  addFlatOptions(module.ELECTRONICS_TYPE_OPTIONS || {}, { label: 'Electronics Type', typeMapping: 'electronicsType', partCategory: 'misc', group: 'ELECTRONICS_TYPE_OPTIONS' });
  addFlatOptions(module.PICKUP_CONFIGURATION_OPTIONS || {}, { label: 'Pickup Configuration', typeMapping: 'pickupConfiguration', partCategory: 'misc', group: 'PICKUP_CONFIGURATION_OPTIONS' });
  addFlatOptions(module.PICKUP_MODEL_BRIDGE_OPTIONS || {}, { label: 'Bridge Pickup Model', typeMapping: 'bridgePickupModel', partCategory: 'misc', group: 'PICKUP_MODEL_BRIDGE_OPTIONS' });
  addFlatOptions(module.PICKUP_MODEL_MIDDLE_OPTIONS || {}, { label: 'Middle Pickup Model', typeMapping: 'middlePickupModel', partCategory: 'misc', group: 'PICKUP_MODEL_MIDDLE_OPTIONS' });
  addFlatOptions(module.PICKUP_MODEL_NECK_OPTIONS || {}, { label: 'Neck Pickup Model', typeMapping: 'neckPickupModel', partCategory: 'misc', group: 'PICKUP_MODEL_NECK_OPTIONS' });
  addFlatOptions(module.PICKUP_BOBBIN_OPTIONS || {}, { label: 'Pickup Bobbin', typeMapping: 'pickupBobbin', partCategory: 'misc', group: 'PICKUP_BOBBIN_OPTIONS' });
  addFlatOptions(module.PICKUP_POLE_COLOR_OPTIONS || {}, { label: 'Pickup Pole Color', typeMapping: 'pickupPoleColor', partCategory: 'misc', group: 'PICKUP_POLE_COLOR_OPTIONS' });
  addFlatOptions(module.CONTROLS_OPTIONS || {}, { label: 'Controls', typeMapping: 'controls', partCategory: 'misc', group: 'CONTROLS_OPTIONS' });
  addFlatOptions(module.SADDLE_OPTIONS || {}, { label: 'Saddle', typeMapping: 'saddle', partCategory: 'misc', group: 'SADDLE_OPTIONS' });
  addFlatOptions(module.NUT_OPTIONS || {}, { label: 'Nut', typeMapping: 'nut', partCategory: 'misc', group: 'NUT_OPTIONS' });
  addFlatOptions(module.TUNING_OPTIONS || {}, { label: 'Tuning', typeMapping: 'tuning', partCategory: 'misc', group: 'TUNING_OPTIONS' });
  addFlatOptions(module.STRING_BRAND_OPTIONS || {}, { label: 'String Brand', typeMapping: 'stringBrand', partCategory: 'misc', group: 'STRING_BRAND_OPTIONS' });
  addFlatOptions(module.OUTPUT_JACK_OPTIONS || {}, { label: 'Output Jack', typeMapping: 'outputJack', partCategory: 'misc', group: 'OUTPUT_JACK_OPTIONS' });
  addFlatOptions(module.STRAP_BUTTON_OPTIONS || {}, { label: 'Strap Buttons', typeMapping: 'strapButtons', partCategory: 'misc', group: 'STRAP_BUTTON_OPTIONS' });
  addFlatOptions(module.TUNER_BUTTON_OPTIONS || {}, { label: 'Tuner Buttons', typeMapping: 'tunerButtons', partCategory: 'misc', group: 'TUNER_BUTTON_OPTIONS' });
  addFlatOptions(module.ELECTRONICS_CAVITY_COVER_OPTIONS || {}, { label: 'Electronics Cavity Cover', typeMapping: 'electronicsCavityCover', partCategory: 'misc', group: 'ELECTRONICS_CAVITY_COVER_OPTIONS' });
  addFlatOptions(module.TREMOLO_COVER_OPTIONS || {}, { label: 'Tremolo Cover', typeMapping: 'tremoloCover', partCategory: 'misc', group: 'TREMOLO_COVER_OPTIONS' });

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

exports.buildElectricCustomizeSeedPayloads = buildElectricCustomizeSeedPayloads;
exports.buildBassCustomizeSeedPayloads = buildBassCustomizeSeedPayloads;

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

const normalizePartField = (value, fallback) => {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : fallback;
};

exports.createPart = async ({ name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active }) => {
  const res = await pool.query(
    `INSERT INTO guitar_builder_parts (name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      name,
      description || null,
      normalizePartField(guitar_type, 'electric'),
      normalizePartField(part_category, 'misc'),
      folder_key || null,
      type_mapping,
      Number(price) || 0,
      Number(stock) || 0,
      image_url || null,
      metadata || null,
      is_active ?? true,
    ]
  );
  return res.rows[0];
};

exports.updatePart = async (id, { name, description, guitar_type, part_category, folder_key, type_mapping, price, stock, image_url, metadata, is_active }) => {
  const oldRes = await pool.query('SELECT stock, product_id FROM guitar_builder_parts WHERE part_id = $1', [id]);
  const oldStock = Number(oldRes.rows[0]?.stock || 0);
  const linkedProductId = oldRes.rows[0]?.product_id || null;

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
    [
      name,
      description,
      guitar_type ? normalizePartField(guitar_type, 'electric') : null,
      part_category ? normalizePartField(part_category, 'misc') : null,
      folder_key,
      type_mapping,
      price,
      stock,
      image_url,
      metadata,
      is_active,
      id,
    ]
  );
  const updated = res.rows[0] || null;

  if (updated && stock !== undefined && stock !== null && linkedProductId) {
    const newStock = Number(stock);
    const delta = newStock - oldStock;
    if (delta !== 0) {
      await pool.query(
        `UPDATE inventory SET stock = stock + $1, updated_at = now() WHERE product_id = $2`,
        [delta, linkedProductId]
      );
    }
  }

  return updated;
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
