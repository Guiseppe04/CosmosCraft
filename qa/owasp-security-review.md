# CosmosCraft security review

Reviewed 14 October 2026 (Asia/Manila), repository commit `d20d20b`. Framework: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/).

**Result: four high-priority application vulnerabilities reproduced with isolated probes; four additional medium-severity code findings; dependency advisories requiring triage.** Address F1–F4 before a production release. Severity reflects this review's impact assessment, not a calculated CVSS score.

This was a local source review of the Express/PostgreSQL API, React authentication flow, Socket.IO, upload handling, and dependency lockfiles. No production server, database, customer account, or OAuth provider was tested. Deployment protections may reduce exposure but do not correct the code paths described here. This is not an exhaustive penetration test or OWASP certification. Application code was not changed.

## Findings

### F1 — High: consumed OAuth codes can create fresh sessions

**OWASP A07 — Authentication Failures.** Evidence: [oauthGuard.js](../server/middleware/oauthGuard.js), lines 80–98, especially 90–95.

When insertion of a code hash encounters a duplicate, the guard looks up the successful prior result and calls `setAuthCookies` for that user. It does not bind the requester to the original browser, enforce a local code expiry, or perform a new provider exchange. Anyone possessing a previously successful callback code can replay it to obtain fresh access and refresh cookies while its database record remains available. Possession of the code is required; knowing an email address alone is insufficient. The provider's single-use code enforcement is bypassed by this local success branch.

**Validation:** probe F1 supplies a synthetic successful code record and sends the same code twice with no browser session. Both requests issue new sessions without reaching provider middleware.

**Fix:** reject consumed codes; bind callback processing to a short-lived browser transaction and atomically consume it. Handle duplicate UI requests without minting another session. Invalidate retained callback records after remediation and assess whether exposed callback logs warrant session revocation.

### F2 — High: authentication and general rate limiting are disabled

**OWASP A07 / A02 — Authentication Failures / Security Misconfiguration.** Evidence: [rateLimitMiddleware.js](../server/middleware/rateLimitMiddleware.js), lines 35–38; [index.js](../server/index.js), lines 54–78.

`createRateLimiter` always returns `next()`. Both the apparent 10-attempt authentication limit and 300-request general limit are ineffective. Password login can be guessed repeatedly, and costly parsing/authentication paths lack the intended application throttling. The separate forgot-password limiter is real and is not affected by this helper.

**Validation:** probe F2 configures a one-request limit and confirms that 100 same-IP calls pass.

**Fix:** instantiate the real limiter, add account-aware login limits/backoff, use a shared store across instances, and verify proxy/IP configuration. Test that excess requests actually receive 429 responses.

### F3 — High: OTP lockout never counts incorrect guesses

**OWASP A07 — Authentication Failures.** Evidence: [userService.js](../server/services/userService.js), lines 534–578; [authController.js](../server/controllers/authController.js), lines 349–388.

The OTP lookup filters by the submitted code before looking up failed attempts. An incorrect guess returns early without inserting a failed attempt. The only inserted attempt has `success = true`, so the five-failure threshold is never reached through this path. Combined with F2, an attacker can repeatedly guess six-digit signup codes during their validity window. This compromises email-verification assurance; it is not a reset-password bypass for already-verified accounts.

**Validation:** probe F3 submits six incorrect guesses and confirms no `otp_attempts` query or lockout occurs.

**Fix:** lock the active challenge by user and purpose, compare the submitted code after loading it, persist every failure, and atomically consume/disable it at the threshold. Apply endpoint/account throttling. Replace `Math.random()` in `utils/otp.js` with `crypto.randomInt`.

### F4 — High: customers can attach payments to another customer's order

**OWASP A01 — Broken Access Control.** Evidence: [paymentController.js](../server/controllers/paymentController.js), lines 60–75; [paymentService.js](../server/services/paymentService.js), lines 233–302.

