import { expect, test, describe } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildServiceWorkerContent,
  serviceWorkerPrecache,
  syncServiceWorker,
} from "../src/engine/utils/serviceWorker.ts";

const ORIGIN = "https://example.com";

describe("serviceWorkerPrecache", () => {
  test("lists the shell at the site root", () => {
    expect(serviceWorkerPrecache("/")).toEqual([
      "/",
      "/offline/",
      "/favicon/icon-192x192.png",
      "/favicon/icon-512x512.png",
      "/favicon/icon-maskable-512x512.png",
      "/favicon/apple-touch-icon.png",
      "/manifest.webmanifest",
    ]);
  });

  test("prefixes every entry with the base path", () => {
    expect(serviceWorkerPrecache("/porto-astro/")).toEqual([
      "/porto-astro/",
      "/porto-astro/offline/",
      "/porto-astro/favicon/icon-192x192.png",
      "/porto-astro/favicon/icon-512x512.png",
      "/porto-astro/favicon/icon-maskable-512x512.png",
      "/porto-astro/favicon/apple-touch-icon.png",
      "/porto-astro/manifest.webmanifest",
    ]);
  });
});

describe("buildServiceWorkerContent", () => {
  test("stamps the version into the cache names", () => {
    const content = buildServiceWorkerContent({
      basePath: "/",
      version: "123",
    });
    expect(content).toContain('const VERSION = "123"');
    expect(content).toContain("porto-shell-${VERSION}");
    expect(content).toContain("porto-pages-${VERSION}");
    expect(content).toContain("porto-static-${VERSION}");
    expect(content).toContain("self.skipWaiting()");
    expect(content).toContain("self.clients.claim()");
  });

  test("scopes the static prefix and offline URL to the base", () => {
    const content = buildServiceWorkerContent({
      basePath: "/porto-astro/",
      version: "123",
    });
    expect(content).toContain(
      'const STATIC_PREFIX = "/porto-astro/_next/static/"',
    );
    expect(content).toContain('const OFFLINE_URL = "/porto-astro/offline/"');
    expect(content).toContain('"/porto-astro/offline/",');
  });
});

/**
 * The worker itself is plain JavaScript, so its behavior is tested
 * in Bun: the generated source runs under `new Function` with a
 * mocked `self` (event listeners, skipWaiting, claim), `caches`
 * (in-memory stores), and `fetch` (per-test responses).
 */

interface MockResponse {
  ok: boolean;
  status: number;
  body: string;
  clone(): MockResponse;
}

function mockResponse(body: string, ok = true): MockResponse {
  const res: MockResponse = {
    ok,
    status: ok ? 200 : 404,
    body,
    clone() {
      return mockResponse(body, ok);
    },
  };
  return res;
}

type MockRequest = { url: string; mode: string; method: string };

function mockRequest(
  url: string,
  mode = "navigate",
  method = "GET",
): MockRequest {
  return { url, mode, method };
}

interface WorkerEnv {
  skipped: boolean;
  claimed: boolean;
  fetchCalls: string[];
  failUrls: Set<string>;
  stores: Map<string, Map<string, MockResponse>>;
  listeners: Record<string, ((event: any) => void)[]>;
}

function loadWorker(source: string, failUrls: string[] = []): WorkerEnv {
  const env: WorkerEnv = {
    skipped: false,
    claimed: false,
    fetchCalls: [],
    failUrls: new Set(failUrls),
    stores: new Map(),
    listeners: {},
  };
  const resolve = (url: string) =>
    url.startsWith("/") ? `${ORIGIN}${url}` : url;
  const fetchMock = async (input: string | { url: string }) => {
    const url = resolve(typeof input === "string" ? input : input.url);
    env.fetchCalls.push(url);
    if (env.failUrls.has(url)) {
      throw new Error(`fetch failed: ${url}`);
    }
    return mockResponse(`network:${url}`);
  };
  const cachesMock = {
    open: async (name: string) => {
      let store = env.stores.get(name);
      if (!store) {
        store = new Map();
        env.stores.set(name, store);
      }
      return {
        add: async (url: string) => {
          const response = await fetchMock(url);
          if (!response.ok) {
            throw new Error(`cache.add failed: ${url}`);
          }
          store!.set(resolve(url), response);
        },
        match: async (request: string | { url: string }) => {
          const url = resolve(
            typeof request === "string" ? request : request.url,
          );
          return store!.get(url);
        },
        put: async (
          request: string | { url: string },
          response: MockResponse,
        ) => {
          const url = resolve(
            typeof request === "string" ? request : request.url,
          );
          store!.set(url, response);
        },
        keys: async () => [...store!.keys()].map((url) => ({ url })),
      };
    },
    keys: async () => [...env.stores.keys()],
    delete: async (name: string) => env.stores.delete(name),
  };
  const selfMock = {
    addEventListener: (type: string, fn: (event: any) => void) => {
      (env.listeners[type] ??= []).push(fn);
    },
    skipWaiting: async () => {
      env.skipped = true;
    },
    clients: {
      claim: async () => {
        env.claimed = true;
      },
    },
    location: { origin: ORIGIN },
  };
  const responseMock = {
    error: () => mockResponse("error", false),
  };
  const run = new Function("self", "caches", "fetch", "Response", source);
  run(selfMock, cachesMock, fetchMock, responseMock);
  return env;
}

