/**
 * Portosaur Astro integration (Phase 2, D13).
 *
 * This is the application: it receives the resolved site config as
 * options (embedded in the generated `.portosaur/astro.config.mjs` shim),
 * injects the site's routes, configures markdown, and runs the
 * build-time pipelines (site assets, static merge, Pagefind index) that
 * the old Docusaurus plugin owned.
 *
 * Virtual modules (registered through `updateConfig({ vite: { plugins } })`
 * — `addVitePlugin` is not part of the documented Integration API):
 *
 * - `porto:config` — the resolved `PortosaurOptions` object.
 * - `porto:sidebar` — the notes/docs sidebar tree, built by scanning the
 *   content dir from disk (`getCollection` is not available inside a Vite
 *   plugin's `load()`).
 * - `porto:icons` — icon id → SVG string map. Stubbed to an empty map in
 *   Phase 2; the real scan (ported from `src/plugins/iconsPlugin.ts`)
 *   lands with the icon system in Phase 4.
 * - `porto:user-css` — re-exports the user's `theme.custom_css` files
 *   (and a custom scheme file, when `theme.color_scheme` points at a
 *   path) as CSS imports, so Vite bundles them. BaseLayout imports it
 *   AFTER the theme CSS entry, so user rules win the cascade — the
 *   `<link>` approach can't do that, because Astro appends its bundled
 *   stylesheet links at the end of `<head>`, after any manual links.
 *
 * Build hooks: `astro:build:start` generates the site assets (favicons,
 * manifest, screenshots) into a staging dir (`.portosaur/static`) —
 * writing directly to outDir there is unsafe because Astro may wipe it
 * during the build. `astro:build:done` copies the staged assets and the
 * theme's `static/` files into the finished outDir, then builds the
 * Pagefind search index over the emitted HTML. Dev mode never runs the
 * build hooks, so `astro:server:setup` generates the staged assets once
 * and serves them (plus theme `static/`) through Vite middleware.
 *
 * Styling is Tailwind v4 (CSS-first config, `@tailwindcss/vite`) + the
 * token system (`src/css/tokens.css`). The Tailwind Vite plugin is
 * registered here so the theme CSS entry (`src/css/custom.css`) is
 * processed whenever a layout imports it.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";

import * as pagefind from "pagefind";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import type { AstroIntegration } from "astro";

import { portosaurMdxOptions } from "./mdx.ts";
import {
  guessDocPermalink,
  parseFileFrontmatter,
  isIndexBase,
} from "./utils/slug.ts";
import type { Frontmatter } from "./utils/slug.ts";
import { buildSidebar } from "./utils/sidebar.ts";
import type { SidebarCategoryItem } from "./utils/sidebar.ts";
import { generateSiteAssets } from "./utils/assets.ts";

/**
 * Options for the Portosaur Astro integration (Phase 2).
 *
 * The resolved site config, produced by the CLI's config engine
 * (`buildSiteConfig`) and embedded in the generated `astro.config.mjs`
 * shim. This interface mirrors `PortosaurOptions` in
 * `@portosaur/cli`'s config engine — the theme has no
 * `@portosaur` dependencies (D11), so the shape is duplicated here.
 * Keep the two in sync.
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

/** The `astro:config:setup` logger methods the integration uses. */
interface SetupLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

// App package root, derived from this file's location:
// `packages/app/src/` -> `packages/app/`.
const appRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * Recursively copies `src` into `dest`. When `overwrite` is false,
 * existing files are left alone (app static files are defaults — user
 * files already in the output win).
 */
function copyDirRecursive(src: string, dest: string, overwrite: boolean): void {
  if (!fs.existsSync(src)) {
    return;
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(from, to, overwrite);
    } else if (overwrite || !fs.existsSync(to)) {
      fs.copyFileSync(from, to);
    }
  }
}

/**
 * Minimal extension -> Content-Type map for the dev-assets middleware
 * (generated assets are favicons, images, the manifest, and PDFs).
 */
const DEV_ASSET_MIME_TYPES: Record<string, string> = {
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".txt": "text/plain",
  ".xml": "application/xml",
};

/**
 * The `options.cssFiles` entries that live inside the user project —
 * the user's `theme.custom_css` files and a custom scheme file, when
 * `theme.color_scheme` points at a path. The theme's own files live
 * outside the project and are excluded (they're already bundled via
 * BaseLayout's `custom.css` import). Returned as absolute paths for
 * the `porto:user-css` virtual module to import.
 */
