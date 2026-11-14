/// <reference types="astro/client" />

/**
 * Ambient declarations for modules tsc can't resolve on its own.
 *
 * - `porto:*` — virtual modules registered by the integration's Vite
 *   plugin (`src/integration.ts`); their shapes mirror what the plugin's
 *   `load()` returns.
 * - `*.astro` — `astro/client` declares `*.md`/`*.mdx` and assets but
 *   NOT `*.astro` components, so components get a shim here typed as
 *   `AstroComponentFactory`.
 * - `@iconify-json/<pack>/icons.json` — JSON imports without
 *   `resolveJsonModule`; the collections are `IconifyJSON`.
 *
 * This file is deliberately a script (no top-level imports — types are
 * referenced with inline `import()`), so the `declare module` blocks
 * are global ambient declarations.
 */

/** The resolved `PortosaurOptions` object, embedded by the integration. */
declare module "porto:config" {
  const config: import("./integration.ts").PortosaurOptions;
  export default config;
}

/**
 * The notes/docs sidebar tree — the root's children (top-level items);
 * the root index doc is hidden from it. The collection home link
 * (root index title + href, or the section label + home when no root
 * index exists) is the named `home` export, for pagination.
 */
declare module "porto:sidebar" {
  const tree: import("./utils/sidebar.ts").SidebarItem[];
  export default tree;
  export const home: import("./utils/sidebar.ts").SidebarHomeLink;
}

/**
 * Icon id → rendered SVG parts (the shape `iconsPlugin` generates).
 * Stubbed to an empty map until Phase 4.
 */
declare module "porto:icons" {
  const icons: Record<
    string,
    { attributes: Record<string, string>; body: string }
  >;
  export default icons;
}

/** Side-effect-only: re-exports the user's custom CSS files as imports. */
declare module "porto:user-css" {}

declare module "*.astro" {
  const Component: import("astro/runtime/server/index.js").AstroComponentFactory;
  export default Component;
}

declare module "@iconify-json/*/icons.json" {
  const data: import("@iconify/types").IconifyJSON;
  export default data;
}
