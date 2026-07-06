export const GUITAR_CONFIGURATION_ITEMS = [
  { key: 'base', category: 'Base Price', summaryKey: null, label: 'Starting Price' },
  { key: 'body', category: 'Body', summaryKey: 'body' },
  { key: 'bodyWood', category: 'Body Wood', summaryKey: 'bodyWood' },
  { key: 'bodyFinish', category: 'Finish', summaryKey: 'bodyFinish' },
  { key: 'neck', category: 'Neck', summaryKey: 'neck' },
  { key: 'fretboard', category: 'Fretboard', summaryKey: 'fretboard' },
  { key: 'headstock', category: 'Headstock', summaryKey: 'headstock' },
  { key: 'headstockWood', category: 'Headstock Wood', summaryKey: 'headstockWood' },
  { key: 'inlays', category: 'Inlays', summaryKey: 'inlays' },
  { key: 'bridge', category: 'Bridge', summaryKey: 'bridge' },
  { key: 'pickguard', category: 'Pickguard', summaryKey: 'pickguard' },
  { key: 'knobs', category: 'Control Knobs', summaryKey: 'knobs' },
  { key: 'hardware', category: 'Hardware', summaryKey: 'hardware' },
  { key: 'pickups', category: 'Pickups', summaryKey: 'pickups' },
]

export const BASS_CONFIGURATION_ITEMS = [
  { key: 'base', category: 'Base Price', summaryKey: null, label: 'Starting Price' },
  { key: 'body', category: 'Body', summaryKey: 'body' },
  { key: 'bodyWood', category: 'Body Wood', summaryKey: 'bodyWood' },
  { key: 'bodyFinish', category: 'Finish', summaryKey: 'bodyFinish' },
  { key: 'neck', category: 'Neck', summaryKey: 'neck' },
  { key: 'fretboard', category: 'Fretboard', summaryKey: 'fretboard' },
  { key: 'headstockWood', category: 'Headstock Wood', summaryKey: 'headstockWood' },
  { key: 'headstockStyle', category: 'Headstock Style', summaryKey: 'headstockStyle' },
  { key: 'neckStyle', category: 'Neck Profile', summaryKey: 'neckStyle' },
  { key: 'inlays', category: 'Inlays', summaryKey: 'inlays' },
  { key: 'logo', category: 'Front Logo', summaryKey: 'logo' },
  { key: 'backplate', category: 'Back Plate', summaryKey: 'backplate' },
  { key: 'pickupScrews', category: 'Pickup Screws', summaryKey: 'pickupScrews' },
  { key: 'controlPlate', category: 'Control Plate', summaryKey: 'controlPlate' },
  { key: 'bridge', category: 'Bridge', summaryKey: 'bridge' },
  { key: 'pickguard', category: 'Pickguard', summaryKey: 'pickguard' },
  { key: 'knobs', category: 'Control Knobs', summaryKey: 'knobs' },
  { key: 'hardware', category: 'Hardware', summaryKey: 'hardware' },
  { key: 'pickups', category: 'Pickups', summaryKey: 'pickups' },
  { key: 'pickupTypeStyle', category: 'Pickup Style', summaryKey: 'pickupTypeStyle' },
  { key: 'pickupConfig', category: 'Pickup Configuration', summaryKey: 'pickupConfig' },
  { key: 'strings', category: 'Strings', summaryKey: 'strings' },
]

function formatPeso(amount) {
  return `₱${Number(amount || 0).toLocaleString('en-PH')}`
}

export function buildConfigurationLineItems(summary, pricingBreakdown, itemDefinitions, extraItems = []) {
  const items = itemDefinitions
    .map(({ key, category, summaryKey, label }) => {
      const unitPrice = pricingBreakdown?.[key] ?? 0
      const name =
        key === 'base'
          ? label || 'Starting Price'
          : summary?.[summaryKey] ?? summaryKey

      if (key !== 'base' && (name === undefined || name === null || name === '')) {
        return null
      }

      return {
        id: key,
        category,
        name,
        unitPrice,
        quantity: 1,
        subtotal: unitPrice,
      }
    })
    .filter(Boolean)

  return [...items, ...extraItems]
}

export { formatPeso }
