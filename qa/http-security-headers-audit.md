# HTTP security-header audit — October 11, 2026

## Existing configuration and gaps

Express serves JSON APIs and legacy `/uploads` files; Vite serves the React application document. Initially there was no Helmet or global header policy. One order response set nosniff locally, but success/error/preflight/static responses were not consistently protected. Express disclosed X-Powered-By. Development error responses included stack traces, and malformed-JSON error messages could quote submitted JSON. The global error logger printed entire error objects, including parser bodies or driver details.

The existing CORS origin checks, credential support, allowed/exposed headers and Socket.IO authentication were preserved. No JWT, refresh-session, RBAC or database behavior was changed for this task. Prior authentication edits already present in the working tree are separate from this change.

Scope: application code only; no infrastructure or database configuration was modified. An existing frontend hosting rewrite file was inadvertently opened during initial discovery, before applying the attachment's scope restrictions; it was not used or changed, and no further hosting inspection was performed.

## Files changed for this task

| File | Change |
|---|---|
| `server/package.json`, `server/package-lock.json` | Added only Helmet 8.3.0. Installation ran with lifecycle scripts disabled; lockfile changes add only Helmet. |
| `server/middleware/securityHeaders.js` | Helmet configuration, Permissions-Policy, public-upload CORP override, conditional HSTS. |
| `server/index.js` | Disable X-Powered-By; register security middleware before audit context, rate limiting, CORS, parsing, routes and errors. |
| `server/services/socketService.js` | Register the same header middleware with Engine.IO, which handles polling/upgrades ahead of Express. Authentication and CORS logic are unchanged. |
| `server/middleware/errorHandler.js` | Stop returning stack traces; sanitize malformed-JSON responses; log error classification rather than full objects or submitted content. |
| `shared/securityPolicy.cjs` | Shared frontend document baseline, report-only candidate and browser-origin construction. |
| `client/securityHeadersPlugin.js` | Application headers on Vite development/preview responses; CSP baseline and referrer metadata in transformed/built HTML. |
| `client/vite.config.js` | Register the plugin; distinguish development serving from production preview using command/isPreview. Existing proxy behavior is unchanged. |
| `server/tests/securityHeaders.test.js` | API/error/media/CORS/header/HSTS/origin/error-disclosure regressions. |
| `client/tests/securityPolicyBrowser.test.js` | Browser CSP integration, preview export, printing, real local API/Socket.IO, baseline enforcement and framing/capability checks. |
| `client/tests/buildPreviewBrowser.test.js` | Run existing guitar export and saved-build regressions with the frontend security headers. |

## Final headers

| Header | Policy / rationale |
|---|---|
| Content-Security-Policy — API/uploads | `default-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`. JSON/files do not need to run scripts or host application UI. Fetching an API response does not apply its CSP to the React page. |
| Content-Security-Policy — Vite documents | Enforced, tested baseline: `object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. Keeps legitimate resources/inline print scripts functional while blocking plugins, external base URLs, external form targets and framing. |
| Content-Security-Policy-Report-Only — Vite documents | Resource policy below. Remains report-only because existing development and print inline scripts produce violations. No untested full policy was enforced. |
| Strict-Transport-Security | `max-age=31536000` only when NODE_ENV=production and the API request is recognized as secure. No includeSubDomains/preload. Not sent on local HTTP or by the HTTP Vite servers. |
| X-Content-Type-Options | `nosniff`. JSON and PNG MIME types were verified; built HTML/modules/styles retain their actual MIME types. |
| X-Frame-Options | `DENY`, consistent with enforced frame-ancestors none. The application is not intended to be embedded. Existing same-origin print children/popups remain usable. |
| Referrer-Policy | `strict-origin-when-cross-origin`. Built HTML also includes equivalent referrer metadata. |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()`. No current feature uses these capabilities. Clipboard writing used by the RGB picker is untouched. |
| Cross-Origin-Resource-Policy | `same-origin` generally; `cross-origin` only for public `/uploads` resources embedded by the separate frontend origin. Credentialed CORS API fetches continue to work. |
| Cross-Origin-Opener-Policy | `same-origin-allow-popups`, preserving print popup access without requiring cross-origin isolation. |
| Cross-Origin-Embedder-Policy | Intentionally omitted; no cross-origin-isolation requirement was found. Enforcing it could block third-party media. |
| X-Powered-By | Removed by Helmet and disabled at Express application creation. |

