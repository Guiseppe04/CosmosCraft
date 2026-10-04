export function mapDbCartItem(item) {
  if (item.customization) {
    const build = item.customization
    const config = typeof build.config_json === 'string' ? JSON.parse(build.config_json) : build.config_json || {}
    const details = config._walkIn || {}
    return {
      id: build.customization_id, cart_item_id: item.cart_item_id,
      name: build.name || 'Custom Guitar', price: item.unit_price, quantity: item.quantity,
      stock: undefined, image: build.preview_image, type: 'customization', category: 'Custom Build',
      customization: { ...build, config, summary: details.summary || {},
        pricingBreakdown: details.pricingBreakdown || {}, lineItems: details.lineItems || [],
        baseBuildPrice: item.unit_price },
    }
  }
  return {
    id: item.product?.product_id, cart_item_id: item.cart_item_id,
    name: item.product?.name, price: item.unit_price,
    image: item.product?.image || item.product?.primary_image || '/assets/placeholder.jpg',
    stock: Number(item.product?.stock ?? 0), quantity: item.quantity, type: 'product',
  }
}
