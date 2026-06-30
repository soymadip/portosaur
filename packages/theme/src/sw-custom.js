import { registerRoute } from "workbox-routing";

// Paths the PWA owns. Navigating to anything else exits the PWA shell.
const ALLOWED_PATH_PATTERNS = [
  /^\/$/, // root / home
  /^\/docs(\/|$)/, // /docs and everything under it
  /^\/notes(\/|$)/, // /notes and everything under it
  /^\/tasks(\/|$)/, // /tasks and everything under it
  /^\/blog(\/|$)/, // /blog and everything under it
];

/**
 * Workbox custom service-worker injection.
 * Called by @docusaurus/plugin-pwa after the precache manifest is injected.
 *
 * @param {{ debug: boolean, offlineMode: boolean }} params
 */
export default function swCustom(params) {
  // Intercept all navigation requests (full-page HTML loads).
  registerRoute(
    ({ request }) => request.mode === "navigate",

    async ({ event, url }) => {
      const allowed = ALLOWED_PATH_PATTERNS.some((p) => p.test(url.pathname));

      if (!allowed) {
        // Path is outside the PWA — forward to network so the browser
        // opens it as a normal page, breaking out of the PWA shell.
        return fetch(event.request);
      }

      // Allowed path — serve the cached app shell so navigation
      // stays inside the PWA without a full round-trip.
      const cached = await caches.match("/index.html", { ignoreSearch: true });
      return cached ?? fetch(event.request);
    },
  );
}