Helmet also supplies Origin-Agent-Cluster `?1`, X-DNS-Prefetch-Control `off`, X-Download-Options `noopen`, X-Permitted-Cross-Domain-Policies `none` and X-XSS-Protection `0` on API/Engine.IO responses. These are Helmet's ancillary defaults, not additional custom middleware. Headers are assigned once per response; the existing order-route nosniff assignment repeats the same value, rather than adding a second conflicting header.

Helmet defaults were explicitly adjusted to avoid its default same-origin framing allowance, blanket HSTS, restrictive upload CORP, upgrade-insecure-requests and broad default font/style origins. See the [Helmet documentation](https://helmet.js.org/).

### Frontend report-only candidate

The policy uses exact origins; there are no wildcard hosts, unsafe-eval or inline-script allowances.

| Directive | Allowed sources |
|---|---|
| default-src | self |
| script-src | self; **no unsafe-inline** |
| style-src | self, unsafe-inline, https://fonts.googleapis.com |
| img-src | self, data:, blob:, https://res.cloudinary.com, https://images.unsplash.com, https://ui-avatars.com, configured API origin |
| font-src | self, data:, https://fonts.gstatic.com |
| connect-src | self, https://api.cloudinary.com, https://res.cloudinary.com, configured API/Socket.IO origins and corresponding WebSocket origins; current document origin/WebSocket origin on Vite responses |
| media-src | self, blob:, https://res.cloudinary.com |
| object-src | none |
| base-uri | self |
| form-action | self |
| frame-ancestors | none; framing is already denied by the enforced baseline |
| frame-src | self, for existing receipt-print frames |

Development origin resolution mirrors the frontend API resolver's LAN-host substitution and includes the exact development document/HMR origin. Production preview selects VITE_API_URL_PROD before VITE_API_URL. Explicit VITE_SOCKET_URL is honored because the active SocketProvider uses it. The legacy WebSocketProvider is not mounted and does not add extra origins. Origins with embedded credentials or non-HTTP(S)/WS(S) schemes are rejected.

Inline CSS is justified by React style props, Motion/Emotion and generated print documents. Candidate inline scripts remain disallowed, making development/print exceptions visible without breaking them.

Cloudinary display URLs occur in guitar/bass builder asset utilities; direct unsigned browser uploads occur in `client/src/app/utils/cloudinary.js`. Google Fonts is imported by globals.css. Unsplash appears in product data and ui-avatars in customer profile fallback images. The active SocketContext uses bundled socket.io-client. Supabase is not imported by the frontend, and Brevo is exclusively called from the backend mail service; neither is allowed in browser CSP. PostgreSQL is never listed as a browser origin.

## Executed verification

### Automated tests

`node --test server/tests/securityHeaders.test.js server/tests/authSession.test.js server/tests/termsAcknowledgments.test.js client/tests/authFetch.test.js`

**14 passed, 0 failed**, including:

- Headers on JSON success, 401, 404, 429, 500, malformed JSON and PNG upload responses.
- MIME types, no X-Powered-By, compatible credentialed CORS/preflight, no exposed stack/configuration/test-token content in responses or global error logs.
- HSTS environment/protocol combinations; no includeSubDomains or preload.
- Exact CSP origins, development LAN/HMR, production API selection, no Supabase/Brevo/PostgreSQL/wildcard/unsafe-eval allowances, and rejection of credential-bearing origins.
- Existing authentication renewal/logout/role and customer terms regressions remain passing.

`node --test tests/securityPolicyBrowser.test.js tests/buildPreviewBrowser.test.js tests/headerSessionBrowser.test.js tests/authSessionBrowser.test.js` from client:

**6 passed, 0 failed**, including:

- Actual Header/AuthProvider reload behavior and StrictMode race regressions.
- Existing front/rear sticker geometry, masking, layering, image export/download and electric/bass saved-build behavior with application headers.
- Cross-origin API requests and real Socket.IO polling→WebSocket upgrade using the existing SocketProvider and socketService. Polling responses include nosniff and the expected CORS origin.
- Cloudinary display/canvas-export and upload URL flow against intercepted fixtures; legacy API-hosted uploads load across origins with CORP cross-origin.
- Appointment print popup remains accessible and its inline onload handler is installed. Physical printer output was not tested.
- No enforced CSP violations during the legitimate controlled integration flow. Expected inline-script report-only violations were observed; no other candidate violations occurred in that fixture.
- The enforced baseline rejects an external base element and unauthorized framing. Browser feature-policy checks deny camera/microphone/geolocation.

After final origin/logging adjustments, the three header tests and the browser CSP integration test were rerun and passed.

### Running local application and build

- Live `http://localhost:5000/health`: 200 with security headers and authorized credentialed CORS.
- Live missing API route: 404 with the same headers.
- Live authorized preflight: 204 with security headers and existing allowed origin/credentials.
- Live `http://localhost:3000/`: 200 HTML with baseline CSP, report-only candidate and the document headers; no HSTS or X-Powered-By.
- Fresh Chromium visit to the live homepage: **zero page errors**; **one report-only script-src-elem violation for Vite's inline preamble**; no enforced violation observed. Anonymous Login display remained functional.
- `npm.cmd run build`: **passed**. Existing large-JavaScript-bundle warning remains. Generated HTML includes CSP baseline/referrer metadata before application scripts.
- Temporary local Vite preview: 200, expected baseline/header/candidate and HTML metadata. Production API origin was selected. The existing local environment also supplies a localhost socket origin, which the policy accurately reflects; environment/deployment settings were not changed.
- `git diff --check`: passed.

## Remaining application-level verification and risks

1. **Full CSP is report-only.** Development's React/Vite inline preamble and the inline scripts in appointment/sales-report print documents need a nonce/hash or targeted implementation before script-src can be enforced. Broad unsafe-inline/unsafe-eval was not added. Inline styles remain a deliberate compatibility allowance.
2. **Separately hosted frontend HTTP headers:** Vite development/preview responses carry all document headers. Static built HTML carries only the tested object/base/form CSP baseline and referrer policy. Meta CSP cannot provide frame-ancestors or report-only policy, nor HSTS, Permissions-Policy, X-Frame-Options, nosniff or cross-origin response headers. These must come from the application server that actually serves production HTML. Existing hosting is outside the authorized scope and was not changed or verified. See [MDN CSP guidance](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP) and [frame-ancestors limitations](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).
3. **HSTS production behavior:** secure Express requests and environment combinations were simulated, not verified against production HTTPS. Engine.IO's raw requests have no Express trust-proxy-derived req.secure property; directly encrypted sockets receive HSTS, while TLS-terminated polling may not. Proxy behavior was deliberately not inspected or changed.
4. **Provider tests:** Cloudinary uploads/media and font requests in the controlled CSP fixture were intercepted; no real uploads or provider transactions were performed. Font response in that fixture uses a fallback rather than a valid downloaded font. Live homepage testing exercised its normal resources, but does not certify every provider URL, uploaded asset, account or admin workflow.
5. **Configuration drift:** future browser integrations or arbitrary user-provided external image URLs will produce candidate violations and require a reviewed origin addition. Current VITE_SOCKET_URL precedence can also permit a localhost socket in a local production preview; real build-time origin values need application-specific verification.
6. **Reports:** violations are visible in browser developer tools/securitypolicyviolation events. No report collector endpoint was added, avoiding an unauthenticated logging endpoint or extra dependencies.
7. Custom application errors retain their existing user-facing messages/validation fields. This task sanitized generic 500 and parser responses/global error logging; it did not redesign every controller's error generation or all service logs.

The API and local application document policies are implemented and tested. The full resource CSP remains safely observable until known inline-script requirements are resolved, and production document-header delivery remains outside this task's permitted scope.
