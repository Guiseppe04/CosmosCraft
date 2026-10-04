const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value

export function buildSnapshot(config, stickers = []) {
  const { _previewImages, ...design } = config || {}
  return JSON.stringify(stable({ config: design, stickers: stickers.map(sticker => {
    // These fields are recalculated by the existing placement/image hydration.
    // x/y, size, rotation, side, artwork and stacking order remain significant.
    const { bodyX, bodyY, aspectRatio, ...saved } = sticker
    return { ...saved, side: saved.side || 'front' }
  }) }))
}

export function normalizeBuildSnapshot(snapshot) {
  if (snapshot == null) return null
  try { const saved = JSON.parse(snapshot); return buildSnapshot(saved.config, saved.stickers || []) }
  catch { return snapshot }
}
