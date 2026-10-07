const { uploadImage } = require('./cloudinaryService');

// Deduplicate the front image shared by preview_image and _previewImages.front.
exports.storeBuildPreviews = async (config, preview) => {
  const uploads = new Map();
  const resolve = (src) => {
    if (typeof src !== 'string' || !src.startsWith('data:image/')) return Promise.resolve(src);
    if (!uploads.has(src)) {
      uploads.set(src, uploadImage(src, { folder: 'cosmoscraft_assets/build_previews' })
        .catch((error) => {
          console.warn('Preview upload failed; retaining database image:', error.message);
          return src;
        }));
    }
    return uploads.get(src);
  };
  const resolvedConfig = config ? { ...config } : config;
  if (config?._previewImages) {
    resolvedConfig._previewImages = Object.fromEntries(await Promise.all(
      Object.entries(config._previewImages).map(async ([view, src]) => [view, await resolve(src)])
    ));
  }
  return { config: resolvedConfig, preview: await resolve(preview) };
};
