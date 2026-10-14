# Deploy CosmosCraft and Redis with Coolify on Hostinger KVM 2

Use three Coolify resources on the same Hostinger VPS: a frontend application,
a backend application, and a Redis database. Keep the existing PostgreSQL database
connection unless you also plan to move PostgreSQL. Coolify's proxy handles the
public domains and HTTPS; there is no need to install a separate Nginx proxy or a
host-level Redis service. [Coolify networking](https://coolify.io/docs/core/networking-in-coolify)

## 1. Create Redis

In the same Coolify project and environment as CosmosCraft, choose **New Resource →
Databases → Redis**. Choose the Hostinger server and the same destination network
that will serve the backend. Start Redis and wait until it is healthy. Leave public
access disabled. Copy **Redis URL (internal)** from its General page; it contains
the generated credentials and container hostname. The backend cannot connect to
Redis at `127.0.0.1`, because they run in separate containers.
[Coolify Redis guide](https://coolify.io/docs/databases/redis)

For this workload, use Redis custom configuration to set `maxmemory 256mb` and
`maxmemory-policy noeviction`. Keep authentication and persistence settings from
Coolify's generated configuration when adding custom directives. `noeviction`
prevents memory pressure from silently dropping rate-limit counters; if Redis
runs out of room, protected requests return 503 until the issue is resolved.
Coolify gives Redis a persistent `/data` volume, but does not provide scheduled
Redis database backups. [Coolify Redis configuration](https://coolify.io/docs/databases/redis)

## 2. Deploy the backend

Create a Git-based **Nixpacks** application from this repository. Set Base
Directory to the repository root (`/`), since the backend reads shared policy,
terms, and builder files outside `server`. Leave **Is it a static site?** off.
In Configuration > General, set Install Command to `npm ci --prefix server --omit=dev`
and Start Command to `npm start --prefix server`; leave Build Command empty.
The root `nixpacks.toml` preserves the backend's existing font packages.
Set **Ports Exposes** to `5000` and assign an HTTPS API domain, such as
`api.example.com`. Do not map port 5000 to the VPS host. Add a persistent storage mount at
`/app/server/uploads` so payment proof files survive redeploys.
[Coolify Nixpacks guide](https://coolify.io/docs/applications/builds/nixpacks/deploy)

Set these **runtime** environment variables in Coolify:

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
TRUST_PROXY=1
NIXPACKS_NODE_VERSION=22
REDIS_URL=<paste the Redis URL (internal) from Coolify>
REDIS_KEY_PREFIX=cosmoscraft:
FRONTEND_URL_PROD=https://app.example.com
GOOGLE_CALLBACK_URL_PROD=https://api.example.com/auth/google/callback
```

Mark `NIXPACKS_NODE_VERSION` as available during build. Also provide the existing `DATABASE_URL`, JWT, mail, Cloudinary, OAuth, and other
secrets your deployment needs. Configure the frontend URL to match its actual
origin exactly, without a trailing slash. Update the allowed Google OAuth callback
in Google's console to match the API domain. Keep `REDIS_URL` as a private runtime
secret, not a build variable. Coolify's proxy runs outside the app container, so
`HOST=0.0.0.0` is required; `TRUST_PROXY=1` lets Express use the client IP in the
forwarded header for rate limits. The backend port must stay reachable only
through Coolify's proxy/network. [Coolify Nixpacks setup](https://coolify.io/docs/applications/builds/nixpacks/deploy)

For this Git-based application, select the same Coolify destination as the Redis
resource. Coolify attaches non-Compose applications to their selected destination
automatically; the **Connect To Predefined Network** switch is for Compose stacks.
If the resources use different destinations, change one resource's destination so
the internal Redis hostname is reachable from the backend.
[Coolify networking](https://coolify.io/docs/core/networking-in-coolify)

## 3. Deploy the frontend

Create a second Git-based application from this repository. Choose **Nixpacks**,
set Base Directory to `/client`, enable **Is it a static site?**, and set Publish
Directory to `/dist`. Assign an HTTPS domain, such as `app.example.com`. Coolify
serves the Vite build through its static Nginx image.
[Coolify Nixpacks static setup](https://coolify.io/docs/applications/builds/nixpacks/deploy)

Set `VITE_API_URL_PROD=https://api.example.com` as a **build variable**. This is
embedded in the Vite bundle; redeploy the frontend when it changes. Also provide
any existing public Vite variables needed for Cloudinary or other frontend features.
If direct navigation to a React route returns 404, enable a single-page fallback
in the static application's Nginx configuration and redeploy.
[Coolify environment variables](https://coolify.io/docs/applications/configuration/environment-variables)

## 4. Verify

Open the frontend and confirm requests reach the API domain. Check `/health` on
the API domain and the Coolify logs for both the backend and Redis. An anonymous
product or service list request should create a short-lived cache key; repeated
requests within 15 seconds should reuse it. Login and contact requests should
create shared rate-limit counters. Confirm the rate-limit headers and a 429 after
exceeding a limit using a safe test IP or staging deployment. Check that Redis
is not publicly accessible and that uploaded proof files survive a backend
redeployment.

Limits now refill continuously. The defaults are:

| Traffic | Immediate burst | Recovery after exhaustion |
| --- | ---: | ---: |
| Guest API requests, per IP | 80 | 1 request every 0.5 seconds |
| Signed-in API requests, per verified user | 120 | 1 request every 0.25 seconds |
| Authentication attempts, per IP | 8 | 1 attempt every minute |
| Session checks and refreshes, per IP | 40 | 1 request every 1.5 seconds |
| Contact submissions, per IP | 3 | 1 submission every 3 minutes |
| Password-reset requests, per IP | 3 | 1 request every 10 minutes |

These are token buckets rather than fixed windows. A denied request includes a
`Retry-After` header for the next available token; it does not prolong a lockout.
Set the matching `RATE_LIMIT_*_BURST` and `RATE_LIMIT_*_REFILL_MS` runtime variables
in Coolify to adjust each bucket. The defaults are also listed in `server/.env.example`.
Keep Redis private and `TRUST_PROXY` correctly set so per-IP protection uses the
real client IP. Authentication and session routes use dedicated buckets, so
exhausting the guest browsing limit does not block login or signed-in activity.
Botnets spread across many IPs still need edge protection, such as a WAF in front
of Coolify, because an application-level IP limiter cannot combine all attackers.
Anonymous product and service catalog
responses are cached for 15 seconds. Private account, order, cart, checkout,
and appointment availability data are not cached. If Redis is unavailable,
protected requests return 503 until it reconnects. `/health` checks the Node
process only; it is not a Redis readiness check.

The optional Redis integration test can run against a disposable Redis instance
by setting `TEST_REDIS_URL` and running `node --test tests/redisIntegration.test.js`
from `server`. Do not point the test at production Redis.

## Testing on a local computer

The backend loads `REDIS_URL` from `server/.env` even in development. If it points
to a Coolify container's internal URL or a manually assembled public URL, local
requests can return 503 because the backend cannot reach Redis. To work on the
app without Redis, leave `REDIS_URL=` empty and restart the backend. Local
rate limits then use process memory and public response caching is disabled.

To test both caching and Redis-backed limits locally, run a local Redis instance.
For example, with Docker Desktop running:

```sh
docker run --rm --name cosmoscraft-redis -p 127.0.0.1:6379:6379 redis:7.2
```

Set `REDIS_URL=redis://127.0.0.1:6379/0` in `server/.env` and restart the backend.
Stop the container when finished. On this Windows workspace, Docker and a local
Redis service were not detected, so this step requires installing or starting a
container runtime or Redis separately.

If you intentionally connect your local backend to Redis on Coolify, enable the
appropriate external access in Coolify and copy its generated **Redis URL (public)**
exactly. The internal URL only resolves inside Coolify's Docker network. Coolify's
TLS Redis URL uses `rediss://` and port 6380 internally; do not combine a TLS
scheme with the non-TLS port by hand. Restrict public Redis access and use TLS.
[Coolify Redis connection guide](https://coolify.io/docs/databases/redis)

If the local backend gets `Connection timeout` with a public URL, check Redis →
General → **Public access** is enabled through the TCP proxy, note its **Public
port**, and confirm Coolify displays a Public URL. Use that URL in local `.env`.
Allow the chosen TCP port through both the Hostinger VPS firewall and any active
server firewall, ideally only from your current public IP. A private/internal
Redis URL or an unpublished/blocked port will time out from your PC. After changing
the URL, restart the local backend and test it with `PING`.

## If the backend reports Redis unavailable

Check the Redis resource is **running and healthy**, then compare the backend's
`REDIS_URL` with **Redis URL (internal)** from Redis → General. Copy the entire
URL, including the generated password and container hostname, into the backend's
runtime environment variable. Save and restart or redeploy the backend. Do not
use `localhost`, `127.0.0.1`, a browser URL, or the Redis public URL for resources
on the same Coolify destination network.

The backend log now includes a safe reason code without printing credentials:

| Reason | First check |
| --- | --- |
| `DNS_LOOKUP_FAILED` | Backend and Redis are on the same destination network; verify the Redis container hostname in the internal URL. |
| `CONNECTION_REFUSED` | Redis is running, healthy, and listening on the internal port in the copied URL. |
| `AUTHENTICATION_FAILED` | Recopy the internal URL; check any custom Redis configuration or changed password. |
| `CONNECTION_TIMEOUT` or `CONNECTION_RESET` | Check Redis health, container restarts, and the shared Docker network. |
| `UNKNOWN` | Inspect Redis runtime logs and check the Redis URL scheme (`redis://` or `rediss://`). |

You can test the backend container's connection from its Coolify Terminal without
printing the URL or password. Run this from `/app/server`:

```sh
node -e 'const r=require("redis").createClient({url:process.env.REDIS_URL,socket:{connectTimeout:3000,reconnectStrategy:false}});r.on("error",e=>console.error("Redis connection:",e.code||e.name));r.connect().then(()=>r.ping()).then(v=>{console.log(v);r.destroy()}).catch(e=>{console.error("Redis test:",e.code||e.name);r.destroy();process.exitCode=1})'
```

`PONG` means that DNS, network access, and credentials worked from the backend
container. An error code points to the matching check above. Avoid pasting the
full `REDIS_URL` into logs or chat because it contains the password.
