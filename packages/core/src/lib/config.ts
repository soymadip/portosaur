/**
 * The resolved site configuration — the core package's copy of the
 * `PortosaurOptions` interface. The canonical shape lives in the CLI
 * engine (`packages/cli/src/engine/generators/siteConfig.ts`), which
 * RUNS `buildSiteConfig()`. This copy is type-only, for the UI. Keep
 * the two identical: the generated `lib/config.ts` is checked against
 * this type at `next build` time, so a drift shows up as a type error.
 */

export interface PortoPkg {
  version?: string;
  [key: string]: any;
}

export interface PortoPaths {
  assets?: string;
  root?: string;
  theme?: string;
  static?: string;
  [key: string]: any;
}

/**
 * The resolved site configuration returned by `buildSiteConfig` — the
 * integration's options object. All `config.yml` values are resolved here
 * (vars substituted, URLs auto-resolved, defaults applied).
 */
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
    content: {
      addMdxDesc: boolean;
      mermaid: boolean;
      renderEmojiShortcodes: boolean;
      onBrokenLinks: string;
      onBrokenImages: string;
      toc: { enable: boolean; minLevel: number; maxLevel: number };
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
    collapsableSidebar: boolean;
    autoCollapse: boolean;
    sidebarCollapsed: boolean;
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
  portoVersion: string;
  lastUpdated: string;
  projectDir: string;
  portoPaths: Record<string, any>;
  cssFiles: string[];
  extraHeadTags: any[];
  userVars: Record<string, any>;
}
