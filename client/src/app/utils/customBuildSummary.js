import {
  BODY_OPTIONS,
  BODY_WOOD_OPTIONS,
  BODY_FINISH_OPTIONS,
  NECK_OPTIONS,
  FRETBOARD_OPTIONS,
  HEADSTOCK_WOOD_OPTIONS,
  BRIDGE_OPTIONS,
  HARDWARE_OPTIONS,
  PICKUP_OPTIONS,
  PICKUP_CONFIGURATION_OPTIONS,
  STRING_COUNT_OPTIONS,
} from '../lib/guitarBuilderData.js'
import {
  BASS_BODY_OPTIONS,
  BASS_BODY_WOOD_OPTIONS,
  BASS_BODY_FINISH_OPTIONS,
  BASS_NECK_OPTIONS,
  BASS_FRETBOARD_OPTIONS,
  BASS_HEADSTOCK_WOOD_OPTIONS,
  BASS_BRIDGE_OPTIONS,
  BASS_HARDWARE_OPTIONS,
  BASS_PICKUP_OPTIONS,
  BASS_PICKUP_CONFIG_OPTIONS,
  BASS_STRING_OPTIONS,
} from '../lib/bassBuilderData.js'

const CONFIGURATION_FIELDS = [
  { label: 'Body', summaryKey: 'body', guitarKey: 'body', bassKey: 'bassType', guitarOptions: BODY_OPTIONS, bassOptions: BASS_BODY_OPTIONS },
  { label: 'Body Wood', summaryKey: 'bodyWood', guitarKey: 'bodyWood', bassKey: 'bodyWood', guitarOptions: BODY_WOOD_OPTIONS, bassOptions: BASS_BODY_WOOD_OPTIONS },
  { label: 'Finish', summaryKey: 'bodyFinish', guitarKey: 'bodyFinish', bassKey: 'bodyFinish', guitarOptions: BODY_FINISH_OPTIONS, bassOptions: BASS_BODY_FINISH_OPTIONS },
  { label: 'Neck', summaryKey: 'neck', guitarKey: 'neck', bassKey: 'neck', guitarOptions: NECK_OPTIONS, bassOptions: BASS_NECK_OPTIONS },
  { label: 'Fretboard', summaryKey: 'fretboard', guitarKey: 'fretboard', bassKey: 'fretboard', guitarOptions: FRETBOARD_OPTIONS, bassOptions: BASS_FRETBOARD_OPTIONS },
  { label: 'Headstock', summaryKey: 'headstockWood', guitarKey: 'headstockWood', bassKey: 'headstockWood', guitarOptions: HEADSTOCK_WOOD_OPTIONS, bassOptions: BASS_HEADSTOCK_WOOD_OPTIONS },
  { label: 'Bridge', summaryKey: 'bridge', guitarKey: 'bridge', bassKey: 'bridge', guitarOptions: BRIDGE_OPTIONS, bassOptions: BASS_BRIDGE_OPTIONS },
  { label: 'Pickups', summaryKey: 'pickups', guitarKey: 'pickups', bassKey: 'pickups', guitarOptions: PICKUP_OPTIONS, bassOptions: BASS_PICKUP_OPTIONS },
  { label: 'Pickup Config', summaryKey: 'pickupConfiguration', guitarKey: 'pickupConfiguration', bassKey: 'pickupConfig', guitarOptions: PICKUP_CONFIGURATION_OPTIONS, bassOptions: BASS_PICKUP_CONFIG_OPTIONS },
  { label: 'Hardware', summaryKey: 'hardware', guitarKey: 'hardware', bassKey: 'hardware', guitarOptions: HARDWARE_OPTIONS, bassOptions: BASS_HARDWARE_OPTIONS },
  { label: 'Strings', summaryKey: 'strings', guitarKey: 'strings', bassKey: 'strings', guitarOptions: STRING_COUNT_OPTIONS, bassOptions: BASS_STRING_OPTIONS },
]

const parseObject = (value) => {
  if (typeof value !== 'string') return value && typeof value === 'object' ? value : {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

const normalizeValue = (value) => {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed || null
}

const humanize = (value) => String(value || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase())

const getBuildData = (item = {}) => {
  const customSource = item.customization || item
  const config = parseObject(customSource.config || customSource.config_json)
  const summary = parseObject(customSource.summary || customSource.build_summary)
  const isBass = String(customSource.guitar_type || config.guitarType || '').toLowerCase().includes('bass') || Boolean(config.bassType)
  return { customSource, config, summary, isBass }
}

const getConfigurationChildren = (item = {}) => {
  const { config, summary, isBass } = getBuildData(item)
  return CONFIGURATION_FIELDS.map((field) => {
    const configKey = isBass ? field.bassKey : field.guitarKey
    const configValue = config[configKey]
    const summaryValue = normalizeValue(summary[field.summaryKey])
    if (configValue === undefined || configValue === null || configValue === '') {
      return summaryValue ? `${field.label}: ${summaryValue}` : null
    }

    const options = isBass ? field.bassOptions : field.guitarOptions
    const option = options?.[configValue] || options?.[config.bassType]?.[configValue] || options?.[config.body]?.[configValue]
    const label = typeof option === 'string' ? option : option?.label
    return `${field.label}: ${normalizeValue(label) || summaryValue || humanize(configValue)}`
  }).filter(Boolean)
}

const getAdditionalPartLines = (customSource) => {
  const additionalParts = Array.isArray(customSource.additionalParts) ? customSource.additionalParts : []
  return additionalParts
    .map((part) => {
      const name = normalizeValue(part?.name)
      if (!name) return null
      const quantity = Number(part?.quantity) || 1
      return quantity > 1 ? `${name} x${quantity}` : name
    })
    .filter(Boolean)
}

export function getCustomBuildSummaryLines(item = {}) {
  const { customSource } = getBuildData(item)
  const summaryLines = getConfigurationChildren(item)
  const additionalPartLines = getAdditionalPartLines(customSource)

  if (additionalPartLines.length > 0) {
    summaryLines.push(`Added Parts: ${additionalPartLines.join(', ')}`)
  }

  return summaryLines
}

export function getCustomBuildSummaryTree(item = {}) {
  const { customSource } = getBuildData(item)
  const configurationChildren = getConfigurationChildren(item)
  const additionalPartChildren = getAdditionalPartLines(customSource)

  return [
    configurationChildren.length > 0 ? { label: 'Configuration', children: configurationChildren } : null,
    additionalPartChildren.length > 0 ? { label: 'Added Parts', children: additionalPartChildren } : null,
  ].filter(Boolean)
}
