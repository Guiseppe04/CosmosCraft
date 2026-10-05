import { sharedTerms } from './sharedTerms'

export const orderTerms = {
  id: 'orders',
  label: 'Order Terms and Conditions',
  shortLabel: 'Orders',
  description: 'For regular shop products, including guitar parts, accessories, strings, pickups, and other non-custom items.',
  summary: 'By placing a regular product order, you agree to these Order Terms and Conditions, including payment verification and the separately payable shipping fee.',
  sections: [
    {
      title: 'Order Details and Product Availability',
      paragraphs: [
        'Review the selected products, quantities, prices, contact details, and delivery address before placing your order. Products are subject to stock availability. Contact CosmosCraft promptly if you notice an error in your order.',
        'If an ordered item becomes unavailable, we will notify you and arrange a refund of the amount paid for that item or offer a replacement for your approval. We will not substitute an item without your agreement.',
      ],
    },
    {
      title: 'Payment and Order Processing',
      paragraphs: [
        'Orders containing only regular products require full payment through the supported GCash or Bank Transfer payment method. For a checkout that also includes a custom build, follow the payment plan and amounts shown in the checkout summary and Customization Terms. Submit accurate payment details and proof of payment through checkout.',
        'Payment proof is reviewed by the admin. Submitting proof does not automatically confirm payment. Your order proceeds to processing after the payment is approved; check your account for payment and order status updates.',
      ],
    },
    {
      title: 'Order Cancellation',
      paragraphs: [
        'You can cancel a pending order from Orders & Purchases in your account by providing a reason. If payment has been submitted, any refund is handled through the payment verification and refund review process.',
        'Once processing has started, contact CosmosCraft about cancellation or changes. A cancellation request does not automatically confirm a refund; you can track the outcome in your account.',
      ],
    },
    {
      title: 'Returns, Exchanges, and Refunds',
      paragraphs: [
        'Contact CosmosCraft if an item is defective, damaged, or different from what you ordered. Provide your order details, a description of the issue, and available supporting evidence. Keep the item and packaging for assessment and follow the return instructions provided.',
        'Eligible concerns may be resolved through repair, replacement, or refund, as applicable. Requests based only on a change of mind are subject to review. These terms do not limit remedies required by law for defective or incorrect items.',
      ],
    },
    {
      title: 'Product Care and Warranty',
      paragraphs: [
        'Use and install products according to the applicable instructions. Warranty coverage concerns manufacturing defects under normal use and any warranty terms communicated for the product.',
        'Damage caused by misuse, incorrect installation, unauthorized modification, or normal wear and tear may fall outside warranty coverage. Contact CosmosCraft for an assessment if you are unsure whether an issue is covered.',
      ],
    },
    ...sharedTerms,
  ],
}