function projectLocalCssFiles(
  projectDir: string,
  cssFiles: string[] | undefined,
): string[] {
  const out: string[] = [];
  for (const file of cssFiles ?? []) {
    const rel = path.relative(projectDir, file).split(path.sep).join("/");
    if (!rel || rel.startsWith("..")) {
      continue;
    }
    out.push(file);
  }
  return out;
}

/**
 * Creates Vite dev middleware serving the given dirs at `/`, first match
 * wins. Only responds when the request path names a file that exists on
 * disk; otherwise it calls `next()`, so real routes are never shadowed.
 * Path traversal is rejected by checking the resolved path stays inside
 * the served dir.
 */
function createDevAssetsMiddleware(dirs: string[]) {
  return (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ): void => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
    } catch {
      next();
      return;
    }
    const relative = pathname.replace(/^\/+/, "");
    if (!relative) {
      next();
      return;
    }
    for (const dir of dirs) {
      const file = path.resolve(dir, relative);
      if (!file.startsWith(dir + path.sep)) {
        continue;
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        continue;
      }
      const ext = path.extname(file).toLowerCase();
      res.setHeader(
        "Content-Type",
        DEV_ASSET_MIME_TYPES[ext] ?? "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-cache");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      fs.createReadStream(file).pipe(res);
      return;
    }
    next();
  };
}

/**
 * Recursively collects `.mdx` files under `dir`, returning paths relative
 * to `dir` with forward slashes.
 */
function collectMdxFiles(
  dir: string,
  base: string = dir,
  out: string[] = [],
): string[] {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectMdxFiles(full, base, out);
    } else if (entry.name.endsWith(".mdx")) {
      out.push(path.relative(base, full).split(path.sep).join("/"));
    }
  }
  return out;
}

/**
 * Builds the sidebar tree for the notes/docs collection by scanning the
 * content dir from disk. Mirrors what the routes do with `getCollection`
 * (same slug algorithm, same builder), so the virtual module and the
 * pages always agree.
 */
function buildSidebarTree({
  projectDir,
  notesDir,
  notesRoute,
  siteMode,
}: {
  projectDir: string;
  notesDir: string;
  notesRoute: string;
  siteMode: "docs" | "portfolio";
}): SidebarCategoryItem[] {
  const contentDir = path.join(projectDir, notesDir);
  const files = collectMdxFiles(contentDir);

  // First pass: frontmatter + custom slugs of index files, keyed by their
  // raw directory path (the slug util looks parents up by raw path).
  const frontmatterByFile = new Map<string, Frontmatter>();
  const parentSlugs: Record<string, string> = {};
  for (const file of files) {
    const data = parseFileFrontmatter(path.join(contentDir, file)) ?? {};
    frontmatterByFile.set(file, data);
    const segments = file.split("/");
    const base = segments[segments.length - 1].replace(/\.mdx$/, "");
    if (isIndexBase(base) && data.slug) {
      parentSlugs[segments.slice(0, -1).join("/")] = data.slug;
    }
  }

  const entries = files.map((file) => {
    const id = file.replace(/\.mdx$/, "");
    const data = frontmatterByFile.get(file) ?? {};
    const { slug } = guessDocPermalink(file, data, parentSlugs);
    return { id, slug, data };
  });

  return buildSidebar(entries, {
    rootLabel: siteMode === "docs" ? "Docs" : "Notes",
    routeBase: `/${notesRoute}`,
  });
}

/**
 * The Portosaur Astro integration.
 *
 * Receives the resolved config as options, injects the site's routes,
 * configures markdown, and runs the build-time pipelines (site assets,
 * static merge, Pagefind index). Exposes the config as the
 * `porto:config` virtual module and the sidebar tree as `porto:sidebar`.
 *
 * @param options - Resolved site config from the CLI, embedded in the generated `astro.config.mjs` shim.
 * @returns The Astro integration object.
 */
