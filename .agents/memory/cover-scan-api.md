---
name: Cover scan API access
description: How the BookShelf Expo app reaches the cover-identify endpoint, and Google Books quota caveat
---

**Rule:** The client builds API URLs as `EXPO_PUBLIC_API_URL` (explicit base, no trailing slash, should NOT include `/api`) if set, otherwise `https://${EXPO_PUBLIC_DOMAIN}` — the platform proxy routes `/api/*` to the shared api-server in both dev and production (api-server artifact declares `paths = ["/api"]`).

**Why:** Expo bundles run outside the web proxy and need absolute URLs; relative `/api` fails from the Expo dev domain.

**How to apply:** Any new server call from the Expo app should go through the same `apiUrl()` pattern. Curl `https://$REPLIT_DEV_DOMAIN/api/healthz` to verify routing.

**Caveat:** Google Books API rejects requests from the workspace's shared datacenter IP with daily-quota 429s. Test Google Books lookups from a real device/client, or mock fetch (see ranking test pattern) — a shell curl failure does not mean the client flow is broken.
