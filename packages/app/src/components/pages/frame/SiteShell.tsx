import type { ReactNode } from "react";
import type { PortosaurOptions } from "../../../lib/config.ts";
import { Footer } from "../parts/Footer.tsx";
import { MobileMenu } from "./MobileMenu.tsx";
import { Navbar } from "./Navbar.tsx";

/**
 * The site shell — Navbar + MobileMenu + `<main>` + Footer.
 * Rendered by DocsLayout and the standalone pages (the root
 * layout can't own it: it doesn't know the route, so it can't
 * know whether the page has a sidebar).
 *
 * `menuChildren` is the sidebar tree on docs pages (rendered
 * inside the MobileMenu popover); on other pages it is empty and
 * the menu holds only the footer.
 */
export function SiteShell({
  config,
  hasSidebar = false,
  isHome = false,
  isPortfolioHome = false,
  menuChildren,
  children,
}: {
  config: PortosaurOptions;
  hasSidebar?: boolean;
  isHome?: boolean;
  isPortfolioHome?: boolean;
  menuChildren?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <Navbar isHome={isHome} isPortfolioHome={isPortfolioHome} />
      <div className="porto-content-wrapper">
        <MobileMenu hasSidebar={hasSidebar}>{menuChildren}</MobileMenu>
        <main id="main-content">{children}</main>
      </div>
      <Footer config={config} />
    </>
  );
}
