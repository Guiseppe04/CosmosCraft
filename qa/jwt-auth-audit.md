# JWT authentication audit — October 11, 2026

## Root cause and evidence

Confirmed logout paths existed in the code:

- `client/src/app/services/api.js:fetchAPI` deleted credentials and redirected on every 401 without attempting refresh. This also applied to failed login credentials. There was no Axios auth interceptor; Axios is used for builder catalog requests.
- `AuthContext:verifyAuth` skipped the server check when localStorage lacked a user/token, even if a valid HttpOnly refresh cookie remained.
- `middleware/auth.js:tryRefreshToken` swallowed database and token-generation failures. Optional `/auth/check` then reported an unauthenticated session, causing AuthContext to clear local credentials. Its asynchronous JWT callback also left database failures outside the outer error handler.

The original server already attempted automatic refresh when the access token was missing or expired and a refresh credential was received. Thus access expiration alone should have worked with a valid cookie and healthy database. The specific production incident remains unconfirmed: no production browser cookie trace, deployment environment snapshot, or incident logs were available. Blocking/omitting the refresh cookie is still a possible trigger for the old unconditional logout path.

## Actual flow and affected functions

| Stage | Files / functions | Behavior after fixes |
|---|---|---|
| Registration | `server/controllers/authController.js:emailSignup`, `verifyEmailOTP`, `oauthSignup` | Email registration requires verification; successful OTP verification and OAuth signup issue credentials. |
| Login | `authController:emailLogin`; `server/routes/authRoutes.js` OAuth callbacks | Validate account/password or provider; get current backend role; generate access and refresh JWTs; insert refresh session; deliver HttpOnly cookies. Email login/OTP also return tokens in JSON; OAuth returns access token in the redirect URL. |
| Token issue | `server/utils/generateTokens.js:generateAccessToken`, `generateTokens` | Access signed with JWT_SECRET; refresh signed with JWT_REFRESH_SECRET and random jti. Database expiry comes from the issued refresh JWT's exp. Database insert must succeed before credentials are returned. |
| Storage | `refresh_tokens`; `client/src/app/utils/apiConfig.js` | Refresh cookie plus database record; the existing token_hash column contains the raw JWT, not a digest. Access token also uses localStorage keys cosmoscraft_token and authToken. |
| Access verification | `server/middleware/auth.js:handleAuth` | Cookie first, then Bearer/x-access-token. Verify signature/expiry, active/verified account and current database role/permissions. Terms and endpoint authorization remain enforced. |
| Refresh verification | `generateTokens.js:verifyRefreshToken`; `authController:refreshAccessToken` | Check refresh signature/expiry using its own secret, matching database user, expiry and revocation. Endpoint also checks active/verified account. Invalid sessions return 401; infrastructure failures remain server errors. |
| Automatic renewal | `auth.js:tryRefreshToken` | On missing/expired access with refresh credential, issue access only, set access cookie and X-New-Access-Token, and continue original request. Current backend role is used rather than stale refresh-token role. |
| Frontend renewal | New `client/src/app/utils/authFetch.js:authFetch`, used by `services/api.js`, `utils/adminApi.js`, `context/AuthContext.jsx` | Capture automatic renewal header. On protected 401, coordinate one POST /auth/refresh with credentials, update local access token, retry once with new Bearer token. Login/OTP/logout/refresh endpoints are excluded. Refresh 401/403 clears context via an event; network/429/5xx failures preserve credentials. Other raw fetch callers continue to use existing server automatic renewal. |
| Reload | `AuthContext:fetchUser`, mount effect; existing `ProtectedRoute` | Always check the server, including cookie-only sessions. Keep route loading pending and retry every five seconds on transient restoration failures. A definitive unauthenticated response ends restoration. |
| Logout | `authController:logout`; `authRoutes` | Revoke the presented refresh session directly, without automatic renewal first; clear both cookies with compatible scope/security settings and without maxAge. Frontend clears local state. |
| All sessions | `authController:resetPassword` | Password reset revokes all user refresh sessions. No dedicated logout-all-devices handler was found. Existing access JWTs remain usable until expiry unless account checks deny access. |

## Configuration verification

