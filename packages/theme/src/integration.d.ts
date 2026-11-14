/**
 * Options for the Portosaur Astro integration (Phase 2).
 *
 * The resolved site config, produced by the CLI's config engine
 * (`buildSiteConfig`) and embedded in the generated `astro.config.mjs`
 * shim. This interface mirrors `PortosaurOptions` in
 * `@portosaur/cli`'s engine `index.d.ts` — the theme has no
 * `@portosaur` dependencies (D11), so the shape is duplicated here.
 * Keep the two in sync.
 */

import type { AstroIntegration } from "astro";

export interface PortosaurOptions {
  site: {
    url: string;
    baseUrl: string;
    title: string;
    tagline: string;
    favicon: string;
    socialCard?: string;
    editUrl: string;
    headTags: any[];
    notesDir: string;
    notesRoute: string;
    blogDir: string;
    blogRoute: string;
    onBrokenLinks: string;
    onBrokenAnchors: string;
    markdown: {
      mermaid: boolean;
      renderEmojiShortcodes: boolean;
      onBrokenLinks: string;
      onBrokenImages: string;
    };
    rss: { enable: boolean; desc: string; copyright: string };
    pwa: { enable: boolean; notifications: boolean };
    /** Timeout in milliseconds (the config value is seconds). */
    preview: { timeout: number };
    robotsTxt: { enable: boolean; rules: any[]; customLines: string[] };
    build: { outputDir: string };
  };
  theme: {
    colorScheme: string;
    defaultMode: "light" | "dark";
    customCss: string | string[];
    showThemeSwitch: boolean;
    disableProjectLink: boolean;
    hideNavbarOnScroll: boolean;
    navbarItems: any[];
    breadcrumbs: boolean;
    collapsableSidebar: boolean;
    footer: {
      enable: boolean;
      message: string;
      disableProjectLink: boolean;
    };
  };
  siteMode: "docs" | "portfolio";
  topicList: { enableByDefaults: boolean };
  homePage: Record<string, any>;
  docsHome: Record<string, any>;
  tasks: Record<string, any>;
  tools: { linkShortener: Record<string, any> };
  portoVersion: string;
  lastUpdated: string;
  projectDir: string;
  portoPaths: Record<string, any>;
  staticDirectories: string[];
  cssFiles: string[];
  extraHeadTags: any[];
  userVars: Record<string, any>;
}

/**
 * The Portosaur Astro integration.
 *
 * Receives the resolved config as options, injects the site's routes,
 * configures markdown, and runs the build-time pipelines (site assets,
 * static merge, Pagefind index). Exposes the config as the
 * `porto:config` virtual module and the sidebar tree as `porto:sidebar`.
 */
export default function portosaur(options?: PortosaurOptions): AstroIntegration;