export default function portosaur(
  options: PortosaurOptions = {} as PortosaurOptions,
): AstroIntegration {
  const site = options.site ?? {};
  const theme = options.theme ?? {};
  const siteMode = options.siteMode ?? "portfolio";
  const notesDir = site.notesDir ?? "notes";
  const notesRoute = site.notesRoute ?? "notes";
  const blogDir = site.blogDir ?? "blog";
  const blogRoute = site.blogRoute ?? "blog";
  const projectDir = options.projectDir ?? process.cwd();
  const stageDir = path.join(projectDir, ".portosaur", "static");

  // The `astro:config:setup` logger, kept for the build hooks (their own
  // logger arg is version-dependent).
  let setupLogger: SetupLogger | null = null;
  const log = (level: "info" | "warn" | "error", message: string): void => {
    const logger = setupLogger;
    if (logger && typeof logger[level] === "function") {
      logger[level](message);
    } else {
      console.log(`[portosaur] ${message}`);
    }
  };

  // One Vite plugin serving all three virtual modules.
  const portoVirtualModules = {
    name: "porto-virtual-modules",
    resolveId(id: string): string | null {
      if (
        id === "porto:config" ||
        id === "porto:sidebar" ||
        id === "porto:icons" ||
        id === "porto:user-css"
      ) {
        return `\0${id}`;
      }
      return null;
    },
    load(id: string): string | null {
      if (id === "\0porto:config") {
        return `export default ${JSON.stringify(options)};`;
      }
      if (id === "\0porto:sidebar") {
        const tree = buildSidebarTree({
          projectDir,
          notesDir,
          notesRoute,
          siteMode,
        });
        return `export default ${JSON.stringify(tree)};`;
      }
      if (id === "\0porto:icons") {
        // Stub in Phase 2 (see the module doc comment): the real icon
        // scan lands with the icon system in Phase 4.
        return "export default {};";
      }
      if (id === "\0porto:user-css") {
        // The user's custom CSS as side-effect imports — Vite bundles
        // them in import order, after the theme CSS entry (BaseLayout
        // imports this module after `custom.css`), so user rules win.
        // Empty when the user has no custom CSS.
        return projectLocalCssFiles(projectDir, options.cssFiles)
          .map((file) => `import ${JSON.stringify(file)};`)
          .join("\n");
      }
      return null;
    },
  };

  return {
    name: "@portosaur/app",
    hooks: {
      "astro:config:setup"({
        updateConfig,
        injectRoute,
        addWatchFile,
        logger,
      }) {
        setupLogger = logger;

        // Virtual modules + content-dir aliases, plus the Tailwind v4 Vite
        // plugin (CSS-first config; the theme CSS entry is
        // `src/css/custom.css`, imported by BaseLayout).
        updateConfig({
          vite: {
            plugins: [tailwindcss(), portoVirtualModules],
            resolve: {
              alias: {
                "@portosaur-notes": path.resolve(projectDir, notesDir),
                "@portosaur-blog": path.resolve(projectDir, blogDir),
              },
            },
          },
        });

        // Markdown processor: Astro 7 defaults to Sätteri, which runs no
        // remark/rehype plugins, and the `mdx()` plugin options are
        // deprecated and ignored. The supported path is a `unified`
        // processor from `@astrojs/markdown-remark` set as
        // `markdown.processor` — MDX inherits it. The plugin list
        // (math, {vars.*}, icons, admonitions, emoji) and the Shiki
        // themes come from `portosaurMdxOptions`.
        const mdxOptions = portosaurMdxOptions({
          userVars: options.userVars ?? {},
          colorScheme: theme.colorScheme,
        });
        updateConfig({
          markdown: {
            processor: unified({
              remarkPlugins: mdxOptions.remarkPlugins,
              rehypePlugins: mdxOptions.rehypePlugins,
            }),
            shikiConfig: mdxOptions.shikiConfig,
          },
        });

        // Rebuild when the user's config changes (the CLI regenerates the
        // shim, which restarts the dev server).
        const configFile = ["config.yml", "config.yaml"]
          .map((name) => path.join(projectDir, name))
          .find((file) => fs.existsSync(file));
        if (configFile) {
          addWatchFile(configFile);
        }

        const route = (pattern: string, entry: string): void => {
          injectRoute({
            pattern,
            entrypoint: new URL(entry, import.meta.url),
            prerender: true,
          });
        };

        // Home (mode-aware: portfolio hero vs docs landing).
        route("/", "./pages/index.astro");

        // Notes/docs index — the category listing. In docs mode this is
        // `/docs`; in portfolio mode `/notes` is the NoteCards page (see
        // below), so the listing is only injected in docs mode.
        if (siteMode === "docs") {
          route(`/${notesRoute}`, "./pages/notes-index.astro");
        }

        // NoteCards page — exists in both modes (the golden docs build
        // has `/notes/` even in docs mode).
        route("/notes", "./pages/notecards.astro");

        // Note/doc detail pages.
        route(`/${notesRoute}/[...slug]`, "./pages/doc.astro");

        // Blog: index, pagination, posts, tags, authors, archive.
        route(`/${blogRoute}`, "./pages/blog-index.astro");
        route(`/${blogRoute}/page/[page]`, "./pages/blog-page.astro");
        route(`/${blogRoute}/[...slug]`, "./pages/blog-post.astro");
        // The tags index and the archive exist only when the blog has
        // posts — Docusaurus generates neither for an empty blog (the
        // docs site's blog has no posts, and its golden has no
        // `/blog/tags/` or `/blog/archive/`). The authors index is
        // unconditional: it lists `authors.yml`, which exists even
        // without posts.
        const hasBlogPosts =
          collectMdxFiles(path.join(projectDir, blogDir)).length > 0;
        if (hasBlogPosts) {
          route(`/${blogRoute}/tags`, "./pages/blog-tags.astro");
          route(`/${blogRoute}/archive`, "./pages/blog-archive.astro");
        }
        route(`/${blogRoute}/tags/[tag]`, "./pages/blog-tag.astro");
        route(`/${blogRoute}/authors`, "./pages/blog-authors.astro");
        route(`/${blogRoute}/authors/[author]`, "./pages/blog-author.astro");

        // Utility pages.
        route("/tasks", "./pages/tasks.astro");
        route("/offline", "./pages/offline.astro");
        route("/redirect", "./pages/redirect.astro");
        route("/search", "./pages/search.astro");
        route("/404", "./pages/404.astro");

        // robots.txt — an endpoint, not a page.
        route("/robots.txt", "./pages/robots.txt.ts");

        log(
          "info",
          `portosaur: serving "${site.title ?? "Untitled site"}" (${siteMode} mode)`,
        );
      },

      async "astro:server:setup"({ server }) {
        // Dev mode never runs `astro:build:start`, so without this the
        // generated assets (favicons, manifest) 404 in dev. Generate
        // them once into the same staging dir — the hash cache makes
        // repeat starts fast — then serve the staged files (plus the
        // theme's `static/` as fallback) through Vite middleware. A
        // generation failure must not kill the dev server, so it only
        // warns here (the build hook still treats it as fatal).
        try {
          await generateSiteAssets({
            projectDir,
            options,
            stageDir,
            logger: setupLogger,
          });
        } catch (error) {
          log(
            "warn",
            `portosaur: dev asset generation failed (${(error as Error).message}) — favicons/manifest may 404`,
          );
        }
        server.middlewares.use(
          createDevAssetsMiddleware([stageDir, path.join(appRoot, "static")]),
        );
      },

      async "astro:build:start"() {
        // Generate the site assets (favicons, manifest, screenshots)
        // into the staging dir; they are copied into the finished
        // output in `astro:build:done`.
        const { extraHeadTags } = await generateSiteAssets({
          projectDir,
          options,
          stageDir,
          logger: setupLogger,
        });
        if (extraHeadTags && extraHeadTags.length > 0) {
          log(
            "info",
            `portosaur: generated ${extraHeadTags.length} asset head tags`,
          );
        }
      },

      async "astro:build:done"({ dir }) {
        const outDir = fileURLToPath(dir);

        // Staged generated assets (overwrite — they are derived from the
        // user's own config) …
        copyDirRecursive(stageDir, outDir, true);
        // … then theme static defaults (user files already in the output
        // win — Astro copied the project's `static/` via `publicDir`).
        copyDirRecursive(path.join(appRoot, "static"), outDir, false);

        // Pagefind search index over the emitted HTML.
        try {
          const { index } = await pagefind.createIndex();
          const { page_count } = await index!.addDirectory({ path: outDir });
          await index!.writeFiles({
            outputPath: path.join(outDir, "pagefind"),
          });
          await pagefind.close();
          log("info", `portosaur: indexed ${page_count} pages with Pagefind`);
        } catch (error) {
          log(
            "warn",
            `portosaur: Pagefind indexing failed (${(error as Error).message}) — search will be empty`,
          );
        }
      },
    },
  };
}