- **Runtime signing check:** loaded the local server environment without printing secrets; actual synthetic JWT claims yielded access exp−iat **900 seconds** and refresh exp−iat **604800 seconds**. Tests also verify signatures and claims of credentials returned by the actual login controller. No live user session was created for the environment check.
- Local NODE_ENV is development; local JWT_EXPIRE is 15m; JWT_REFRESH_EXPIRY is unset and uses 7d. Both signing secrets are configured. Old fallback 30d and example 7d access configuration were corrected to 15m; the example now documents the actual refresh environment keys and secret.
- `server/index.js` now loads `server/.env` relative to its own directory. Preexisting process environment variables still take precedence, as intended for deployment. Remote deployment overrides were not inspected.
- Cookies remain HttpOnly, host-only (no Domain), Path=/ by Express default, and Max-Age=604800. Production uses Secure, SameSite=None, Partitioned; development uses non-Secure, SameSite=Lax. Access cookie retention is seven days, **but its JWT expires in fifteen minutes**; retention does not authorize an expired token. Refresh renewal no longer extends the original refresh cookie/session expiry.
- CORS code allows FRONTEND_URL and FRONTEND_URL_PROD exactly, with credentials, Authorization/X-Refresh-Token and the exposed X-New-Access-Token header. Development also permits local/LAN origins. Local configured origins are http://localhost:3000 and https://cosmos-craft.com; client local API is http://localhost:5000 and production build API is https://cosmoscraft.onrender.com. Production HTTPS, real origin headers, third-party cookie policies and partition behavior were not verified in a deployed browser.
- **Live database read-only check:** refresh_tokens exists with UUID token_id/user_id, text token_hash, timestamp-with-time-zone expires_at/created_at and boolean is_revoked. Aggregate snapshot: 555 records, 124 unrevoked and not expired. No tokens or user identifiers were printed and no database records were modified. Schema.sql agrees with these column types.
- Database expiration now equals JWT exp, avoiding fixed local-calendar seven-day arithmetic that diverged from configurable JWT lifetime. Exact-boundary expiry is rejected. Query/insert failures do not result in newly delivered credentials or false unauthenticated status.

## Additional confirmed fixes

- Refresh previously created a new database session on every renewal without revoking the old one. Concurrent requests could create sibling sessions; logout revoked only one. This was credential multiplication, not secure rotation. Renewal now reuses the original refresh session and issues only access credentials. The seven-day window remains anchored to login. Existing historical sibling records were not removed.
- Invalid refresh errors were wrapped in generic Error and returned 500; they now return classified 401 without hiding database failures.
- Logout no longer requires valid access or creates a session through authentication middleware. Cookie clearing no longer supplies a future maxAge.
- Removed Google callback logging of OAuth query data and the access-token-bearing redirect URL.
- Corrected the shared authAPI login path to the existing /auth/email-login route.
- No dependencies, schema migrations or RBAC redesign were introduced.

## Verification results

Focused run: `node --test server/tests/authSession.test.js client/tests/authFetch.test.js client/tests/authRedirect.test.js server/tests/termsAcknowledgments.test.js` — **12 passed, 0 failed** (includes five existing consent subtests).

Browser run: `node --test tests/authSessionBrowser.test.js` from client — **1 passed, 0 failed**, using real Chromium and bundled AuthProvider/ProtectedRoute against a controlled HTTP server.

`npm.cmd run build` — **passed**, with the existing large-bundle warning. `git diff --check` passed.

| Requested scenario | Evidence / result |
|---|---|
| 1–2 Login and protected access before expiry | Passed: real Express routes/controllers/JWTs; isolated in-memory database-query fixture. |
| 3–5 Expiration, refresh and original request retry | Passed: expired signed access tokens through backend, plus frontend mocked 401/refresh/retry responses. |
| 6 Valid refresh after original access expiry | Passed: backend auto-refresh continued protected requests with expired access token. |
| 7–8 Expired/revoked/invalid refresh | Passed: JWT expiry, database expiry, revocation, invalid signature and mismatched session user. |
| 9 Logout | Passed: actual router with expired access token, single session revoked, both cookies expired without creating another session. |
| 10 Page reload | Passed: Chromium cookie-only session restores with empty localStorage; missing session redirects. |
| 11 Concurrent 401s | Passed: eight frontend failures share one refresh and retry successfully; five concurrent backend renewals leave one session record. Persistent 401 retries only once. |
| 12 Rotation/reuse | Rotation is not implemented. Passed: stable refresh reuse during its validity and rejection after logout; no extra session rows on renewal. |
| 13 Cookies/CORS | Passed: production Set-Cookie attributes and logout clearing via HTTP tests; real same-origin HttpOnly cookie transmission in Chromium. Cross-origin production CORS and browser partition behavior are code inspection only. |
| 14 Disabled/revoked user and authorization | Passed: disabled user cannot refresh; revoked session cannot refresh; changed admin→staff role appears in renewed JWT and fails admin endpoint. Existing customer terms gates also pass. |
| Transient failures | Passed: database outage returns 500 for optional check and refresh; frontend network/429/5xx preserve credentials; Chromium initial 503 waits then restores. |

