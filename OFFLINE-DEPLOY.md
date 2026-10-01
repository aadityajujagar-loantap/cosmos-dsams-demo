# Running this app on an air-gapped LAN

This app is built and served entirely from its own origin. There are **no runtime
requests to the public internet** — no CDN, no Google Fonts, no analytics, no
external map/chat/captcha widgets.

This document records what was audited, what was changed, and the exact commands to
install and build on a machine with no outbound internet.

---

## 1. What needed the internet, and what was done about it

| Concern | Verdict | Action taken |
| --- | --- | --- |
| **Fonts** — `next/font/google` (Geist, Geist_Mono) in `app/layout.tsx` downloaded `fonts.googleapis.com` / `fonts.gstatic.com` **at build time** | **Real blocker** | Fonts vendored to `app/fonts/*.woff2`; switched to `next/font/local`. Build is now fully offline. |
| **Next.js telemetry** — `next build` POSTs anonymous usage to `telemetry.nextjs.org` | Real outbound call | `NEXT_TELEMETRY_DISABLED=1` set in `next.config.ts`. |
| **npm registry** — 471 tarballs for 482 packages | Needed at install time | `npm run bundle:offline` caches tarballs into `.npm-offline-cache/`; install with `npm run install:offline`. |
| **`package-lock.json` out of sync** — `npm ci` failed with `Missing: @emnapi/core / @emnapi/runtime / zod-validation-error` | **Pre-existing bug**, blocked all clean installs | Lockfile repaired via `npm install --package-lock-only`. See section 2. |
| **Icons** — `lucide-react` | Already offline | SVGs are compiled into the JS bundle at build time. Nothing fetched at runtime. |
| **Charts** — `recharts` | Already offline | Compiled into the bundle. |
| **Tailwind CSS v4** | Already offline | Compiled to a static `.css` at build time. |
| **Images** — `public/logo-dsasm-cosmos.png`, `public/documents/*.pdf` | Already offline | Served from this origin. |
| **API calls** — all `fetch()` in `apis/`, `app/api/*/route.ts` | Already offline | Point at `NEXT_PUBLIC_API_URL`, i.e. your own Laravel backend on the LAN. |
| **Document preview `<iframe>`** — `components/screens/dsa-pages.tsx` | Already offline | `embedUrl` is built from the backend's own URL; PDFs are rendered by the browser's built-in viewer, not a Google Docs viewer. |
| **`<img src>`** — captcha, banners, document previews | Already offline | All either local `public/` assets or backend-served data/blob URLs. |

Strings like `https://api.cosmosbank.in` (in `components/screens/sell-now-page.tsx`)
and `https://example.com` are **documentation text rendered on screen** for the
partner API reference. They are never requested.

---

## 2. One-time: prepare the bundle on a machine WITH internet

Run from `frontend/`:

```powershell
npm install
npm run bundle:offline
```

This creates `frontend/.npm-offline-cache/` — a real npm cache holding all 471
tarballs plus the URL index npm needs to resolve them. `npm ci --offline` verifies
each one against the `sha512` hash in `package-lock.json`, so a corrupted or
substituted tarball fails the install rather than being used.

> **Note on `package-lock.json`.** Before this work, `npm ci` failed on this repo
> even with internet access, reporting `Missing: @emnapi/core / @emnapi/runtime /
> zod-validation-error from lock file`. The lockfile had drifted out of sync with
> `package.json`. It has been repaired (`npm install --package-lock-only`, 473 -> 482
> entries). If you ever see that error again, run the same repair command on a
> connected machine and re-run `npm run bundle:offline`.

Then copy this whole folder to the air-gapped server (USB / DVD / internal file share):

```
frontend/
  app/fonts/            <- vendored fonts (committed to git, small)
  .npm-offline-cache/   <- the tarball bundle (transfer this separately)
  package-lock.json
  scripts/make-offline-bundle.mjs
```