`POST /api/payments` accepts a caller-supplied order ID. The service checks existence and balance but never compares `orders.user_id` with the authenticated caller. It inserts the caller as the new payment's owner. A customer who knows another unpaid order ID can insert an active payment and block the legitimate customer's next submission. Subsequent payment reads authorize against the attacker's payment ownership and return joined order/project metadata. Knowing the target order ID and an order without an active payment are prerequisites. This does not itself mark the order paid; staff verification remains required.

**Validation:** probe F4 supplies a victim-owned order and an attacker user ID. The real service logic inserts and returns the cross-user payment.

**Fix:** enforce order ownership before reading payment history or inserting a payment. Any staff-on-behalf flow needs an explicit role/permission policy and should preserve the order owner's identity. Add an API-level two-customer regression test and transaction locking for concurrent submissions.

### F5 — Medium: private project updates are broadcast to anonymous clients

**OWASP A01 — Broken Access Control.** Evidence: [projectController.js](../server/controllers/projectController.js), lines 163–192; [socketService.js](../server/services/socketService.js), lines 135–138 and 347–353; [projectService.js](../server/services/projectService.js), lines 3010–3014.

Anonymous Socket.IO connections are accepted. Milestone and subtask handlers broadcast whole returned records to every connection, including project identifiers, task titles, notes, assignment IDs, and due dates. A guest can subscribe to `project:milestone_updated` and `project:subtask_updated` and receive other customers' updates as they occur. This is an event-stream disclosure, not access to historical records.

**Validation:** traced the controller-to-`io.emit` path and guest handshake policy; no live socket exploit was run.

**Fix:** send these events only to authorized staff and the owning customer. Build separate minimal customer/staff payloads and test that guests and unrelated customers receive nothing.

### F6 — Medium: payment receipts are served without authorization

**OWASP A01 — Broken Access Control.** Evidence: [index.js](../server/index.js), line 153; [paymentRoutes.js](../server/routes/paymentRoutes.js), lines 10–23 and 61; [paymentController.js](../server/controllers/paymentController.js), line 124.

Receipts are written beneath `server/uploads/proofs` and exposed through the unauthenticated `/uploads` static mount. Anyone with a receipt URL can retrieve it without the payment owner's session. Randomized filenames reduce discoverability but are not authorization. One proof image is also tracked by Git; its contents were not inspected, so this review does not claim that it contains real customer data.

**Validation:** traced the upload destination, generated URL, and public static mount. No customer receipt was downloaded.

**Fix:** move receipts outside public static storage and serve them through a payment-owner/staff authorization check, or use short-lived signed URLs to private storage. Review the tracked image before removing it or performing any history cleanup. Authorize the target payment before accepting file bytes and clean up files on failed requests.

### F7 — Medium: OAuth login has no browser-bound state validation

**OWASP A07 — Authentication Failures.** Evidence: [passport.js](../server/config/passport.js), lines 64–89; [authRoutes.js](../server/routes/authRoutes.js), lines 103–109 and 176–181.

Neither provider strategy enables a state store or PKCE, and initiation routes do not supply a browser-bound state value. The installed Passport OAuth2 strategy therefore uses its null state store. The single-use-code guard does not prove that the browser receiving a callback initiated that login. An attacker can initiate their own authorization and induce another browser to complete its callback, creating login CSRF/account confusion. This is separate from replaying a used code in F1.

**Validation:** inspected both strategy configurations, route options, and installed Passport state-store selection. No external provider flow was exercised.

**Fix:** use a short-lived, single-use state transaction bound to the initiating browser and provider; validate it before issuing cookies. Add PKCE where supported. Test missing, mismatched, expired, and reused state.

### F8 — Medium: refresh bearer tokens are stored in plaintext

**OWASP A04 — Cryptographic Failures.** Evidence: [generateTokens.js](../server/utils/generateTokens.js), lines 38–45 and 79–90.