async function dispatchInstall(env: WorkerEnv): Promise<void> {
  const pending: Promise<unknown>[] = [];
  const event = { waitUntil: (p: Promise<unknown>) => pending.push(p) };
  for (const fn of env.listeners.install ?? []) {
    fn(event);
  }
  await Promise.all(pending);
}

async function dispatchActivate(env: WorkerEnv): Promise<void> {
  const pending: Promise<unknown>[] = [];
  const event = { waitUntil: (p: Promise<unknown>) => pending.push(p) };
  for (const fn of env.listeners.activate ?? []) {
    fn(event);
  }
  await Promise.all(pending);
}

async function dispatchFetch(
  env: WorkerEnv,
  request: MockRequest,
): Promise<MockResponse | null> {
  let responded: Promise<unknown> | null = null;
  const event = {
    request,
    respondWith: (p: Promise<unknown>) => {
      responded = p;
    },
  };
  for (const fn of env.listeners.fetch ?? []) {
    fn(event);
  }
  if (!responded) {
    return null;
  }
  return (await responded) as MockResponse;
}

function workerSource(version = "v1", basePath = "/"): string {
  return buildServiceWorkerContent({ basePath, version });
}

describe("worker lifecycle", () => {
  test("install precaches the shell and takes over at once", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    expect(env.skipped).toBe(true);
    const shell = env.stores.get("porto-shell-v1");
    expect(shell).toBeDefined();
    for (const entry of serviceWorkerPrecache("/")) {
      expect(shell!.has(`${ORIGIN}${entry}`)).toBe(true);
    }
  });

  test("install tolerates a missing precache file", async () => {
    const env = loadWorker(workerSource(), [
      `${ORIGIN}/favicon/apple-touch-icon.png`,
    ]);
    await dispatchInstall(env);
    expect(env.skipped).toBe(true);
    const shell = env.stores.get("porto-shell-v1");
    expect(shell!.has(`${ORIGIN}/`)).toBe(true);
    expect(shell!.has(`${ORIGIN}/offline/`)).toBe(true);
    expect(shell!.has(`${ORIGIN}/favicon/apple-touch-icon.png`)).toBe(false);
  });

  test("activate drops old caches and claims the pages", async () => {
    const env = loadWorker(workerSource());
    env.stores.set("porto-shell-old", new Map());
    env.stores.set("porto-pages-old", new Map());
    env.stores.set("porto-shell-v1", new Map());
    await dispatchActivate(env);
    expect(env.claimed).toBe(true);
    expect([...env.stores.keys()]).toEqual(["porto-shell-v1"]);
  });
});

