import { BODY_OPTIONS } from '../../../lib/guitarBuilderData'

export const required = (label) => (value) => (!value?.toString().trim() ? `${label} is required` : null)

export const positive = (label) => (value) => (Number(value) <= 0 ? `${label} must be greater than 0` : null)

export const validate = (rules, form) => {
  const errors = {}
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const error = check(form[field], form)
      if (error) {
        errors[field] = error
        break
      }
    }
  }
  return errors
}

export const PRODUCT_RULES = {
  sku: [required('SKU')],
  name: [required('Name')],
  category_id: [required('Category')],
  price: [required('Price'), positive('Price')],
}

export const CATEGORY_RULES = {
  name: [required('Name')],
  slug: [required('Slug')],
}

export const PART_RULES = {
  name: [required('Name')],
  type_mapping: [required('Type Mapping')],
  inventory_category: [required('Category')],
}

export const PROJECT_RULES = {
  name: [required('Project Name')],
}

export const APPOINTMENT_RULES = {
  title: [required('Title')],
  date: [required('Date')],
}

export const SERVICE_RULES = {
  name: [required('Service Name')],
  price: [required('Base Price'), positive('Base Price')],
  duration: [required('Duration'), positive('Duration')],
}

export const VALID_ROLES = ['customer', 'staff', 'admin', 'super_admin']

export const GUITAR_TYPE_LABELS = {
  electric: 'Electric Guitar',
  acoustic: 'Acoustic Guitar',
  bass: 'Bass Guitar',
  ukulele: 'Ukulele',
  general: 'General Parts',
}

export const PART_CATEGORY_LABELS = {
  body: 'Body',
  neck: 'Neck',
  fretboard: 'Fretboard',
  headstock: 'Headstock',
  hardware: 'Hardware',
  bridge: 'Bridge',
  knobs: 'Knobs',
  pickups: 'Pickups',
  electronics: 'Electronics',
  tuners: 'Tuners',
  strings: 'Strings',
  pickguard: 'Pickguard',
  wood_type: 'Wood Type',
  finish: 'Finish',
  inlays: 'Inlays',
  misc: 'Miscellaneous',
}

export const PART_CATEGORIES_BY_GUITAR_TYPE = {
  electric: ['body', 'neck', 'fretboard', 'headstock', 'hardware', 'bridge', 'knobs', 'pickups', 'electronics', 'tuners', 'strings', 'pickguard', 'wood_type', 'finish', 'inlays', 'misc'],
  acoustic: ['body', 'neck', 'fretboard', 'headstock', 'hardware', 'bridge', 'knobs', 'pickups', 'electronics', 'tuners', 'strings', 'pickguard', 'wood_type', 'finish', 'inlays', 'misc'],
  bass: ['body', 'neck', 'fretboard', 'headstock', 'hardware', 'bridge', 'knobs', 'pickups', 'electronics', 'tuners', 'strings', 'pickguard', 'wood_type', 'finish', 'inlays', 'misc'],
  ukulele: ['body', 'neck', 'fretboard', 'headstock', 'hardware', 'bridge', 'knobs', 'pickups', 'electronics', 'tuners', 'strings', 'wood_type', 'finish', 'misc'],
  general: ['body', 'neck', 'fretboard', 'headstock', 'hardware', 'bridge', 'knobs', 'pickups', 'electronics', 'tuners', 'strings', 'pickguard', 'wood_type', 'finish', 'inlays', 'misc'],
}

export const BUILDER_CATEGORY_MAP = {
  pricing: ['basePrice'],
  body: ['body', 'bodyWood', 'bodyFinish', 'pickguard'],
  neck: ['neck', 'fretboard', 'headstock', 'headstockWood', 'inlays'],
  hardware: ['hardware', 'bridge', 'knobs'],
  electronics: ['pickups'],
}

export const SLOT_TO_PART_CATEGORY = {
  basePrice: 'misc',
  body: 'body',
  bodyWood: 'wood_type',
  bodyFinish: 'finish',
  pickguard: 'pickguard',
  neck: 'neck',
  fretboard: 'fretboard',
  headstock: 'misc',
  headstockWood: 'wood_type',
  inlays: 'misc',
  hardware: 'hardware',
  bridge: 'bridge',
  knobs: 'hardware',
  pickups: 'pickups',
}

export const INVENTORY_PART_CATEGORY_OPTIONS = [
  { value: 'body', label: 'Body' },
  { value: 'neck', label: 'Neck' },
  { value: 'pickups', label: 'Pickups' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'accessories', label: 'Accessories' },
]

export const INVENTORY_PART_CATEGORY_LABELS = Object.fromEntries(
  INVENTORY_PART_CATEGORY_OPTIONS.map(({ value, label }) => [value, label])
)

export const TECHNICAL_TO_INVENTORY_PART_CATEGORY = {
  body: 'body',
  neck: 'neck',
  fretboard: 'neck',
  headstock: 'neck',
  pickups: 'pickups',
  hardware: 'hardware',
  bridge: 'hardware',
  knobs: 'hardware',
  tuners: 'hardware',
  electronics: 'electronics',
  wood_type: 'accessories',
  finish: 'accessories',
  strings: 'accessories',
  pickguard: 'accessories',
  inlays: 'accessories',
  misc: 'accessories',
}

export const APPOINTMENT_BRANCH_STORAGE_KEY = 'cosmoscraft.appointment.branch'

export const DEFAULT_APPOINTMENT_BRANCH = {
  id: 'balagtas-main',
  name: 'CosmosCraft Balagtas Branch',
  address: 'Sp 047-K St Peter Compound, Balagtas, 3016 Bulacan',
  phone: '+63 000 000 0000',
  hours: 'Mon-Sat 9:00 AM - 6:00 PM',
}

export const PAGE_SIZE_OPTIONS = [10, 25, 50]

export const ELECTRIC_BODY_KEYS = Object.entries(BODY_OPTIONS || {})
  .filter(([, option]) => Array.isArray(option?.types) ? option.types.includes('electric') : true)
  .map(([bodyKey]) => bodyKey)
