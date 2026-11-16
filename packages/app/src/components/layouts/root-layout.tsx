import type { ReactNode } from "react";
import type { PortosaurOptions } from "../../lib/config.ts";
import { PortoProvider } from "../../lib/porto-context.tsx";
import { NavProgress } from "../pages/frame/NavProgress.tsx";
import { SkipLink } from "../pages/frame/SkipLink.tsx";

/**
 * RootLayout — the generated root's `app/layout.tsx` renders this.
 * Owns `<html>`/`<body>`, the pre-paint scripts (theme +
 * sidebar collapse), the config provider, the skip link, and
 * the nav progress bar.
 *
 * The navbar + footer live in `SiteShell`, NOT here: the root
 * layout can't know the route (server components can't read the
 * pathname, and `headers()` would break static export), so
 * route-dependent shell props (`isHome`, `hasSidebar`,
 * `menuChildren`) can't live here. DocsLayout and the standalone
 * page components render SiteShell themselves.
 *
 * The pre-paint scripts run before first paint — synchronous
 * inline scripts as the first children of `<body>` execute
 * during parsing, before anything is painted — so the stored
 * theme and the stored sidebar collapse apply with no flash.
 * They live in `<body>` because the App Router manages `<head>`.
 * `suppressHydrationWarning` on `<html>` is the standard
 * Next.js escape for the scripts changing `data-theme` and the
 * class list before hydration.
 */
export function RootLayout({
  config,
  children,
}: {
  config: PortosaurOptions;
  children: ReactNode;
}) {
  const defaultMode = config.theme.defaultMode ?? "dark";
  const scheme = config.theme.colorScheme || "portosaur";
  const defaultModeJson = JSON.stringify(defaultMode);
  const themeScript = `(function(){try{var stored=localStorage.getItem("theme");var mode=stored==="light"||stored==="dark"?stored:(stored==="auto"?(window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):${defaultModeJson});document.documentElement.setAttribute("data-theme",mode);}catch(error){document.documentElement.setAttribute("data-theme",${defaultModeJson});}})();`;
  // The visitor's own collapse choice, remembered for the
  // session (same key MobileMenu writes): a collapsed sidebar
  // stays collapsed across reloads until the tab closes, with
  // no flash — the class lands before first paint, and the
  // takeover effect in MobileMenu picks the state up from the
  // same key. On pages without a sidebar the class is harmless
  // (every collapsed rule scopes to the sidebar frame) and the
  // sync effect removes it on mount.
  const sidebarScript = `(function(){try{if(sessionStorage.getItem("porto-sidebar-collapsed") === "1"){document.documentElement.classList.add("porto-sidebar-collapsed");}}catch(error){}})();`;

  return (
    <html
      lang="en"
      data-theme={defaultMode}
      data-scheme={scheme}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: sidebarScript }} />
        <PortoProvider config={config}>
          <SkipLink />
          <NavProgress />
          {children}
        </PortoProvider>
      </body>
    </html>
  );
}
