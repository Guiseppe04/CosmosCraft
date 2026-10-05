import { orderTerms } from '../content/orderTerms'
import { customizationTerms } from '../content/customizationTerms'

export const TERMS_BY_TYPE = { orders: orderTerms, customization: customizationTerms }
export const ALL_TERMS_TYPES = ['orders', 'customization']

export function getCheckoutTermsTypes(hasRegularItems, hasCustomItems) {
  return ALL_TERMS_TYPES.filter((type) => type === 'orders' ? hasRegularItems : hasCustomItems)
}

export function hasAcceptedCheckoutTerms(types, accepted) {
  return types.length > 0 && types.every((type) => accepted[type] === true)
}
