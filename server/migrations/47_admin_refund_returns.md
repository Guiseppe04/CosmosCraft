# Admin order refund returns and repayment

Run `node server/migrations/run-migration47.js` from the repository root after migrations 20, 42 and 46. The runner uses `server/.env`, applies the SQL in a transaction and rolls back on failure. Existing destination-based order refunds and specialized project/appointment workflows retain their existing behavior.

For original-channel customer requests, the admin reviews private supporting evidence and the original payment transaction, then approves a return with instructions or authorizes a documented no-return exception. Physical returns progress through Return Required, Return in Transit, Item Received and Under Inspection before Refund Approved. Inspection approval requires notes and an explicit resale suitability result. A rejection always requires a reason; an inspection rejection also requires inspection notes.

Refund Approved progresses to Refund Processing. The admin manually repays through the original channel and records payment proof and an optional transaction reference (unique when supplied). Recording payment does not complete a refund. Completion requires explicit confirmation that repayment succeeded, payment proof, a verified return or documented exception. Completion is restricted to admins under the usability update in migration 48. New refunds never prompt for a different channel or destination.

Full repayment updates payment/order statuses only after confirmation. Partial refunds retain the original amount and paid status. Returned items are not automatically restocked, even when marked suitable for resale. Original payments, return receipt, inspection, payment evidence, reference, no-return reason and status transitions are validated on the backend. Status transitions and actors are recorded in the existing audit log; customers and admins receive stored notifications, followed by authenticated socket updates after commit.

The migration expands existing status constraints and the active-order index and adds inspection/repayment fields to `refund_requests`. It creates no new tables. A partial unique index prevents reuse of a manual repayment reference by another new refund. It does not delete or rewrite existing payments, orders, refund evidence or inventory.

Validation:

```powershell
node --test server/tests/adminRefundReturns.test.js server/tests/customerRefund.test.js server/tests/orderRefundWorkflow.test.js server/tests/refundStatusSync.test.js
cd client
node --test tests/adminRefundReturnsBrowser.test.js tests/customerRefundBrowser.test.js tests/orderRefundWorkflowBrowser.test.js tests/refundRealtimeBrowser.test.js
npm run build
```

See `48_admin_refund_usability.md` for automatic review, separate no-return decisions, editable presets and private internal notes.
