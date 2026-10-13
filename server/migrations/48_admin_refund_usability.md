# Admin refund usability and privacy

Run `node server/migrations/run-migration48.js` from the repository root after migrations 47 and earlier refund migrations. This adds only an `internal_notes` column to the existing refund table. Existing customer-facing `admin_notes` and historical records remain intact.

The current admin interface:

- Starts review through the existing status API only after View Details loads successfully. Review starts are atomic and idempotent; repeated opens neither restart review nor duplicate its audit event.
- Allows admins and super admins to manage requests. Staff may read permitted details but cannot start review or approve, reject, process or complete refunds. Customers track progress and upload returns; repayment completion is an admin action.
- Uses the actual payment reference or linked order number rather than showing the internal payment UUID.
- Offers editable message presets, preserves existing text and uses database-loaded branch addresses when available. J&T is a suggestion, not a required courier.
- Records Return Not Required separately while retaining Under Review. Refund approval is a subsequent action. Pickup/drop-off returns can still progress directly from Return Required to Item Received.
- Requires at least ten letters/numbers for return instructions, rejection explanations and no-return reasons; whitespace, punctuation-only text and the literal Other placeholder are invalid. Clickable actions show field errors and focus the first invalid field. Busy and unauthorized actions remain disabled or unavailable.
- Always requires validated repayment proof and explicit admin repayment confirmation. The transaction reference is optional; supplied references retain duplicate checking. Recording proof is not completion.
- Keeps internal notes out of customer/staff responses, customer history details, notifications and socket payloads. Existing admin remarks, finalized return instructions and rejection explanations remain customer-facing.
- Reuses the existing image zoom modal for the original payment proof, including loading, missing/corrupt-image errors, retry and opening supported original URLs.

Validation uses isolated PostgreSQL fixtures, admin/customer HTTP authorization tests, desktop/tablet/mobile browser flows and real WebSocket updates. No tests create repayments in the configured live database.

## Database-managed audit compatibility

Refund mutations detect the existing `audit_record_change` trigger. On protected deployments they set transaction-local `cosmos.audit_actor_id` and `cosmos.audit_source` before business writes and verify that the trigger created a record in the same transaction. They do not insert, edit or delete protected audit history. A missing or disabled refund trigger blocks the change when audit history is protected. Deployments without database-managed auditing retain the existing application audit writer.

Customer progress reads status/return decisions from the existing history while excluding metadata-only changes and private audit details. Validate both policies with `node --test server/tests/refundTriggerAudit.test.js server/tests/adminRefundReturns.test.js server/tests/customerRefund.test.js server/tests/orderRefundWorkflow.test.js server/tests/refundStatusSync.test.js`.
