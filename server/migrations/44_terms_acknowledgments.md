Apply before starting the updated server:

```powershell
node server/migrations/run-migration44.js
```

The runner uses the existing `server/.env` database configuration and applies the migration in a transaction. There is no acceptance backfill. Returning users, including Google users, are not prompted again during sign-in when account policy versions change. First-time registrations with `terms_registration_pending = true` still require explicit acknowledgment. Staff authentication is unchanged.

`client/termsVersions.json` is the common frontend/backend version manifest, kept in the client deployment context so frontend builds are self-contained. When changing account policies, increment `account`; when changing purchase policies, increment `orders` and/or `customization`. Changes to shared purchase clauses require incrementing both purchase versions. Deploy the manifest, policy content, client and server together. Keep prior policy versions in version control for the acknowledgment audit trail.

Account acknowledgments are unique per customer and version, preserving the first acceptance context and timestamp. Automatically provisioned OAuth identities remain pending registration and cannot use protected customer APIs until acknowledgment completes registration. Checkout acknowledgments are unique per customer, checkout UUID, policy and version. Clicking the checkout checkbox opens the applicable terms without checking it. After scrolling and explicitly agreeing, acceptance is saved and the checkbox checks automatically; the customer then clicks Continue to Payment separately. Acceptance is linked to the order inside the order transaction. A consumed checkout UUID cannot authorize another order. Failed order transactions roll back the association so a valid retry can use it.

The backend requires explicit `agreed: true` and matching policy versions when recording acceptance. Scrolling only enables the UI button; it does not record consent. Reading cannot be proven by a server; protected customer APIs enforce completion of pending account registration, and both order creation paths require owned, current checkout acknowledgments for every applicable policy. Returning sign-in does not silently create a new acknowledgment.

Verify with `node --test server/tests/termsAcknowledgments.test.js` and `npm run build --prefix client`.
