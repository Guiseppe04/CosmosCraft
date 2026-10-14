OAuth remediation — 14 October 2026

Implemented behavior:

- Google initiation creates a five-minute server transaction with random state and a separate HttpOnly, host-only, SameSite=Lax browser cookie (Secure and __Host- prefixed in production). Stored values are hashes. The production cookie is deliberately not partitioned because Google returns by top-level navigation. The initiation and callback must use the same backend host and HTTPS in production.
- A single PostgreSQL statement consumes the unexpired state/browser/provider transaction and reserves the authorization-code hash. A used code is always rejected, including with a newly initiated transaction. Provider failure consumes the attempt; the user must start again. Rejections never touch session cookies.
- The callback issues no application session. It returns a one-minute opaque handoff in the URL fragment, requiring the initiating tab's private sessionStorage verifier. Atomic handoff deletion permits only one session issuance. The POST response and cookies carry the tokens; URLs contain no access or refresh token. React StrictMode and concurrent completion calls share one promise. A duplicate callback can restore an existing session, but cannot create one.
- Removed Facebook initiation/callback routes, Passport strategy, dependency and example configuration. Existing identity metadata remains for account history. Removed the unused, untrusted identity signup endpoint and its page; Google creates accounts only from its verified provider response. Facebook-only users will need an approved account recovery/linking path, not a Facebook login.
- Removed provider profile and callback error-object logging. OAuth responses use no-store and no-referrer. Application changes cannot redact hosting/CDN/APM logs that already exist.

Deployment and retained records:

1. Stop old backend workers or block both `/auth/*` and `/api/auth/*` OAuth entry points during rollout. Do not run the legacy replay guard alongside this version. Deploy the frontend and backend together; old frontend initiation lacks the required challenge and fails closed.
2. Before invalidation, preserve restricted incident evidence if needed: affected user IDs, code hashes, timestamps and session issuance times. Do not export raw tokens or authorization codes to tickets or ordinary logs. Old oauth_codes identity fields are cleared by migration 52, so capture the minimum incident mapping before running it.
3. Against the intended database, run `node server/migrations/run-migration52.js`. It wraps migration 52 in a transaction, invalidates every retained callback result, clears identity/token/error fields, and keeps code hashes as rejection tombstones. It creates the new transaction and handoff tables. Never roll back to the old guard or restore old success records.
4. Remove Facebook secrets from the hosting environment and disable the Meta application's login configuration. Secret stores and the Meta console were not accessed in this work.
5. Verify Google login on the deployed frontend/backend origins, including disabled third-party cookies, browser back/reload, a second tab, an expired transaction, and both route aliases. Verify that no code, state, verifier, handoff, token, Cookie, Authorization header, or completion body is captured by proxy/APM logging. Redact callback query strings and response Location/Set-Cookie headers at the logging layer.
6. Schedule deletion of expired rows from oauth_transactions and oauth_handoffs. Both have expiry indexes; expiry checks already deny use regardless of cleanup. Keep oauth_codes rejection tombstones, including invalidated legacy hashes.

Log exposure and session-revocation assessment:

The owner does not know whether logs were exposed. No production logs or hosting access records were available for inspection. Exposure is **unknown**, not disproven. The former success branch accepted previously consumed callback codes indefinitely while their records remained, so the provider's normal code expiry did not bound this risk. The former redirect also placed the access JWT in the frontend query string, potentially reaching access logs, browser history and telemetry. Profile logging exposed personal information; profile data alone is not proof of session theft.

Review backend ingress logs for both callback aliases, frontend requests to `/auth/success`, APM/traces, error collectors, exports, retention backups and who could access them. Check unusual callback repetitions and refresh-token creation. The current refresh table does not label the login provider, so precise session attribution may be impossible. Do not paste raw evidence into chat.

If callback codes were exposed outside the trusted boundary, revoke **all refresh sessions for the affected accounts**, including sessions minted by replays, after stopping the old guard. If the affected set cannot be bounded, an incident owner should consider revoking all sessions. Example targeted operation with a bound UUID array: `UPDATE refresh_tokens SET is_revoked = true WHERE user_id = ANY($1::uuid[]) AND is_revoked = false`. Merely clearing oauth_codes does not revoke sessions already created.

Access JWTs are stateless and remain usable until their configured expiry (default 15 minutes) despite refresh revocation. Confirm the deployed JWT_EXPIRE; if immediate access invalidation is necessary, rotate the access signing key across HTTP and socket workers and disconnect existing sockets, accepting a global logout. Rotating refresh keys is a separate global invalidation option. No sessions or signing keys were revoked or rotated here because exposure and deployment scope are unconfirmed.

Follow-up on 14 October 2026: Google login returned PostgreSQL 42P01 because the database configured in server/.env lacked oauth_transactions and oauth_handoffs. Migration 52 was applied successfully to that configured database, including invalidation of legacy callback records. Both tables were then confirmed present, and the running local server's Google initiation returned HTTP 302 to accounts.google.com with state and a browser transaction cookie. A complete Google account login was not performed. Other deployment databases still require the coordinated rollout above; this does not establish that all production environments have been migrated.

Validation:

- `node --test server/tests/oauthSecurity.test.js server/tests/authSession.test.js`: OAuth database/HTTP checks and existing JWT session lifecycle pass. PostgreSQL behavior is exercised with PGlite; Google is mocked. This is not a live provider test.
- `node --test client/tests/oauth.test.js`: browser proof, one completion request, failure handling and rejection of legacy URL tokens pass.
- From client: `node --test tests/loginRedirectBrowser.test.js tests/authSessionBrowser.test.js`: all four browser tests pass, including role redirects, duplicate completion under StrictMode, and session restoration.
- From client: `npm.cmd run build` passes with the existing large-bundle warning.
- Additional `server/tests/termsAcknowledgments.test.js` has an unrelated failure at line 113 (`body` is undefined). The same failure was reproduced with the changed server modules loaded from Git HEAD, confirming it predates this remediation. That test and its underlying terms behavior were not changed.
