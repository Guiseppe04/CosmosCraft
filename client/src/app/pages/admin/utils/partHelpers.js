import {
  BUILDER_CATEGORY_MAP,
  SLOT_TO_PART_CATEGORY,
  INVENTORY_PART_CATEGORY_LABELS,
  INVENTORY_PART_CATEGORY_OPTIONS,
  TECHNICAL_TO_INVENTORY_PART_CATEGORY,
} from '../constants/adminOptions'

const normalizePartText = (value) => String(value || '').trim().toLowerCase()

export const makePartIdentityKey = (part) =>
  `${normalizePartText(part.guitar_type)}|${normalizePartText(part.type_mapping)}|${normalizePartText(part.name)}`

export const normalizeInventoryPartCategory = (value) => {
  const normalized = normalizePartText(value)
  return INVENTORY_PART_CATEGORY_LABELS[normalized] ? normalized : ''
}

export const getBuilderCategoryForTypeMapping = (typeMapping) =>
  Object.entries(BUILDER_CATEGORY_MAP).find(([, slots]) => slots.includes(typeMapping))?.[0] || ''

export const deriveInventoryPartCategory = (part = {}) => {
  const savedCategory = normalizeInventoryPartCategory(part.inventory_category || part.metadata?.inventory_category)
  if (savedCategory) return savedCategory

  const technicalCategory = normalizePartText(part.part_category || SLOT_TO_PART_CATEGORY[part.type_mapping])
  return TECHNICAL_TO_INVENTORY_PART_CATEGORY[technicalCategory] || 'accessories'
}

export const normalizeBuilderPart = (part = {}) => {
  const normalizedStock = Number(part.stock ?? part.quantity ?? 0) || 0
  return {
    ...part,
    stock: normalizedStock,
    quantity: normalizedStock,
    inventory_category: deriveInventoryPartCategory(part),
  }
}

export const INVENTORY_PART_CATEGORY_OPTIONS_WITH_LABELS = INVENTORY_PART_CATEGORY_OPTIONS
