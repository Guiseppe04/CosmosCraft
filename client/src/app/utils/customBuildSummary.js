const SUMMARY_LABELS = {
  body: 'Body',
  bodyWood: 'Body Wood',
  bodyFinish: 'Finish',
  neck: 'Neck',
  fretboard: 'Fretboard',
  headstockWood: 'Headstock',
  bridge: 'Bridge',
  pickups: 'Pickups',
  pickupConfig: 'Pickup Config',
  hardware: 'Hardware',
  strings: 'Strings',
}

const normalizeValue = (value) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

export function getCustomBuildSummaryLines(item = {}) {
  const customSource = item.customization || item
  const summary = customSource.summary || {}
  const additionalParts = Array.isArray(customSource.additionalParts) ? customSource.additionalParts : []

  const summaryLines = Object.entries(SUMMARY_LABELS)
    .map(([key, label]) => {
      const value = normalizeValue(summary[key])
      return value ? `${label}: ${value}` : null
    })
    .filter(Boolean)

  const additionalPartLines = additionalParts
    .map((part) => {
      const name = normalizeValue(part?.name)
      if (!name) return null

      const quantity = Number(part?.quantity) || 1
      return quantity > 1 ? `${name} x${quantity}` : name
    })
    .filter(Boolean)

  if (additionalPartLines.length > 0) {
    summaryLines.push(`Added Parts: ${additionalPartLines.join(', ')}`)
  }

  return summaryLines
}

export function getCustomBuildSummaryTree(item = {}) {
  const customSource = item.customization || item
  const summary = customSource.summary || {}
  const additionalParts = Array.isArray(customSource.additionalParts) ? customSource.additionalParts : []

  const configurationChildren = Object.entries(SUMMARY_LABELS)
    .map(([key, label]) => {
      const value = normalizeValue(summary[key])
      return value ? `${label}: ${value}` : null
    })
    .filter(Boolean)

  const additionalPartChildren = additionalParts
    .map((part) => {
      const name = normalizeValue(part?.name)
      if (!name) return null

      const quantity = Number(part?.quantity) || 1
      return quantity > 1 ? `${name} x${quantity}` : name
    })
    .filter(Boolean)

  return [
    configurationChildren.length > 0 ? { label: 'Configuration', children: configurationChildren } : null,
    additionalPartChildren.length > 0 ? { label: 'Added Parts', children: additionalPartChildren } : null,
  ].filter(Boolean)
}
