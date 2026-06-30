import { registerRoute } from "workbox-routing";

// --- Navigation allowlist ---

// Paths the PWA owns. Navigating to anything else exits the PWA shell.
const ALLOWED_PATH_PATTERNS = [
  /^\/$/, // root / home
  /^\/docs(\/|$)/, // /docs and everything under it
  /^\/notes(\/|$)/, // /notes and everything under it
  /^\/tasks(\/|$)/, // /tasks and everything under it
  /^\/blog(\/|$)/, // /blog and everything under it
];

// --- Blog RSS notification constants ---

const BLOG_RSS_PATH = "/blog/rss.xml";
const PERIODIC_SYNC_TAG = "check-new-posts";

const IDB_DB_NAME = "porto-sw";
const IDB_STORE_NAME = "kv";
const IDB_KEY_SEEN_GUIDS = "seen-post-guids";

// --- IndexedDB helpers ---

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);

    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(IDB_STORE_NAME);
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readonly");
    const req = tx.objectStore(IDB_STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbPut(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, "readwrite");
    tx.objectStore(IDB_STORE_NAME).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// --- RSS parsing ---

function parseFeedItems(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");

  return Array.from(doc.querySelectorAll("item")).map((item) => ({
    guid: item.querySelector("guid")?.textContent ?? "",
    title: item.querySelector("title")?.textContent ?? "New Post",
    link: item.querySelector("link")?.textContent ?? self.registration.scope,
  }));
}

// --- Check for new posts and notify ---

async function checkForNewPosts(debug) {
  const rssUrl = new URL(BLOG_RSS_PATH, self.registration.scope).href;

  let xmlText;
  try {
    const res = await fetch(rssUrl, { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    xmlText = await res.text();
  } catch {
    return; // Network error — skip silently.
  }

  const posts = parseFeedItems(xmlText);
  if (!posts.length) {
    return;
  }

  const db = await openDB();
  const seenGuids = (await dbGet(db, IDB_KEY_SEEN_GUIDS)) ?? [];
  const newPosts = posts.filter((p) => p.guid && !seenGuids.includes(p.guid));

  // Always update the seen list with all current GUIDs.
  await dbPut(
    db,
    IDB_KEY_SEEN_GUIDS,
    posts.map((p) => p.guid),
  );

  if (!newPosts.length) {
    if (debug) {
      console.log("[Porto SW] No new posts found.");
    }
    return;
  }

  if (debug) {
    console.log(
      "[Porto SW] New posts found:",
      newPosts.map((p) => p.title),
    );
  }

  // Single new post — link directly to it.
  if (newPosts.length === 1) {
    await self.registration.showNotification(newPosts[0].title, {
      body: "New blog post published",
      icon: "/favicon/favicon.ico",
      badge: "/favicon/favicon.ico",
      tag: PERIODIC_SYNC_TAG,
      data: { url: newPosts[0].link },
    });
    return;
  }

  // Multiple new posts — batch notification linking to /blog.
  await self.registration.showNotification(
    `${newPosts.length} new blog posts`,
    {
      body: newPosts.map((p) => `• ${p.title}`).join("\n"),
      icon: "/favicon/favicon.ico",
      badge: "/favicon/favicon.ico",
      tag: PERIODIC_SYNC_TAG,
      data: { url: new URL("/blog", self.registration.scope).href },
    },
  );
}

// --- Workbox custom service-worker injection ---

/**
 * Called by @docusaurus/plugin-pwa after the precache manifest is injected.
 *
 * @param {{ debug: boolean, offlineMode: boolean }} params
 */
export default function swCustom({ debug }) {
  // Restrict PWA navigation to only the allowed routes.
  // Any path NOT in the allowlist is forwarded to the network so the
  // browser opens it as a normal page, breaking out of the PWA shell.
  registerRoute(
    ({ request }) => request.mode === "navigate",
    async ({ event, url }) => {
      const allowed = ALLOWED_PATH_PATTERNS.some((p) => p.test(url.pathname));

      if (!allowed) {
        return fetch(event.request);
      }

      const cached = await caches.match("/index.html", { ignoreSearch: true });
      return cached ?? fetch(event.request);
    },
  );

  // Periodic Background Sync: check the RSS feed every 12 hours.
  self.addEventListener("periodicsync", (event) => {
    if (event.tag !== PERIODIC_SYNC_TAG) {
      return;
    }

    if (debug) {
      console.log("[Porto SW] Periodic sync fired:", event.tag);
    }
    event.waitUntil(checkForNewPosts(debug));
  });

  // Notification click: open the linked post (or /blog) in a tab.
  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = event.notification.data?.url ?? self.registration.scope;

    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clientList) => {
        // Reuse an already-open tab for that URL if one exists.
        const existing = clientList.find((c) => c.url === url && "focus" in c);
        if (existing) {
          return existing.focus();
        }
        return self.clients.openWindow(url);
      }),
    );
  });
}
