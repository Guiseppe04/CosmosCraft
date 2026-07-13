const cloudinary = require('cloudinary').v2;
const { AppError } = require('../middleware/errorHandler');

const ROOT_FOLDER = (process.env.CLOUDINARY_ROOT_FOLDER || 'cosmoscraft_assets').replace(/^\/+|\/+$/g, '');

let cloudinaryReady = false;

const ensureCloudinaryConfigured = () => {
  if (cloudinaryReady) return;
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasKeySet = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );
  if (!hasUrl && !hasKeySet) {
    throw new AppError('Cloudinary is not configured (CLOUDINARY_URL or CLOUDINARY_* env vars).', 500);
  }
  if (hasKeySet) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  } else if (hasUrl) {
    // Parse CLOUDINARY_URL (cloudinary://<api_key>:<api_secret>@<cloud_name>)
    const url = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({
      cloud_name: url.hostname,
      api_key: decodeURIComponent(url.username || ''),
      api_secret: decodeURIComponent(url.password || ''),
    });
  }
  cloudinaryReady = true;
};

// Always resolve a requested folder to live inside the configured root (no traversal outside it).
const resolveFolder = (folder) => {
  const requested = String(folder || '').trim().replace(/^\/+|\/+$/g, '');
  if (!requested) return ROOT_FOLDER;
  if (requested === ROOT_FOLDER) return ROOT_FOLDER;
  if (requested.startsWith(`${ROOT_FOLDER}/`)) return requested;
  return `${ROOT_FOLDER}/${requested}`.replace(/\/+/g, '/');
};

const listSubFolders = async (folder) => {
  try {
    const result = await cloudinary.api.sub_folders(folder);
    return (result.folders || []).map((f) => ({ name: f.name, path: f.path }));
  } catch (err) {
    const message = String(err?.message || '').toLowerCase();
    if (message.includes('cannot find') || message.includes('empty') || message.includes('not found')) {
      return [];
    }
    throw err;
  }
};

const browseFolder = async ({ folder = '', maxResults = 60, cursor = null } = {}) => {
  ensureCloudinaryConfigured();
  const target = resolveFolder(folder);

  const [folders, resourcesRes] = await Promise.all([
    listSubFolders(target),
    cloudinary.api.resources({
      type: 'upload',
      prefix: `${target}/`,
      max_results: Math.min(Math.max(Number(maxResults) || 60, 1), 500),
      next_cursor: cursor || undefined,
    }),
  ]);

  const images = (resourcesRes.resources || []).map((r) => ({
    public_id: r.public_id,
    secure_url: r.secure_url,
    format: r.format,
    bytes: r.bytes,
    width: r.width,
    height: r.height,
    created_at: r.created_at,
  }));

  return {
    folder: target,
    isRoot: target === ROOT_FOLDER,
    folders,
    images,
    nextCursor: resourcesRes.next_cursor || null,
  };
};

module.exports = { browseFolder, ensureCloudinaryConfigured, ROOT_FOLDER, resolveFolder };
