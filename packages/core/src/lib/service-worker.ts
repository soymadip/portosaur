import { withBase } from "./pageUrl.ts";

/**
 * Service worker helpers — the registration gating and the
 * held install prompt, kept pure so they can be tested without
 * a browser. The component in `components/pages/frame/
 * ServiceWorker.tsx` wires them up.
 */

/**
 * The `beforeinstallprompt` event. Not in the DOM lib yet, so
 * the shape is declared here (the standard community
 * definition).
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/** The install prompt the browser offered, held until asked for. */
let deferredPrompt: BeforeInstallPromptEvent | null = null;

/** Hold the browser's install prompt instead of showing it. */
export function holdInstallPrompt(event: BeforeInstallPromptEvent): void {
  event.preventDefault();
  deferredPrompt = event;
}

/** Take the held install prompt, if the browser offered one. */
export function takeInstallPrompt(): BeforeInstallPromptEvent | null {
  const prompt = deferredPrompt;
  deferredPrompt = null;
  return prompt;
}

/**
 * Whether the worker registers for this site: the PWA switch
 * is on (it defaults to on) and the build is a production one.
 * Dev never registers — a worker caching dev output would hide
 * every edit behind a stale cache.
 */
export function shouldRegisterServiceWorker(
  config: { site?: { pwa?: { enable?: boolean } } },
  nodeEnv?: string,
): boolean {
  return config.site?.pwa?.enable !== false && nodeEnv === "production";
}

/** The worker's URL, base-prefixed (`/sw.js`, `/porto-astro/sw.js`). */
export function serviceWorkerUrl(baseUrl = "/"): string {
  return withBase("sw.js", baseUrl);
}
