// Keep editable designs intact when large preview captures exhaust localStorage.
export function writeSavedBuilds(storage, key, builds) {
  try {
    storage.setItem(key, JSON.stringify(builds))
    return builds
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') throw error
    const compact = builds.map(({ preview_image, preview_images, ...build }) => {
      const config = { ...build.config }
      delete config._previewImages
      return { ...build, config,
        preview_image: preview_image?.startsWith('data:') ? null : preview_image,
        preview_images: Object.fromEntries(Object.entries(preview_images || {}).filter(([, src]) => typeof src === 'string' && !src.startsWith('data:'))),
      }
    })
    storage.setItem(key, JSON.stringify(compact))
    return compact
  }
}
