# Birthday sites

Both birthday experiences share one Node server and one Neon database. Use Node 22.12+ or Node 24.

## Layout

- `client/`: poster and bhajan site, served at `/poster/`.
- `gallery/`: forward-moving 3D birthday gallery, served at `/gallery/`.
- `server/`: shared Express server and analytics API.

The gallery was copied from the sibling `kpv-hbd-2026` directory. Make future gallery edits here; the original directory is retained as a reference.

## Run together

1. Run `npm install` at this folder's root.
2. Configure `server/.env` from `server/.env.example` if it is not already configured. Keep `DATABASE_URL` on the server only.
3. Run `npm run build`.
4. Run `npm start`.

Open http://localhost:3001/poster/ or http://localhost:3001/gallery/. The root URL opens the poster. `/health` checks database connectivity. Schema setup runs automatically at startup and preserves existing poster records.

For live editing, run `npm run dev:server`, then `npm run dev:client` (port 5173) and/or `npm run dev:gallery` (port 5186). Each Vite server proxies `/api` to port 3001. An unset `VITE_API_URL` uses the same origin; `off` disables tracking. Set an explicit API origin only when hosting the frontend separately.

## Tracking

| Site | API | Neon table | India-time view |
| --- | --- | --- | --- |
| Poster | `/api/poster/events` | `birthday_events` | `birthday_events_ist` |
| Gallery | `/api/gallery/events` | `gallery_events` | `gallery_events_ist` |

The legacy `/api/events` route still writes poster events. Table selection is fixed on the server. Both tables record event UUIDs, anonymous tab session UUIDs, receipt and occurrence times, server-observed IP address, user agent, origin, pathname and validated event details. Query strings, cookies and fingerprint data are not collected.

The poster tracks entry, audio playback/pauses/seeking/completion, poster viewing and confetti. The gallery tracks page load, readiness, which of the eight wishes is viewed, visible time spent on each wish, reaching the ending, replay and image errors. Reading time pauses while the tab is hidden. Tracking failures do not interrupt either experience; blockers, network loss and browser shutdown can lose events. These events indicate browser activity, not proof of a particular person's identity or attention.

```sql
SELECT event_type, received_at_ist, ip_address, detail
FROM gallery_events_ist ORDER BY received_at DESC LIMIT 100;

SELECT event_type, received_at_ist, ip_address, detail
FROM birthday_events_ist ORDER BY received_at DESC LIMIT 100;
```

There is no public analytics viewer. Access records through Neon with authorized database credentials.

## Deploy

Install with `npm ci`, build with `npm run build`, and launch `npm start` on a Node host. Publish the whole project with both build outputs; this serves both sites and API from one domain. Set `DATABASE_URL`, platform `PORT`, and `ALLOWED_ORIGINS` to the exact HTTPS origin, without a trailing slash. Include preview origins explicitly if needed.

`TRUST_PROXY` defaults to `0`. Configure it to match the host's documented proxy topology so visitor IPs are recorded correctly. Rate limiting is per process at 120 events/IP/minute. CORS is not authentication; analytics can be forged by non-browser clients. Secrets stay in server environment variables; `.env` files are ignored by Git.

To deploy a frontend at the root of a separate static host, build that workspace with `npm run build -w client -- --base=/` or `npm run build -w gallery -- --base=/`, set its `VITE_API_URL` before building, and publish its `dist` folder. The default combined build deliberately uses `/poster/` and `/gallery/` asset prefixes.

## Verify

Run `npm run build` then `npm test`. Tests cover API validation, origin enforcement, table routing, built-page assets, tracking failure handling and visible reading time. Run `npm run db:check` to apply the additive schema and verify actual API writes, table isolation, deduplication and India-time views in Neon. Verification inserts are rolled back.

## Vercel projects

Import this repository as separate Vercel projects. Set each project's Root Directory relative to the repository root:

| Project | Root Directory | Environment variables |
| --- | --- | --- |
| Tracking API | `server` | `DATABASE_URL` = Neon pooled connection URL; `ALLOWED_ORIGINS` = comma-separated exact frontend origins |
| Poster | `client` | `VITE_API_URL` = deployed API origin, e.g. `https://your-api.vercel.app` |
| Gallery | `gallery` | `VITE_API_URL` = same deployed API origin |