---

## 3. On the air-gapped server

```powershell
cd frontend

# install with zero network access
npm run install:offline

# build with zero network access
npm run build

# run
npm run start
```

`npm run start` serves the app on `http://<server-ip>:3000` by default.

> If you would rather not rebuild on the server, build on a connected machine and
> copy the `.next` folder plus `node_modules` instead. See section 5.

---

## 4. Environment configuration

Create `frontend/.env` on the server. Note that `.env*` is **gitignored**, so this file
does not travel with the repository — create it on the server itself.

```ini
# Your Laravel backend on the LAN. This is the ONLY host the browser talks to.
NEXT_PUBLIC_API_URL=http://<backend-lan-ip>:8000/api

# Leave empty for a root deployment, or set e.g. /dsa if served under a sub-path.
NEXT_PUBLIC_BASE_PATH=

NEXT_PUBLIC_LOAN_JOURNEY_API_TOKEN=<token>
```

If the server has no DNS, use the raw IP: `NEXT_PUBLIC_API_URL=http://10.0.0.25:8000/api`.

### Backend services that DO reach outside the LAN

The frontend is now fully offline, but be aware the **backend** calls out to third
parties in non-mock mode. On a bank LAN these must be mocked or pointed at an internal
host, otherwise those specific features will fail (the rest of the app is unaffected):

| Service | Default endpoint | Config key |
| --- | --- | --- |
| CIBIL credit check | `partnerapi-uat.transunioncibil.com` | `services.cibil.base_url` |
| CIBIL commercial | `partnerapi-uat.transunioncibil.com` | `services.cibil.commercial_base_url` |
| Karza (PAN / GST / Udyam) | `api.karza.in` | `kyc.karza.base_url` |
| AML Compass | `api-uat.compassplus.com` | `services.compass.base_url` |
| KYC ScoreMe | `sm-kyc-sync-*.scoreme.in` | `kyc.scoreme.base_url_*` |
| SMS OTP | `api.msg91.com` / Twilio | `otp.sms_api_url` |
| Cosmos CBS | `172.25.6.89:8080` / `10.102.20.10:8083` (internal) | `cbs.cosmos.url` |

Set the corresponding `*_MOCK=true` flags in `backend/.env` for an air-gapped server.
The CBS endpoints are already internal LAN addresses.

---

## 5. Alternative: prebuilt deployment

If the server should never run a build:

```powershell
# on a machine WITH internet
cd frontend
npm ci
npm run build
```

Copy to the server: the `frontend/` source **plus** the `node_modules/` and `.next/`
folders from the build machine. Then on the server:

```powershell
npm run start
```

Node itself must be installed on the server (Node 20+). The Next.js runtime and all
dependencies live inside `node_modules`; nothing is fetched at start time.

---

## 6. Verifying offline behaviour

After deploying, confirm nothing reaches outside the LAN:

1. Open DevTools → Network → filter **Fetch/XHR**. Reload every screen. Only requests
   to your own origin and the backend host should appear.
2. Block all outbound traffic at the firewall, then click through login, dashboard,
   DSA list/detail, approvals, document preview, reports, and sell-now. Everything
   except the third-party verification features in section 4 should work.
3. Confirm fonts load: DevTools → Network → filter **Font** — you should see
   `/_next/static/media/Geist_Variable-*.woff2` served from your own origin, with no
   request to `fonts.gstatic.com`.

---

## 7. Do not regress this

- Do not change `app/layout.tsx` back to `next/font/google`. That reintroduces the
  build-time download and the build will fail on the air-gapped server.
- Do not remove `process.env.NEXT_TELEMETRY_DISABLED ??= "1"` from `next.config.ts`.
- Do not delete `app/fonts/`. It is committed to git and is the only copy that will
  exist on the server.
- Do not add a CDN `<link>`, an external `@import` in CSS, or a third-party script tag
  without re-auditing for offline use.

