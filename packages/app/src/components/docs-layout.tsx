import type * as PageTree from "fumadocs-core/page-tree";
import type { ReactNode } from "react";
import type { PortosaurOptions } from "../lib/config.ts";
import { prepareSidebar } from "../lib/sidebar.ts";
import { Sidebar } from "./Sidebar.tsx";
import { SiteShell } from "./SiteShell.tsx";

/**
 * DocsLayout — the docs/notes page frame: SiteShell (navbar,
 * mobile menu, footer) + the prepared sidebar tree + the main
 * frame around children.
 *
 * The sidebar renders inside the MobileMenu popover, which IS the
 * sidebar — persistent from 50rem up, a popover below. The TOC +
 * content panels are the doc page's job (`DocPage` renders the
 * two-column split): this layout has no headings to build a TOC
 * from, and only the page knows whether it has one.
 */
export function DocsLayout({
  config,
  tree,
  children,
}: {
  config: PortosaurOptions;
  tree: PageTree.Root;
  children: ReactNode;
}) {
  const prepared = prepareSidebar(tree);
  return (
    <SiteShell
      config={config}
      hasSidebar
      menuChildren={<Sidebar prepared={prepared} />}
    >
      <div className="main-frame main-frame--sidebar">{children}</div>
    </SiteShell>
  );
}
