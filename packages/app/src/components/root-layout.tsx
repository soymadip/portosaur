import type { ReactNode } from "react";
import type { PortosaurOptions } from "../lib/config.ts";
import { PortoProvider } from "../lib/porto-context.tsx";
import { NavProgress } from "./NavProgress.tsx";
import { SkipLink } from "./SkipLink.tsx";

/**
 * RootLayout — the generated root's `app/layout.tsx` renders this.
 * Owns `<html>`/`<body>`, the pre-paint theme script, the config
 * provider, the skip link, and the nav progress bar.
 *
 * The navbar + footer live in `SiteShell`, NOT here: the root
 * layout can't know the route (server components can't read the
 * pathname, and `headers()` would break static export), so
 * route-dependent shell props (`isHome`, `hasSidebar`,
 * `menuChildren`) can't live here. DocsLayout and the standalone
 * page components render SiteShell themselves.
 *
 * The pre-paint script runs before first paint — a synchronous
 * inline script as the first child of `<body>` executes during
 * parsing, before anything is painted — so the stored theme
 * applies with no flash. It lives in `<body>` because the App
 * Router manages `<head>`. `suppressHydrationWarning` on `<html>`
 * is the standard Next.js escape for the script changing
 * `data-theme` before hydration.
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
  return (
    <html
      lang="en"
      data-theme={defaultMode}
      data-scheme={scheme}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <PortoProvider config={config}>
          <SkipLink />
          <NavProgress />
          {children}
        </PortoProvider>
      </body>
    </html>
  );
}
