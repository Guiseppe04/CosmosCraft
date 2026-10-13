Apply before starting the updated server:

```powershell
node server/migrations/run-migration44.js
```

The runner uses the existing `server/.env` database configuration and applies the migration in a transaction. There is no acceptance backfill: an existing customer with no current record must explicitly accept at their next login. Staff authentication is unchanged.

`shared/termsVersions.json` is the common frontend/backend version manifest. When changing account policies, increment `account`; when changing purchase policies, increment `orders` and/or `customization`. Changes to shared purchase clauses require incrementing both purchase versions. Deploy the manifest, policy content, client and server together. Keep prior policy versions in version control for the acknowledgment audit trail.

Account acknowledgments are unique per customer and version, preserving the first acceptance context and timestamp. Automatically provisioned OAuth identities remain pending registration and cannot use protected customer APIs until acknowledgment completes registration. Checkout acknowledgments are unique per customer, checkout UUID, policy and version. Acceptance is saved before the payment modal opens, then linked to the order inside the order transaction. A consumed checkout UUID cannot authorize another order. Failed order transactions roll back the association so a valid retry can use it.

The backend requires explicit `agreed: true` and matching policy versions. Scrolling only enables the UI button; it does not record consent. Reading cannot be proven by a server; protected customer APIs enforce saved account acceptance, and both order creation paths require owned, current checkout acknowledgments for every applicable policy.

Verify with `node --test server/tests/termsAcknowledgments.test.js` and `npm run build --prefix client`.
