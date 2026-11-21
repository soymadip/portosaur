"use client";

import { useEffect } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import {
  holdInstallPrompt,
  serviceWorkerUrl,
  shouldRegisterServiceWorker,
  type BeforeInstallPromptEvent,
} from "../../../lib/service-worker.ts";

/**
 * ServiceWorker — registers the PWA worker after the page
 * loads, production only, PWA enabled only. Renders nothing.
 *
 * It also captures the browser's install prompt and holds it
 * instead of showing it: no install UI is built around it yet,
 * and the held prompt is what a future one will call on. The
 * listener is always attached — the event only ever fires when
 * the browser deems the app installable, which needs the
 * manifest and the worker in place.
 *
 * Registration failing (private mode, a stuck old worker) must
 * never break the page, so the failure is swallowed.
 */
export function ServiceWorker() {
  const config = usePortoConfig();
  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      holdInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    if (
      !shouldRegisterServiceWorker(config, process.env.NODE_ENV) ||
      !("serviceWorker" in navigator)
    ) {
      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          onBeforeInstallPrompt,
        );
      };
    }
    const register = () => {
      navigator.serviceWorker
        .register(serviceWorkerUrl(config.site.baseUrl))
        .catch(() => {
          // Registration failing must never break the page.
        });
    };
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("load", register);
    };
  }, [config]);
  return null;
}