The `token_hash` column contains the full refresh JWT, and verification/revocation look it up directly. Read access to this table or its backups exposes immediately usable refresh credentials until expiration/revocation. Exploitation requires database/backup disclosure; this is not a demonstrated database access vulnerability.

**Fix:** store a SHA-256 digest or keyed digest of a high-entropy refresh token and hash presented tokens for lookup. Migrate or revoke existing plaintext sessions. Consider rotation with reuse detection while preserving valid concurrent client behavior.

### F9 — Dependency advisories: prioritize remediation, validate reachability

**OWASP A03 — Software Supply Chain Failures.** Live `npm audit --omit=dev --json` completed for all three manifests. These are npm's package-level severity counts, not confirmed exploitable application findings; packages/advisories overlap between manifests.

| Manifest | Critical | High | Moderate | Low | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| server | 1 | 8 | 3 | 1 | 13 |
| client | 0 | 4 | 3 | 1 | 8 |
| root | 1 | 2 | 1 | 1 | 5 |

Evidence: [server audit](owasp-server-audit.json), [client audit](owasp-client-audit.json), [root audit](owasp-root-audit.json). Each artifact retains advisory URLs, vulnerable ranges, and npm's proposed fixes.

Prioritize server multipart parsing (`multer`), validation (`joi`), and other request-path dependencies. The critical server `proxy-addr` advisory is configuration-dependent; this review does not establish its preconditions for the deployed proxy setup. Client `xlsx` is flagged without an npm fix, but no source import of its parser was found in the client search, so package presence is not evidence of a reachable spreadsheet attack. Browser-only dependencies also do not automatically inherit Node-only SSRF exposure.

**Fix:** triage advisory preconditions against actual use, update supported versions and lockfiles, remove unused packages, and rerun functional tests and audits. Review major upgrades individually rather than applying `npm audit fix --force`. Development dependencies were excluded from these counts.

## Additional observations and coverage limits

- OAuth redirects include the access JWT in a query string (`authRoutes.js:162,229`). The client later replaces the URL, but the initial frontend request can still expose it to access logs. Replace this with a short-lived, single-use exchange bound to the browser or a cookie-based completion flow.
- Socket authentication checks JWT validity/roles only at connection time, omits the HTTP middleware's active/verified account checks, and does not expire or evict existing room memberships after role revocation. Add lifecycle tests and immediate disconnection when access changes.
- Reviewed paths use parameterized SQL and ownership checks in several other customer operations. Header tests confirm CSP, framing restrictions, production HTTPS HSTS, and sanitized server-error responses. Refresh verification checks expiry and database revocation; HTTP authentication rechecks account status and resolves roles from the database. These controls do not mitigate F1–F8.
- No confirmed SQL injection or React HTML injection is reported. Searches and sampled code tracing do not establish absence across all routes. Audit-log integrity, backup security, database TLS/RLS/privileges, deployed proxy settings, Cloudinary privacy, secret history, and business-logic races require further targeted review. No clean bill of health is claimed for OWASP categories without a finding.

## Reproduction and verification

Run `node --test qa/owasp-review-probes.cjs` from the repository root. **4/4 probes pass, meaning the documented vulnerable behavior was reproduced.** They use synthetic records and isolated dependencies, with no database or provider access. They are evidence scripts, not desired-behavior regression tests; invert their expectations when fixing the bugs.

Existing checks: `node --test server/tests/authSession.test.js server/tests/securityHeaders.test.js server/tests/passwordChange.test.js` — **8 passed, 1 failed**. The failure is the social-only password-setting response assertion at `passwordChange.test.js:109`: expected `Local password set successfully.`, actual `Password set successfully.`. This wording mismatch is not itself a security finding. These tests do not cover the replay/ownership defects above.

Recommended order: reject OAuth replay; restore throttling and correct OTP failure accounting; enforce payment ownership; restrict receipt and socket access; bind OAuth state and protect stored refresh credentials; then complete dependency triage and deployment validation.
