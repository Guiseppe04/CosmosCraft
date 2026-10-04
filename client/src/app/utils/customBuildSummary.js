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
import { GUITAR_CONFIGURATION_ITEMS, BASS_CONFIGURATION_ITEMS } from './buildConfigurationLineItems.js'

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

const humanize = (value) => String(value ?? '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, (character) => character.toUpperCase())

const getBuildData = (item = {}) => {
  const customSource = item.customization || item
  const config = parseObject(customSource.config || customSource.config_json)
  const summary = parseObject(customSource.summary || customSource.build_summary || config._walkIn?.summary)
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

const DETAIL_GROUPS = [
  ['Guitar Build', ['base', 'dexterity', 'strings', 'multiscale', 'scaleLength', 'caseType']],
  ['Body', ['body', 'bodyWood', 'bevel', 'topWood', 'threePieceBody']],
  ['Neck', ['neck', 'fingerboardRadius', 'fretboard', 'headstock', 'headstockWood', 'headstockStyle', 'headstockShape', 'neckStyle', 'neckConstruction', 'inlays', 'inlay', 'inlayShape', 'inlayMaterial', 'frets', 'trussRodCover']],
  ['Electronics', ['pickups', 'pickupConfig', 'pickupConfiguration', 'pickupTypeStyle', 'electronicsType', 'bridgePickupModel', 'middlePickupModel', 'neckPickupModel', 'pickupColor', 'pickupPoleColor', 'controls', 'knobs']],
  ['Hardware', ['bridge', 'hardware', 'pickguard', 'backplate', 'pickupScrews', 'controlPlate', 'saddle', 'nut', 'tuning', 'stringBrand', 'outputJack', 'strapButtons', 'tunerButtons', 'electronicsCavityCover', 'tremoloCover']],
  ['Finish / Design', ['bodyFinish', 'finishType', 'topCoat', 'burstFinish', 'finishColor', 'burstEdges', 'neckRearFinish', 'logo']],
]

// Keep every supplied price line while organizing it into a few readable groups.
// Legacy builds without price lines use the existing summary/configuration data.
export function getCustomBuildDetailGroups(item = {}) {
  const { customSource, config, summary, isBass } = getBuildData(item)
  const definitions = isBass ? BASS_CONFIGURATION_ITEMS : GUITAR_CONFIGURATION_ITEMS
  const breakdown = parseObject(customSource.pricingBreakdown || config._walkIn?.pricingBreakdown)
  const existingLines = customSource.lineItems || config._walkIn?.lineItems
  let lines = Array.isArray(existingLines) ? existingLines : []
  if (lines.length === 0) {
    lines = definitions.map(definition => {
      const key = definition.key === 'body' && isBass ? 'bassType' : definition.key === 'caseType' ? 'case' : definition.key
      const field = CONFIGURATION_FIELDS.find(field => field.summaryKey === definition.summaryKey)
      const fieldKey = field ? (isBass ? field.bassKey : field.guitarKey) : key
      const value = config[fieldKey]
      const options = field ? (isBass ? field.bassOptions : field.guitarOptions) : null
      const option = options?.[value] || options?.[config.bassType]?.[value] || options?.[config.body]?.[value]
      const label = summary[definition.summaryKey] || option?.label || (typeof option === 'string' ? option : null)
      const name = label || (typeof value === 'boolean' ? value ? 'Yes' : 'No' : typeof value === 'string' || typeof value === 'number' ? humanize(value) : null)
      if (!name) return null
      return { id: definition.key, category: definition.category, name, subtotal: breakdown[definition.key] }
    }).filter(Boolean)
  }
  const groups = new Map(DETAIL_GROUPS.map(([label]) => [label, []]))
  const seen = new Set()
  for (const [index, line] of lines.entries()) {
    if (!line) continue
    const id = line.id || `component-${index}`
    if (seen.has(id)) continue
    seen.add(id)
    const group = DETAIL_GROUPS.find(([, keys]) => keys.includes(line.id))?.[0]
      || (line.category === 'Stickers' ? 'Finish / Design' : 'Other Components')
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push({ ...line, id, label: line.category || humanize(line.id) || 'Component', name: String(line.name || humanize(line.id)) })
  }
  // Preserve add-ons from older saved builds as read-only order information.
  const parts = Array.isArray(customSource.additionalParts) ? customSource.additionalParts : []
  if (parts.length) groups.set('Additional Parts', parts.map((part, index) => ({
    id: `additional-${index}`, label: `Qty: ${Number(part.quantity) || 1}`, name: part.name,
    subtotal: (Number(part.price) || 0) * (Number(part.quantity) || 1),
  })))
  const stickers = Array.isArray(customSource.stickers) ? customSource.stickers : []
  if (stickers.length && !lines.some(line => line.category === 'Stickers')) {
    groups.get('Finish / Design').push({id:'stickers',label:'Stickers',name:`${stickers.length} applied`})
  }
  return [...groups].filter(([, items]) => items.length).map(([label, items]) => ({ label, items }))
}