describe("worker fetch", () => {
  test("a visited page loads from cache when offline", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    const pages = new Map([
      [`${ORIGIN}/docs/config/`, mockResponse("cached config page")],
    ]);
    env.stores.set("porto-pages-v1", pages);
    // Offline: every network fetch fails.
    env.failUrls.add(`${ORIGIN}/docs/config/`);
    const response = await dispatchFetch(
      env,
      mockRequest(`${ORIGIN}/docs/config/`),
    );
    expect(response?.body).toBe("cached config page");
  });

  test("an unvisited page falls back to the offline page when offline", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    env.failUrls.add(`${ORIGIN}/docs/progressive-web-app/`);
    const response = await dispatchFetch(
      env,
      mockRequest(`${ORIGIN}/docs/progressive-web-app/`),
    );
    expect(response?.body).toBe(`network:${ORIGIN}/offline/`);
  });

  test("a navigation caches the network response for next time", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    const response = await dispatchFetch(
      env,
      mockRequest(`${ORIGIN}/docs/config/`),
    );
    expect(response?.body).toBe(`network:${ORIGIN}/docs/config/`);
    const pages = env.stores.get("porto-pages-v1");
    expect(pages?.get(`${ORIGIN}/docs/config/`)?.body).toBe(
      `network:${ORIGIN}/docs/config/`,
    );
  });

  test("hashed app files are cache-first and never refetched", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    const statics = new Map([
      [`${ORIGIN}/_next/static/chunks/x.js`, mockResponse("cached chunk")],
    ]);
    env.stores.set("porto-static-v1", statics);
    const response = await dispatchFetch(
      env,
      mockRequest(`${ORIGIN}/_next/static/chunks/x.js`, "same-origin"),
    );
    expect(response?.body).toBe("cached chunk");
    expect(env.fetchCalls).not.toContain(`${ORIGIN}/_next/static/chunks/x.js`);
  });

  test("a hashed app file is cached on its first load", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    const response = await dispatchFetch(
      env,
      mockRequest(`${ORIGIN}/_next/static/chunks/y.js`, "same-origin"),
    );
    expect(response?.body).toBe(`network:${ORIGIN}/_next/static/chunks/y.js`);
    const statics = env.stores.get("porto-static-v1");
    expect(statics?.get(`${ORIGIN}/_next/static/chunks/y.js`)?.body).toBe(
      `network:${ORIGIN}/_next/static/chunks/y.js`,
    );
  });

  test("the static prefix follows the base path", async () => {
    const env = loadWorker(workerSource("v1", "/porto-astro/"));
    await dispatchInstall(env);
    const statics = new Map([
      [
        `${ORIGIN}/porto-astro/_next/static/chunks/x.js`,
        mockResponse("cached chunk"),
      ],
    ]);
    env.stores.set("porto-static-v1", statics);
    const based = await dispatchFetch(
      env,
      mockRequest(
        `${ORIGIN}/porto-astro/_next/static/chunks/x.js`,
        "same-origin",
      ),
    );
    expect(based?.body).toBe("cached chunk");
    // An unprefixed _next URL is outside the site's base — the
    // worker leaves it alone.
    const root = await dispatchFetch(
      env,
      mockRequest(`${ORIGIN}/_next/static/chunks/x.js`, "same-origin"),
    );
    expect(root).toBeNull();
  });

  test("non-GET, cross-origin, and other requests pass through", async () => {
    const env = loadWorker(workerSource());
    await dispatchInstall(env);
    // The install fetched the precache list — clear the record so
    // only the test's own fetches are counted below.
    env.fetchCalls = [];
    expect(
      await dispatchFetch(
        env,
        mockRequest(`${ORIGIN}/docs/config/`, "navigate", "POST"),
      ),
    ).toBeNull();
    expect(
      await dispatchFetch(env, mockRequest("https://other.com/page")),
    ).toBeNull();
    expect(
      await dispatchFetch(
        env,
        mockRequest(`${ORIGIN}/img/photo.png`, "same-origin"),
      ),
    ).toBeNull();
    expect(env.fetchCalls).toEqual([]);
  });
});

describe("syncServiceWorker", () => {
  const silentLogger = { info: () => {} };

  test("writes the worker when enabled", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-sw-"));
    try {
      const publicDir = path.join(root, "public");
      await syncServiceWorker({
        publicDir,
        enable: true,
        basePath: "/porto-astro/",
        logger: silentLogger,
      });
      const content = fs.readFileSync(path.join(publicDir, "sw.js"), "utf-8");
      expect(content).toContain('const VERSION = "');
      expect(content).toContain("/porto-astro/offline/");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("removes a stale worker when disabled", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-sw-"));
    try {
      const publicDir = path.join(root, "public");
      fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(path.join(publicDir, "sw.js"), "old worker");
      await syncServiceWorker({
        publicDir,
        enable: false,
        basePath: "/",
        logger: silentLogger,
      });
      expect(fs.existsSync(path.join(publicDir, "sw.js"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("never touches the user's own worker (a symlink)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-sw-"));
    try {
      const publicDir = path.join(root, "public");
      fs.mkdirSync(publicDir, { recursive: true });
      const target = path.join(root, "my-sw.js");
      fs.writeFileSync(target, "my worker");
      fs.symlinkSync(target, path.join(publicDir, "sw.js"));
      await syncServiceWorker({
        publicDir,
        enable: true,
        basePath: "/",
        logger: silentLogger,
      });
      expect(fs.readFileSync(path.join(publicDir, "sw.js"), "utf-8")).toBe(
        "my worker",
      );
      await syncServiceWorker({
        publicDir,
        enable: false,
        basePath: "/",
        logger: silentLogger,
      });
      expect(fs.existsSync(path.join(publicDir, "sw.js"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
