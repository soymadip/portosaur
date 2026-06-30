/**
 * periodicSync.js
 *
 * Docusaurus client module — runs in the browser (main thread) on every page load.
 * Registers the Periodic Background Sync so the service worker can check for
 * new blog posts every 12 hours and send a notification.
 *
 * Requirements (browser side):
 *  - PWA must be installed (added to home screen / desktop)
 *  - Notification permission must be granted
 *  - Periodic Background Sync permission must be granted (Chrome grants it
 *    automatically for installed PWAs on Android; not yet available in Firefox/Safari)
 */

const SYNC_TAG = "check-new-posts";

// 12 hours in milliseconds.
// The OS may fire less frequently based on battery/network conditions.
const SYNC_MIN_INTERVAL_MS = 12 * 60 * 60 * 1000;

async function setupPeriodicSync() {
  // Periodic Background Sync requires a service worker.
  if (!("serviceWorker" in navigator)) {
    return;
  }

  // API not supported in this browser (Firefox, Safari, etc.).
  if (!("periodicSync" in ServiceWorkerRegistration.prototype)) {
    return;
  }

  // Notification permission is NOT requested here on purpose.
  // Prompting without a user gesture is bad UX and Chrome will block it.
  // Permission is requested when the user explicitly clicks a
  // "Notify me of new posts" button (handled in the blog UI).

  // Periodic Background Sync requires explicit permission from the browser.
  let permState;
  try {
    const status = await navigator.permissions.query({
      name: "periodic-background-sync",
    });
    permState = status.state;
  } catch {
    return; // Permissions API not supported — skip.
  }

  if (permState !== "granted") {
    return;
  }

  // Wait for an active service worker to be ready.
  const registration = await navigator.serviceWorker.ready;

  try {
    await registration.periodicSync.register(SYNC_TAG, {
      minInterval: SYNC_MIN_INTERVAL_MS,
    });
  } catch (err) {
    // Registration can fail if the PWA is not installed yet.
    // This is expected in a normal browser tab — no action needed.
    console.debug("[Porto] Periodic sync registration skipped:", err.message);
  }
}

// Docusaurus client modules must export at least one lifecycle hook.
export function onRouteDidUpdate() {}

// Run the setup once when the module is first loaded.
setupPeriodicSync();
