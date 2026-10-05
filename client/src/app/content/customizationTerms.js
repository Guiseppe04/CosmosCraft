import { sharedTerms } from './sharedTerms'

export const customizationTerms = {
  id: 'customization',
  label: 'Customization Terms and Conditions',
  shortLabel: 'Customization',
  description: 'For custom guitar and bass builds commissioned through the CosmosCraft customization service.',
  summary: 'By commissioning a custom build, you agree to these Customization Terms and Conditions, including the approved specifications, payment plan, cancellation settlement process, and separately payable shipping fee.',
  sections: [
    {
      title: 'Build Specifications and Approval',
      paragraphs: [
        'Review your selected body, materials, finish, neck, hardware, electronics, additional parts, and build notes before checkout. The saved build details and any specifications confirmed with CosmosCraft form the basis of your customization.',
        'Contact CosmosCraft before production if a detail is missing or requires clarification. Digital previews illustrate your design; wood grain, colors, and finishes may vary in the finished instrument. Any material substitution or substantial specification change must be discussed with you.',
      ],
    },
    {
      title: 'Down Payment and Remaining Balance',
      paragraphs: [
        'A 50% down payment is required to start a custom build, or you may choose full payment at checkout. Payments are made through supported GCash or Bank Transfer methods and are subject to admin verification.',
        'Your selected payment plan, amount due now, and remaining balance are shown during checkout. Follow any installment schedule confirmed for your build. The remaining balance must be fully paid and verified before the completed instrument is released or shipped.',
        'Any extra materials, accessories, or specialist services requested outside the agreed build price must be quoted and approved before purchase or work begins. Additional shipping is paid separately from the build price.',
      ],
    },
    {
      title: 'Specification Changes and Additional Costs',
      paragraphs: [
        'Request changes through CosmosCraft before the affected production stage begins. Whether a change is possible depends on materials already purchased and work already completed.',
        'A change may affect the price and completion estimate. CosmosCraft will confirm the scope, additional costs, and schedule with you before carrying out an approved change.',
      ],
    },
    {
      title: 'Production Schedule and Progress Updates',
      paragraphs: [
        'Production begins after the required payment is approved and build details are confirmed. Completion dates are estimates and depend on the production queue, material availability, build complexity, and approved changes.',
        'Follow your customization project in your account for status updates and progress photos. Contact CosmosCraft about questions, additional photos, or any delay affecting your build.',
      ],
    },
    {
      title: 'Customization Cancellation and Settlement',
      paragraphs: [
        'Submit cancellation requests through the available customization or project controls in your account. Once a build has started, use the Current Build Claim or cancellation resolution process so the work and materials can be assessed.',
        'A cancellation settlement considers verified payments, materials or parts already purchased for your build, and work already completed. Review the available settlement details before confirming a resolution. A full refund is not automatic after work or procurement has begun; any settlement remains subject to applicable consumer rights.',
        'Where available, you may arrange to receive the current or unfinished build through pickup or delivery. The condition of the build and any handover requirements must be confirmed as part of the resolution. Additional delivery fees are paid separately by the customer.',
      ],
    },
    {
      title: 'Customer-Supplied Materials and Warranty',
      paragraphs: [
        'Customer-supplied wood, hardware, strings, or other materials are subject to suitability checks and acceptance by CosmosCraft. Discuss specifications and condition with us before supplying materials.',
        'Defects inherent in customer-supplied materials are not covered by the shop warranty for those materials. This does not remove responsibility for defects in CosmosCraft workmanship or any remedy required by law. Report issues with the completed build so we can assess the cause and available resolution.',
      ],
    },
    ...sharedTerms,
  ],
}
