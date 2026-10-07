export const POLICY_UPDATED = 'October 7, 2026'

export const termsOfService = {
  title: 'Terms of Service',
  introduction: 'These terms explain how to use CosmosCraft’s website, customer accounts, guitar shop, customization services, appointments, and refund features. Review them before creating an account or placing a request.',
  sections: [
    { id: 'accounts', title: 'Accounts and responsible use', paragraphs: [
      'Provide accurate contact and account information and keep it current. Keep your password and verification codes private. You are responsible for activity you authorize through your account; contact the shop promptly if you suspect unauthorized access.',
      'Use the service lawfully. Do not impersonate another person, submit false payment evidence, attempt to access another customer’s information, interfere with the website, or upload unlawful or harmful material. Accounts or content may be restricted when needed to address misuse or security concerns.',
    ] },
    { id: 'orders', title: 'Products, custom builds, and appointments', paragraphs: [
      'Review your products, design selections, service schedule, quantities, prices, and delivery information before submitting. Availability, build requirements, and appointment capacity may require confirmation by the shop.',
      'Orders and custom builds have additional terms shown at checkout. Those terms describe the applicable payment plan, cancellation rules, fulfillment choices, and shipping arrangements. Review and accept the terms relevant to your purchase. Contact the shop before requesting changes to a confirmed order or build.',
    ] },
    { id: 'payments', title: 'Payments and shipping', paragraphs: [
      'Submit accurate payment details and proof through the supported payment process. Uploading proof does not by itself verify a payment; the shop reviews it before confirming the payment status.',
      'Any additional shipping fee is shouldered by the customer and paid separately. The exact fee is displayed when the shop updates an order to Shipped. Check the amount and tracking details in your account.',
    ] },
    { id: 'refunds', title: 'Cancellations, returns, and refunds', paragraphs: [
      'Cancellation and refund eligibility depend on the order or service and the applicable purchase terms. Contact the shop about damaged, defective, or incorrect items and keep available evidence and packaging for assessment. Requesting a refund does not automatically approve it.',
      'For new order refund requests, choose E-Wallet or Bank Transfer and provide a valid payment destination. An E-Wallet QR code can be used instead of typing account details. The shop reviews requests before approval and payment processing. After payment is sent, you can view its amount, reference when provided, and payment proof, and confirm receipt in your account.',
      'These terms do not remove remedies available under applicable Philippine consumer protection laws. A refund for a change of mind is subject to review; defective or incorrect goods may qualify for remedies required by law.',
    ] },
    { id: 'content', title: 'Reviews and uploaded content', paragraphs: [
      'Submit honest reviews and upload only material you own or have permission to share. Do not include another person’s private information in public reviews or photos. Reviews and feedback may be moderated before public display.',
      'CosmosCraft may use submitted content to fulfill your request, assess a concern, and display reviews or feedback through the website. Payment destinations and private refund uploads are handled as described in the Privacy Policy.',
    ] },
    { id: 'availability', title: 'Website availability and policy updates', paragraphs: [
      'Website access and live status updates can be interrupted by maintenance, connection issues, or service outages. Contact the shop if an interruption affects a time-sensitive request. Prices, availability, and schedules may change before an order is confirmed.',
      'Updated terms will be posted here with a revised date. Updates apply to future use and purchases; changes to an existing purchase must be communicated and agreed as appropriate. Nothing here excludes responsibilities or rights that cannot lawfully be excluded.',
    ] },
    { id: 'law', title: 'Questions and consumer rights', paragraphs: [
      'These terms are governed by the laws of the Philippines. Contact CosmosCraft first about a concern so the shop can review it. You may also use the complaint channels provided by the appropriate government agency.',
    ], links: [{ label: 'DTI consumer guidance and complaint information', href: 'https://ecommerce.dti.gov.ph/faqs/' }] },
  ],
}

export const privacyPolicy = {
  title: 'Privacy Policy',
  introduction: 'This policy explains the personal information CosmosCraft handles through its website and shop services, why it is used, how access is managed, and how to contact the shop about your information.',
  sections: [
    { id: 'information', title: 'Information we collect', paragraphs: [
      'Depending on the features you use, information can include your name, email, contact number, account profile, delivery address, order and customization details, appointment information, messages, reviews, photos, and feedback.',
      'Payment and refund records may include payment methods, transaction references, receipts, proof images, bank or wallet provider, account name, account or mobile number, and QR codes. If you use a connected sign-in provider, the website receives the profile information needed to create or access your account.',
      'Authentication, account activity, and transaction or audit records may include technical information needed to operate the service and investigate errors or misuse.',
    ] },
    { id: 'purposes', title: 'Why we use your information', paragraphs: [
      'We use information to create and secure accounts, verify contact details and payments, manage purchases and appointments, build customized instruments, arrange delivery or pickup, review refunds, provide support, and send account or transaction updates.',
      'Information is also used to moderate submitted content, keep transaction and audit records, resolve disputes, and meet applicable obligations. Processing depends on the purpose and applicable legal basis; accepting this policy does not waive your privacy rights.',
    ] },
    { id: 'access', title: 'Who can access information', paragraphs: [
      'Authorized shop staff can access information needed for their responsibilities. For the new order refund workflow, only authorized admins can retrieve payment destinations and customer QR uploads. Refund payment proof is available to authorized admins and to the owning customer after the refund is sent.',
      'Providers supporting hosting, database storage, media storage, email delivery, or sign-in may process information needed to provide those services. Delivery providers may receive contact and address details necessary for fulfillment. Information may also be disclosed when required by law or needed to address a lawful request.',
      'Published reviews, feedback, and their photos can be visible to other visitors. These public submissions are different from private refund QR codes and payment proof.',
    ] },
    { id: 'storage', title: 'Storage, security, and retention', paragraphs: [
      'The website uses authentication and role-based access controls. New order refund destinations and files are stored in private database tables and retrieved through access-checked requests. Live refund notifications contain status information rather than payment details or image contents.',
      'Information is retained for account operation, fulfillment, payment reconciliation, support, dispute resolution, and applicable recordkeeping obligations. Transaction and audit records or backups may remain where retention is necessary, including after information is removed from a customer-facing screen. Contact the shop about retention or deletion of a particular record.',
    ] },
    { id: 'browser', title: 'Cookies and browser storage', paragraphs: [
      'The website uses authentication cookies and browser storage to support sign-in sessions, account access, shopping features, and preferences such as the selected theme. Sign-in sessions can continue until you sign out or your credentials expire.',
      'You can manage cookies and browser storage through your browser settings. Blocking or clearing them may sign you out or prevent some account and shopping features from working.',
    ] },
    { id: 'rights', title: 'Your privacy choices and rights', paragraphs: [
      'Under applicable Philippine privacy law, you may have rights to be informed, access and correct personal information, object to certain processing, request erasure or blocking where applicable, obtain data portability where applicable, and seek redress for a privacy violation.',
      'Contact CosmosCraft to make a privacy request or report a concern. The shop may need to verify your identity before disclosing information or acting on a request. Requests are assessed against applicable law and any recordkeeping obligations. You may also contact the National Privacy Commission.',
    ], links: [{ label: 'National Privacy Commission: data subject rights', href: 'https://privacy.gov.ph/data-subject-rights/' }] },
    { id: 'changes', title: 'Policy updates', paragraphs: [
      'Changes will be posted on this page with an updated date. Review this policy when using new features or submitting personal information. Contact the shop if you need clarification about an update.',
    ] },
  ],
}
