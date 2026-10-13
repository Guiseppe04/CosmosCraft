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
      title: 'Regular Product Returns and Refunds',
      paragraphs: [
        'Submit a return or refund request for a delivered or received regular product within 14 days of receipt. If receipt confirmation is missing or the recorded date is disputed, the admin will review the actual receipt date and available evidence instead of automatically denying the request. A request submitted within the applicable window does not expire while it is being reviewed or processed.',
        'For these regular-product requests, the default refund is 50% of the requested item value covered by remaining verified payment, regardless of the selected reason. This includes damaged, incorrect, or misdescribed items and change-of-mind requests. The admin reviews the case and may adjust the amount with an explanation. The default is not automatic approval or a maximum, and the approved amount cannot exceed the requested amount or remaining verified payment.',
        'Estimated refund payment completion is 1-3 calendar days after the required evidence, return receipt and inspection have been completed, or after the required evidence and a documented no-return exception are complete. This processing estimate is separate from the 14-day submission window. Delays do not automatically reject the request or confirm that payment has been completed.',
        'Report defective, damaged, incorrect, or missing items promptly and keep the item and available packaging for assessment. The shop request window and default refund amount do not limit remedies required by applicable consumer protection laws. Contact CosmosCraft if a concern cannot be submitted through the automated request process.',
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
