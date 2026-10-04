// The builders and Saved Builds actions use the browser's build format. Import
// customer-owned walk-in designs from the API so delivery works on any device.
export function readSavedBuilds(storage, key) {
  try {
    const builds = JSON.parse(storage.getItem(key) || '[]')
    return Array.isArray(builds) ? builds : []
  } catch {
    return []
  }
}

export function mergeWalkInSavedBuilds(localBuilds, customizations, userId, guitarType) {
  const received = customizations.filter(build =>
    String(build.user_id) === String(userId) && build.is_saved !== false &&
    (build.guitar_type === 'bass' ? 'bass' : 'electric') === guitarType,
  ).map(build => {
    const config = typeof build.config_json === 'string' ? JSON.parse(build.config_json) : build.config_json || {}
    return { build, config }
  }).filter(({ config }) => config._walkIn)

  const receivedIds = new Set(received.map(({ build }) => String(build.customization_id)))
  const result = localBuilds.filter(build => {
    const owner = build.config?._walkIn?.customerId
    return !owner || (String(owner) === String(userId) &&
      receivedIds.has(String(build.dbCustomizationId || build.customization_id || build.id)))
  })

  for (const { build, config } of received) {
    const index = result.findIndex(local =>
      String(local.dbCustomizationId || local.customization_id || local.id) === String(build.customization_id),
    )
    const entry = {
      ...(index >= 0 ? result[index] : {}),
      id: index >= 0 ? result[index].id : build.customization_id,
      dbCustomizationId: build.customization_id,
      customization_id: build.customization_id,
      name: build.name,
      price: Number(build.total_price) || 0,
      config,
      stickers: Array.isArray(build.stickers) ? build.stickers : [],
      preview_image: build.preview_image,
      preview_images: config._previewImages,
      summary: config._walkIn.summary || {},
      pricingBreakdown: config._walkIn.pricingBreakdown || {},
      lineItems: config._walkIn.lineItems || [],
      created_at: build.created_at,
      updated_at: build.updated_at,
      savedAt: build.created_at || build.updated_at,
      isBass: build.guitar_type === 'bass',
    }
    if (index >= 0) result[index] = entry
    else result.unshift(entry)
  }
  return result
}
