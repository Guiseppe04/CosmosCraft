# Order refund workflow

Migration 42 adds a reviewed workflow for **new order refund requests**. Existing order,
project and appointment refund records keep their original workflows and values.

Apply to the chosen database before enabling new refund requests:

```powershell
node server/migrations/run-migration42.js
```

The runner reads `server/.env`, applies the SQL inside a transaction and rolls back on
failure. It adds fields and private tables, expands status/method constraints and
rebuilds the active-order refund index to include review and sent stages. It does not
delete or rewrite existing orders, payments or refunds. Restart the backend and
refresh/rebuild the client after deployment. The backend DB role must own the private
tables or have permission to bypass their RLS; browser/anonymous roles have no access.

New workflow:

Requested (`pending`) → Under Review → Approved → Payment Processing (`processing`)
→ Refund Sent → Completed. Only the review stage permits rejection, with a required
customer-visible reason. The owning customer can confirm receipt after Refund Sent;
an admin can also mark it completed.

Customers must supply wallet/bank name, account name and account/mobile number unless
they upload an E-Wallet QR code. With a valid E-Wallet QR code, all three account fields
are optional. Removing it makes those fields required again. Bank refunds always
require account details. Wallet QR codes can be replaced/removed locally before submission.
Files accept PNG, JPEG and WebP up to 5 MB. Payment proof is mandatory when sending a
refund. These uploads are stored in private database tables with RLS and revoked
browser role grants. QR images and destinations are available only to admin or
super-admin roles. Proof is available to those admins and the owning customer after
the sent stage. Downloads require an authenticated API request and are never public
asset URLs. Include the private tables in protected database backups.

Amounts come from selected order items and cannot exceed remaining verified payment.
Partial refunds retain the original payment amount and paid status; the payment and
order statuses become refunded only once the verified amount is fully refunded.
Status changes use row locks, database transactions and audit records; account details
and file bytes are excluded from socket notifications and audit logs. Refunds record
manual transfers: the system does not initiate wallet/bank payments.

Refund creation, updates, withdrawals and customer confirmation publish authenticated
Socket.IO events to the owning customer and staff rooms after database commit. The
customer dashboard and admin refund list/open review re-read authorized API data on
these events and after reconnecting. Bursts are coalesced and stale list responses are
ignored. Private destinations and file contents are never carried in socket events.

Validation:

```powershell
node --test server/tests/orderRefundWorkflow.test.js server/tests/orderRefundStatus.test.js server/tests/refundStatusSync.test.js server/tests/projectRefund.test.js server/tests/appointmentRefundEligibility.test.js server/tests/orderShippingFee.test.js
cd client
node --test tests/orderRefundWorkflowBrowser.test.js tests/orderShippingFeeBrowser.test.js
node --test tests/refundRealtimeBrowser.test.js
npm run build
```

Tests use an isolated, in-memory PostgreSQL engine (PGlite) and the real refund routes,
validators, services and SQL. Only the test identity provider is substituted. Browser
tests cover 1280px and 390px widths, QR removal/replacement, mandatory proof, download
and customer confirmation. They do not connect to the configured external database.
