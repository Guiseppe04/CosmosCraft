/**
 * Uploads every file under client/public/builder/ to Cloudinary,
 * preserving the exact relative folder path and filename (no hashing,
 * no flattening) so it matches what client/src/.../assetResolver.js expects:
 *
 *   local:      client/public/builder/electric_assets/dc_assets/models/dc/bodies/front/masks/bodymask.png
 *   cloudinary: cosmoscraft_assets/electric_assets/dc_assets/models/dc/bodies/front/masks/bodymask
 *               (Cloudinary appends the real extension automatically on delivery)
 *
 * Run this ONCE from your local machine (or CI) with production Cloudinary
 * credentials loaded, pointing at the same client/public/builder folder
 * you already have locally.
 *
 * Usage:
 *   CLOUDINARY_CLOUD_NAME=xxx CLOUDINARY_API_KEY=xxx CLOUDINARY_API_SECRET=xxx \
 *   node uploadBuilderAssetsToCloudinary.js
 *
 * Optional: set DRY_RUN=1 to just list what would be uploaded without uploading.
 */

const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const SOURCE_ROOT = path.resolve(__dirname, '../client/public/builder'); // adjust if needed
const CLOUDINARY_ROOT_FOLDER = 'cosmoscraft_assets';
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.bmp']);
const DRY_RUN = process.env.DRY_RUN === '1';
const CONCURRENCY = 5;

if (!DRY_RUN) {
  const hasUrl = Boolean(process.env.CLOUDINARY_URL);
  const hasKeySet = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
  if (!hasUrl && !hasKeySet) {
    console.error('Missing Cloudinary credentials. Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.');
    process.exit(1);
  }
  if (hasKeySet) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

async function listImageFilesRecursive(dirPath) {
  const results = [];
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await listImageFilesRecursive(absolute)));
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (IMAGE_EXTENSIONS.has(ext)) results.push(absolute);
  }
  return results;
}

// Cloudinary public_id must NOT include the file extension.
function toPublicId(relativePath) {
  const withoutExt = relativePath.replace(/\.[^/.]+$/, '');
  return `${CLOUDINARY_ROOT_FOLDER}/${withoutExt}`.replace(/\\/g, '/');
}

async function uploadOne(filePath, index, total) {
  const relativePath = path.relative(SOURCE_ROOT, filePath).replace(/\\/g, '/');
  const publicId = toPublicId(relativePath);

  if (DRY_RUN) {
    console.log(`[DRY RUN ${index}/${total}] ${relativePath} -> ${publicId}`);
    return { relativePath, publicId, skipped: true };
  }

  try {
    const result = await cloudinary.uploader.upload(filePath, {
      public_id: publicId,
      overwrite: true,       // safe to overwrite: same path = same asset
      unique_filename: false,
      use_filename: false,
      resource_type: 'image',
    });
    console.log(`[${index}/${total}] OK  ${relativePath} -> ${result.public_id}`);
    return { relativePath, publicId: result.public_id, url: result.secure_url };
  } catch (err) {
    console.error(`[${index}/${total}] FAIL ${relativePath}: ${err.message}`);
    return { relativePath, error: err.message };
  }
}

async function runWithConcurrency(items, worker, concurrency) {
  const results = [];
  let cursor = 0;
  async function next() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i + 1, items.length);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, next));
  return results;
}

(async () => {
  if (!fs.existsSync(SOURCE_ROOT)) {
    console.error(`Source folder not found: ${SOURCE_ROOT}`);
    process.exit(1);
  }

  const files = await listImageFilesRecursive(SOURCE_ROOT);
  console.log(`Found ${files.length} image files under ${SOURCE_ROOT}`);

  const results = await runWithConcurrency(files, uploadOne, CONCURRENCY);

  const failed = results.filter((r) => r.error);
  const succeeded = results.filter((r) => !r.error && !r.skipped);

  console.log('\n--- Summary ---');
  console.log(`Total:     ${files.length}`);
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed:    ${failed.length}`);
  if (failed.length) {
    console.log('\nFailed files:');
    failed.forEach((f) => console.log(` - ${f.relativePath}: ${f.error}`));
  }
})();