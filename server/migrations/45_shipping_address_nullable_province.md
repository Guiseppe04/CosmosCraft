Run `node server/migrations/run-migration45.js` before deploying this address fix. This transactional, idempotent migration makes province nullable without changing existing records. The application validates province when the city belongs to a province. Region is inferred from PSGC city/province data; names remain stored in the existing columns. PSGC data: @aivangogh/ph-address 2026.2.3 (30 June 2026).

Postal validation retains exact matches from the existing ZIP dataset. Newly recognized cities (including NCR) use four-digit format validation because the package supplies only base ZIPs, not every district delivery code; the form reports this incomplete coverage.

Validation commands:

```powershell
node --test server/tests/shippingAddress.test.js server/tests/branchSettings.test.js server/tests/orderShippingFee.test.js
cd client
node --test tests/phAddress.test.js tests/shippingAddressBrowser.test.js tests/checkoutBrowser.test.js
npm run build
```
