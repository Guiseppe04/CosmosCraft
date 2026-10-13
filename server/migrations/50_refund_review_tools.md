# Neutral refund review tools

Apply with `node server/migrations/run-migration50.js`. This additive migration preserves all refund records, amounts, eligibility rules and status transitions. It adds one `review_data` JSONB record to each existing refund request and one private singleton for policy discussion drafts. Unknown facts stay null; there are no seeded three-month, 50%, shipping-payer or processing-time defaults.

## Admin controls

Open a refund's details. The review tools work with current order refunds and historical/project refund records. Authorized admins can record receipt verification/disputes, case-specific shipping payer and arrangements, actual shipping costs and reimbursement records, an optional shipping deadline, evidenced financial inputs, and an evidence-complete milestone. Saving facts does not adjust eligibility or approve/pay a refund. Missing receipt confirmation and overdue shipping flag manual review rather than rejection.

Policy settings are drafts only. Their API always returns `active:false`, rejects activation fields, and is not consulted by eligibility, refund calculations or transitions. A later, explicitly approved implementation is required to activate confirmed policy meanings. Draft configuration remains admin-only.

Shipment-arrangement references are supplemental to the existing customer-submitted return-evidence reference. Original order delivery/receipt timestamps, outbound shipment tracking, and the approved product refund amount remain separate. Reimbursement recording documents an actual payment; it does not send money.

Material/base value and incurred labor are admin-reviewed source inputs, not inferred from builder selling prices or project-progress estimates. No financial formula is introduced. The existing payment budget checks remain authoritative when approving a monetary refund.

## Repair/rework

An admin may offer repair/rework before payment processing and while the refund is open. One pending offer is allowed at a time. Only the owning customer can accept/decline the current offer. Repeated identical responses are idempotent; a recorded response cannot be overwritten. Further offers preserve earlier offers and responses. Acceptance/decline changes no refund status or amount and creates no service or appointment. The store reviews the recorded response and arranges any service separately.

## API and privacy

- Admin-only GET/PUT `/api/orders/refund-policy-draft`.
- Admin-only PATCH `/api/orders/refund-requests/:refundId/review`.
- Admin-only POST `/api/orders/refund-requests/:refundId/repair-offer`.
- Owner-only POST `/api/orders/refund-requests/:refundId/repair-response`.
- The existing customer tracking endpoint exposes shipping arrangements and public offer/response history only. Receipt evidence, financial inputs, actor identifiers and policy drafts are excluded.

Review saves/offers use version checks, order/refund row locks, and the existing trigger-aware audit adapter. Repair responses also use locks and stale-offer checks. Closed refunds cannot be edited. Socket events contain the established refund allowlist; authorized API reads reload details after changes/reconnects. Policy drafts use atomic version checks and retain the updating admin/time.

## Validation

Run `node --test server/tests/refundReviewTools.test.js server/tests/refundTriggerAudit.test.js server/tests/adminRefundReturns.test.js server/tests/customerRefund.test.js server/tests/orderRefundWorkflow.test.js server/tests/refundStatusSync.test.js`.
From `client`, run `node --test tests/refundReviewToolsBrowser.test.js tests/adminRefundReturnsBrowser.test.js tests/customerRefundBrowser.test.js tests/orderRefundWorkflowBrowser.test.js tests/refundRealtimeBrowser.test.js` and `npm run build`.
