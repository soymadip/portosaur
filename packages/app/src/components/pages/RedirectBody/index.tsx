"use client";

import { useEffect, useState } from "react";
import { Button } from "../../Button/index.tsx";

/**
 * The redirect interstitial's client logic (a port of the old
 * `pages/redirect.jsx` `useEffect`, verbatim): no `?url=` param →
 * `location.replace("/")`; otherwise `window.open(url, "_blank",
 * "noopener,noreferrer")` — on success `history.back()` (or `/`
 * when there is no history), on block the tap-to-open fallback
 * appears. The old code has no URL validation and neither does
 * this port.
 *
 * Reads `window.location.search` in the effect (not
 * `useSearchParams`) so no Suspense boundary is needed. The
 * effect runs on every visit: a repeat visit via client-side
 * navigation remounts this component, so the redirect re-runs.
 */
export function RedirectBody() {
  const [blocked, setBlocked] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    if (!url) {
      // No ?url= param — just go home.
      window.location.replace("/");
      return;
    }
    // Try to open in an external browser window.
    // Works on Android standalone PWA; returns null on iOS standalone.
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win) {
      // Opened successfully — navigate back inside the PWA.
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.replace("/");
      }
      return;
    }
    // window.open() was blocked (iOS standalone PWA).
    // Show a fallback the user can tap manually.
    setBlocked(true);
    setTargetUrl(url);
  }, []);

  return (
    <>
      <h2 className="porto-empty-state__title">
        {blocked ? "This page is outside the app" : "Opening in browser…"}
      </h2>
      {blocked && targetUrl && (
        <div>
          <p className="porto-empty-state__text">
            This link lives outside the portfolio app. Tap the button below to
            open it in your browser.
          </p>
          <Button variant="primary" href={targetUrl}>
            Open in browser
          </Button>
        </div>
      )}
    </>
  );
}