An additional existing passwordChange suite produced **4 passed / 1 failed**: the social-only password test expects “Local password set successfully.” while the unchanged controller returns “Password set successfully.” This is unrelated to the authentication changes and was left unchanged.

Tests do not claim real PostgreSQL login/refresh writes, real OAuth provider callbacks, password-reset all-session revocation, a fifteen-minute wall-clock wait or production browser verification. PostgreSQL schema/count verification was read-only; lifecycle query behavior uses a controlled fixture.

## Remaining concerns

- Production cookie omission/blocking and stale deployed environment overrides still need deployment-specific evidence. A blocked refresh cookie cannot be restored by frontend retry; do not weaken cookie flags to work around it.
- Historical sessions minted before this fix remain valid until expiry/revocation. Existing raw refresh JWT database storage, refresh-token JSON delivery, localStorage access-token exposure and OAuth access-token URL delivery are retained design risks. OAuth URL logging was removed, but URL delivery itself remains.
- Auth routes share a limit of ten requests per fifteen minutes, including check/refresh/terms. It can temporarily delay renewal; temporary failure handling now preserves credentials. Rate-limit policy was not changed.
- Access-token revocation is not checked against a session record, so logout/password reset cannot immediately invalidate already issued access JWTs. Account active/verification and current backend role checks still run on HTTP requests.
- Socket.IO verifies access JWTs on connection and has no refresh path; a reconnect with an expired token may fail until HTTP renewal updates the client token. This was inspected only and is separate from HTTP authentication.
- Other components use raw fetch; server auto-refresh preserves their cookie-based flow, but they do not all capture renewed tokens or use the new coordinated frontend retry. Browser-specific token-only failures outside the shared clients remain untested.
- During a prolonged restoration outage, protected routes remain on their existing loading indicator and retry; no unrelated UI was added.

The controlled regressions demonstrate that a valid refresh session continues HTTP use beyond access-token expiration, while expired/revoked/invalid refresh sessions cannot renew. Production confirmation remains outstanding.

## Follow-up: local reload briefly signed in, then signed out

The user reported this symptom in local development. The local frontend (3000) and backend (5000) respond, and a deliberately invalid refresh credential returns the new classified 401/SESSION_EXPIRED response, confirming the running backend loaded the refresh fix.

React.StrictMode in main.jsx runs the startup effect twice in development. AuthProvider previously allowed both checks to commit regardless of completion order. An older unauthenticated check could erase a newer restored session; pending startup/profile responses could also undo login or resurrect state after logout. Authentication operations now advance a session version, and obsolete checks cannot commit state, clear credentials, finish loading or schedule restoration retries. Login/logout also invalidate pending restoration and timers. A delayed failed refresh now clears credentials only if the access credential has not changed since that refresh began.

New controlled Chromium scenarios pass for delayed startup checks after successful restoration, login and logout, with StrictMode enabled. The cookie-only reload/transient-failure test also now runs in StrictMode. Result: **2 browser tests passed**. Focused authFetch/backend lifecycle run: **5 tests passed**, including a delayed refresh rejection after a subsequent login. Diff checks passed.

These tests reproduce the stale-response defect using controlled responses; they do not establish why the user's own server responses differed. The exact page URL/browser network sequence was not supplied at the time of this update. Actual user-session verification remains outstanding.

### Homepage clarification

The user subsequently confirmed the URL is http://localhost:3000/ and that Login appears immediately after refresh, then the profile returns after a few seconds. This identifies the reported homepage symptom as a pending-restoration display, rather than a persistent logout. Header did not consume isLoadingUser, whereas protected admin/staff routes already show a loading indicator during restoration.

Header now shows an accessible session-loading indicator on mobile and desktop until restoration completes, then displays the verified profile or Login as appropriate. It does not render a temporary Login button for a restoring session. The focused Chromium regression covers initial homepage arrival and document reload, both authenticated and unauthenticated outcomes, with StrictMode and delayed session-check responses: **1 passed**. Cart behavior is isolated with a fixture; actual Header and AuthProvider are bundled.

The supplied server trace points to refresh JWT validation before the database query. The deliberately invalid local-backend probe performed during the preceding investigation produces this exact error, so the pasted log alone cannot establish that the browser's own refresh cookie was invalid. No validation or expiry checks were weakened.
