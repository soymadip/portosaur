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
 *   Phase 2; the real scan (ported from `src/plugins/iconsPlugin.mjs`)
 *   lands with the icon system in Phase 4.
 *
 * Build hooks: `astro:build:start` generates the site assets (favicons,
 * manifest, screenshots) into a staging dir (`.portosaur/static`) —
 * writing directly to outDir there is unsafe because Astro may wipe it
 * during the build. `astro:build:done` copies the staged assets and the
 * theme's `static/` files into the finished outDir, then builds the
 * Pagefind search index over the emitted HTML.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as pagefind from "pagefind";
import { unified } from "@astrojs/markdown-remark";

import { portosaurMdxOptions } from "./mdx.mjs";
import {
  guessDocPermalink,
  parseFileFrontmatter,
  isIndexBase,
} from "./utils/slug.mjs";
import { buildSidebar } from "./utils/sidebar.mjs";
import { generateSiteAssets } from "./lib/assets.mjs";

// Theme package root, derived from this file's location:
// `packages/theme/src/` -> `packages/theme/`.
const themeRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * Recursively copies `src` into `dest`. When `overwrite` is false,
 * existing files are left alone (theme static files are defaults — user
 * files already in the output win).
 */
function copyDirRecursive(src, dest, overwrite) {
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
 * Recursively collects `.mdx` files under `dir`, returning paths relative
 * to `dir` with forward slashes.
 */
function collectMdxFiles(dir, base = dir, out = []) {
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
function buildSidebarTree({ projectDir, notesDir, notesRoute, siteMode }) {
  const contentDir = path.join(projectDir, notesDir);
  const files = collectMdxFiles(contentDir);

  // First pass: frontmatter + custom slugs of index files, keyed by their
  // raw directory path (the slug util looks parents up by raw path).
  const frontmatterByFile = new Map();
  const parentSlugs = {};
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
    const { slug } = guessDocPermalink(
      file,
      frontmatterByFile.get(file),
      parentSlugs,
    );
    return { id, slug, data: frontmatterByFile.get(file) };
  });

  return buildSidebar(entries, {
    rootLabel: siteMode === "docs" ? "Docs" : "Notes",
    routeBase: `/${notesRoute}`,
  });
}

/**
 * The Portosaur theme integration.
 *
 * @param {import("./integration.d.ts").PortosaurOptions} options - Resolved site config from the CLI, embedded in the generated `astro.config.mjs` shim.
 * @returns {import("astro").AstroIntegration} The Astro integration object.
 */
export default function portosaur(options = {}) {
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
  let setupLogger = null;
  const log = (level, message) => {
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
    resolveId(id) {
      if (
        id === "porto:config" ||
        id === "porto:sidebar" ||
        id === "porto:icons"
      ) {
        return `\0${id}`;
      }
      return null;
    },
    load(id) {
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
      return null;
    },
  };

  return {
    name: "@portosaur/theme",
    hooks: {
      "astro:config:setup"({
        updateConfig,
        injectRoute,
        addWatchFile,
        logger,
      }) {
        setupLogger = logger;

        // Virtual modules + content-dir aliases.
        updateConfig({
          vite: {
            plugins: [portoVirtualModules],
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

        const route = (pattern, entry) =>
          injectRoute({
            pattern,
            entrypoint: new URL(entry, import.meta.url),
            prerender: true,
          });

        // Home (mode-aware: portfolio hero vs docs landing).
        route("/", "./routes/index.astro");

        // Notes/docs index — the category listing. In docs mode this is
        // `/docs`; in portfolio mode `/notes` is the NoteCards page (see
        // below), so the listing is only injected in docs mode.
        if (siteMode === "docs") {
          route(`/${notesRoute}`, "./routes/notes-index.astro");
        }

        // NoteCards page — exists in both modes (the golden docs build
        // has `/notes/` even in docs mode).
        route("/notes", "./routes/notecards.astro");

        // Note/doc detail pages.
        route(`/${notesRoute}/[...slug]`, "./routes/doc.astro");

        // Blog: index, pagination, posts, tags, authors, archive.
        route(`/${blogRoute}`, "./routes/blog-index.astro");
        route(`/${blogRoute}/page/[page]`, "./routes/blog-page.astro");
        route(`/${blogRoute}/[...slug]`, "./routes/blog-post.astro");
        // The tags index and the archive exist only when the blog has
        // posts — Docusaurus generates neither for an empty blog (the
        // docs site's blog has no posts, and its golden has no
        // `/blog/tags/` or `/blog/archive/`). The authors index is
        // unconditional: it lists `authors.yml`, which exists even
        // without posts.
        const hasBlogPosts =
          collectMdxFiles(path.join(projectDir, blogDir)).length > 0;
        if (hasBlogPosts) {
          route(`/${blogRoute}/tags`, "./routes/blog-tags.astro");
          route(`/${blogRoute}/archive`, "./routes/blog-archive.astro");
        }
        route(`/${blogRoute}/tags/[tag]`, "./routes/blog-tag.astro");
        route(`/${blogRoute}/authors`, "./routes/blog-authors.astro");
        route(`/${blogRoute}/authors/[author]`, "./routes/blog-author.astro");

        // Utility pages.
        route("/tasks", "./routes/tasks.astro");
        route("/offline", "./routes/offline.astro");
        route("/redirect", "./routes/redirect.astro");
        route("/search", "./routes/search.astro");
        route("/404", "./routes/404.astro");

        // robots.txt — an endpoint, not a page.
        route("/robots.txt", "./routes/robots.txt.ts");

        log(
          "info",
          `portosaur: serving "${site.title ?? "Untitled site"}" (${siteMode} mode)`,
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
        copyDirRecursive(path.join(themeRoot, "static"), outDir, false);

        // Pagefind search index over the emitted HTML.
        try {
          const { index } = await pagefind.createIndex();
          const { page_count } = await index.addDirectory({ path: outDir });
          await index.writeFiles({ outputPath: path.join(outDir, "pagefind") });
          await pagefind.close();
          log("info", `portosaur: indexed ${page_count} pages with Pagefind`);
        } catch (error) {
          log(
            "warn",
            `portosaur: Pagefind indexing failed (${error.message}) — search will be empty`,
          );
        }
      },
    },
  };
}
