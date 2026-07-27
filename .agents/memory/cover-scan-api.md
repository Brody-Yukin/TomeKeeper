---
name: Cover scan API access
description: How the BookShelf Expo app reaches the api-server, and Google Books access rules
---

**Rule:** The client builds API URLs via `apiUrl()` in `utils/googleBooks.ts`: `EXPO_PUBLIC_API_URL` (explicit base, no trailing slash, should NOT include `/api`) if set, otherwise `https://${EXPO_PUBLIC_DOMAIN}` — the platform proxy routes `/api/*` to the shared api-server in both dev and production (api-server artifact declares `paths = ["/api"]`).

**Why:** Expo bundles run outside the web proxy and need absolute URLs; relative `/api` fails from the Expo dev domain.

**How to apply:** Any new server call from the Expo app should go through the same `apiUrl()` pattern. Curl `https://$REPLIT_DEV_DOMAIN/api/healthz` to verify routing.

**Google Books access:** Unauthenticated googleapis.com calls from the workspace's shared datacenter IP fail with daily-quota 429s. ISBN lookups therefore go through the server (`GET /api/books/isbn/:isbn`) using the server-only `GOOGLE_BOOKS_API_KEY` secret (must be a real API key starting `AIza` — OAuth secrets get 401 "API keys are not supported"). Title/author candidate search still calls Google directly from the device, which is fine on real devices but not testable via shell curl — mock fetch instead.
