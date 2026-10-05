import { SHIPPING_FEE_NOTE } from '../utils/shippingFee'

// Consumer remedy reference: https://fairtrade.dti.gov.ph/faq/is-no-return-no-exchange-policy-allowed/

export const sharedTerms = [
  {
    title: 'Shipping Fees and Delivery',
    paragraphs: [
      SHIPPING_FEE_NOTE,
      'The admin enters the additional shipping fee before marking your order as shipped. The amount is displayed in your order details so you can see how much to pay separately. It is not included in the order payment or customization balance shown at checkout.',
      'Provide a complete delivery address and an active contact number. Delivery estimates depend on the destination and courier and may change. Check the tracking information in your account when available. Report missing, damaged, or incorrect deliveries to CosmosCraft so we can help resolve the issue with the courier.',
    ],
  },
  {
    title: 'Consumer Rights and Applicable Law',
    paragraphs: [
      'These terms are governed by the laws of the Philippines. Nothing in these terms removes your rights or the remedies available under applicable consumer protection laws, including remedies for defective or incorrect goods.',
      'Contact CosmosCraft first to help resolve a concern. You may also use the complaint and dispute resolution channels available under Philippine law.',
    ],
  },
  {
    title: 'Policy Updates',
    paragraphs: [
      'Review the applicable terms before each checkout. Updates apply to future purchases; any changes to an existing order or customization must be communicated and agreed with the customer. If a provision is unenforceable, the remaining provisions continue to apply subject to applicable law.',
    ],
  },
]