Each folder contains its own `vercel.json`. Keep the repository's root package.json and package-lock.json available for npm workspace installation. If this project is nested within a larger repository, include that parent path in each Root Directory. Enable access to source files outside the Root Directory for the workspace setup.

Deploy the server first, then set `VITE_API_URL` and deploy each frontend. Add both frontend production origins to the server's `ALLOWED_ORIGINS` and redeploy the server. Origin values include `https://` but no trailing slash or path. Frontend API values also omit `/api`; the client adds the appropriate event route. Environment changes require redeployment, and frontend variables are baked into the build. Never put DATABASE_URL on a frontend project.

On Vercel, each frontend opens at its own domain's `/`. The API project serves `/health`, `/api/poster/events` and `/api/gallery/events`; it does not host the frontend builds. The legacy `/api/events` route remains available. Local `npm start` still serves both sites together.

The server configuration uses a Node function at `server/api/index.js` with all requests rewritten to that handler, and includes schema.sql in the function bundle. Database initialization and the pool are shared across requests in each warm function instance. Rate limiting remains per instance. Configure TRUST_PROXY for Vercel's documented proxy topology if accurate visitor IPs are needed. Check deployment access settings if browser requests are redirected to a Vercel login page: visitors must be able to reach the tracking API.

After deployment, open the API's `/health` (expect status ok), visit each frontend, and check its tracking POST returns 202. Local tests do not validate Vercel's deployed routing.

### If Vercel displays JavaScript source

This means the deployment is serving source as static content instead of invoking the API. The server config explicitly builds only `api/index.js` using `@vercel/node` and routes all requests to that function. This is the legacy explicit-builder configuration; Vercel may note that dashboard build settings are ignored, which is expected here.

Confirm Root Directory points to the folder containing `server/vercel.json` (normally `server`, or the repository-relative path ending in `/server`). Publish the current files, including `api/index.js`, `runtime.js`, `app.js`, `schema.sql`, and `vercel.json`. Redeploy the latest source, rather than redeploying an older deployment snapshot. The server's `/` should show JSON identifying the Birthday tracking API; `/health` should return `{"status":"ok"}`. A missing or incorrect DATABASE_URL causes initialization failure, not JavaScript source to appear.

## Current Vercel deployments

The shared API is https://hbd-kpv-2026-server.vercel.app. Both `client/vercel.json` and `gallery/vercel.json` supply this URL as the build-time `VITE_API_URL` for their separate Vercel builds. Keep any Vercel dashboard override for that variable aligned with this URL. Local and combined-host builds retain their existing same-origin/proxy behavior.

The funny site, https://kpv-hbd.vercel.app, is explicitly allowed by the API even when an existing ALLOWED_ORIGINS setting contains only local URLs. Additional origins from ALLOWED_ORIGINS are retained. When the main gallery site is deployed, append its exact HTTPS origin to the server project's ALLOWED_ORIGINS and redeploy the server. No trailing slash or wildcard is needed.

Redeploy the server and both frontends after these configuration changes. The funny site posts to /api/poster/events (birthday_events); the main gallery posts to /api/gallery/events (gallery_events). Both use the same Neon database and API deployment, with separate event tables and IST views.

### Visitor IPs on Vercel

The Vercel function explicitly enables platform-header IP resolution for recorded IPs and rate limiting. Outside Vercel, TRUST_PROXY remains explicit and defaults to zero. Previously recorded localhost values cannot be reconstructed from stored events.

IP handling v2: the Vercel API entrypoint explicitly enables platform-header handling, independent of VERCEL or TRUST_PROXY environment settings. It prefers x-vercel-forwarded-for, validates IPv4/IPv6, and stores NULL when platform IP metadata is missing instead of falsely recording localhost. Local servers ignore platform headers. /health reports ipHandling=vercel-headers-v2 and the deployment revision so an outdated server deployment can be identified. Redeploy the server project, not just the frontend.
