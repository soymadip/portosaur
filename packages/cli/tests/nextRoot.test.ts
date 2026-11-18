import { expect, test, describe } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildNextConfigContent,
  buildSourceConfigContent,
  buildLibSourceContent,
  buildLibConfigContent,
  buildLibBlogContent,
  buildTsConfigContent,
  buildRootLayoutContent,
  buildHomePageContent,
  buildDocPageContent,
  buildNotesIndexContent,
  buildTasksPageContent,
  buildSearchPageContent,
  buildOfflinePageContent,
  buildRedirectPageContent,
  buildNotFoundContent,
  buildBlogIndexContent,
  buildBlogPostContent,
  buildBlogAuthorsContent,
  buildNextRootFiles,
} from "../src/engine/generators/nextRoot.ts";
import type { PortosaurOptions } from "../src/engine/generators/siteConfig.ts";

/** Minimal options — the generator only reads the fields listed here. */
function options(overrides: Record<string, any> = {}): PortosaurOptions {
  return {
    site: {
      url: "https://example.com",
      baseUrl: "/",
      title: "Test Site",
      tagline: "A test tagline",
      notesDir: "docs",
      notesRoute: "docs",
      blogDir: "blog",
      blogRoute: "blog",
      markdown: {
        mermaid: true,
        renderEmojiShortcodes: true,
        onBrokenLinks: "throw",
        onBrokenImages: "throw",
      },
      build: { outputDir: "build" },
      ...(overrides.site ?? {}),
    },
    theme: {
      colorScheme: "portosaur",
      customCss: [],
      ...(overrides.theme ?? {}),
    },
    siteMode: overrides.siteMode ?? "docs",
    tasks: {
      enable: false,
      title: "Tasks",
      subtitle: "My current focus",
      list: [],
      ...(overrides.tasks ?? {}),
    },
    userVars: overrides.userVars ?? { project: "Test" },
  } as PortosaurOptions;
}

function args(projectDir: string, overrides: Record<string, any> = {}) {
  return {
    projectDir,
    outDir: path.join(projectDir, "build"),
    mtime: 0,
    hasBlogPosts: true,
    devOrigins: ["127.0.0.1", "192.168.1.5"],
    ...overrides,
  };
}

describe("buildNextConfigContent", () => {
  test("emits a static-export config with the app transpiled", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const content = buildNextConfigContent(options(), args(projectDir));
      expect(content).toContain(
        'import { createMDX } from "fumadocs-mdx/next"',
      );
      expect(content).toContain('output: "export"');
      expect(content).toContain("trailingSlash: true");
      expect(content).toContain('transpilePackages: ["@portosaur/app"]');
      expect(content).toContain("images: { unoptimized: true }");
      // distDir is relative to the generated root — an absolute path
      // gets mangled by Next's path.join into a junk directory.
      expect(content).toContain('distDir: "../build"');
      expect(content).not.toContain(projectDir);
      expect(content).toContain("export default withMDX(config);");
      // Dev origins: without 127.0.0.1 + the LAN IPs, Next blocks
      // HMR from those origins with a 403 when the dev server runs
      // on --host 0.0.0.0 (localhost is allowed by Next itself).
      expect(content).toContain(
        'allowedDevOrigins: ["127.0.0.1","192.168.1.5"]',
      );
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("omits basePath at the site root and strips its trailing slash", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const root = buildNextConfigContent(options(), args(projectDir));
      expect(root).not.toContain("basePath");

      const subpath = buildNextConfigContent(
        options({ site: { baseUrl: "/porto-astro/" } }),
        args(projectDir),
      );
      expect(subpath).toContain('basePath: "/porto-astro"');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("buildSourceConfigContent", () => {
  test("delegates the MDX preset to the app's portosaurMdxOptions builder", () => {
    const content = buildSourceConfigContent(options(), 0);
    expect(content).toContain(
      'import { defineConfig } from "fumadocs-mdx/config"',
    );
    expect(content).toContain(
      'import { portosaurMdxOptions } from "@portosaur/app/mdx"',
    );
    expect(content).toContain("export default defineConfig({");
    expect(content).toContain("mdxOptions: portosaurMdxOptions({");
    // userVars is pretty-printed with indent 2, like human-written code.
    expect(content).toContain('userVars: {\n  "project": "Test"\n}');
    expect(content).toContain('colorScheme: "portosaur"');
    expect(content).toContain("renderEmojiShortcodes: true");
    // The npm plugins live inside the app package — the generated file
    // must not import them (directly or via @portosaur/app/plugins/*),
    // because they would not resolve from the generated root.
    expect(content).not.toContain("remark-math");
    expect(content).not.toContain("remark-directive");
    expect(content).not.toContain("remark-emoji");
    expect(content).not.toContain("rehype-katex");
    expect(content).not.toContain("@portosaur/app/plugins/");
  });

  test("passes renderEmojiShortcodes: false through when the site disables it", () => {
    const content = buildSourceConfigContent(
      options({
        site: {
          markdown: {
            mermaid: true,
            renderEmojiShortcodes: false,
            onBrokenLinks: "throw",
            onBrokenImages: "throw",
          },
        },
      }),
      0,
    );
    expect(content).toContain("renderEmojiShortcodes: false");
  });
});

describe("buildLibSourceContent", () => {
  test("defines the docs and blog collections with the Portosaur loader hooks", () => {
    const content = buildLibSourceContent(options(), 0);
    expect(content).toContain(
      'import { defineDocs, defineCollections } from "fumadocs-mdx/macro"',
    );
    expect(content).toContain('dir: "../docs"');
    expect(content).toContain('dir: "../blog"');
    expect(content).toContain("schema: portoDocSchema");
    expect(content).toContain("schema: portoBlogSchema");
    expect(content).toContain('baseUrl: "/docs"');
    expect(content).toContain("slugs: portoSlugs");
    expect(content).toContain(
      'sort: { by: "path", options: { numeric: true } }',
    );
    expect(content).toContain("transformers: portoTreeTransformers");
    expect(content).toContain("export const source = loader({");
    expect(content).toContain("export const blogSource = loader({");
    expect(content).toContain("export const docsLlms = llms(source, {");
    expect(content).toContain("includeProcessedMarkdown: true");
  });

  test("points the docs collection at the notes dir in portfolio mode", () => {
    const content = buildLibSourceContent(
      options({
        siteMode: "portfolio",
        site: { notesDir: "notes", notesRoute: "notes" },
      }),
      0,
    );
    expect(content).toContain('dir: "../notes"');
    expect(content).toContain('baseUrl: "/notes"');
  });
});

describe("buildLibConfigContent", () => {
  test("embeds the resolved options as typed JSON", () => {
    const content = buildLibConfigContent(options(), 0);
    expect(content).toContain(
      'import type { PortosaurOptions } from "@portosaur/app/lib/config"',
    );
    expect(content).toContain("export const config: PortosaurOptions = {");
    expect(content).toContain('"title": "Test Site"');
  });
});

describe("buildTsConfigContent", () => {
  test("allows importing .ts extensions (the app package uses them everywhere)", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-tsconfig-"));
    try {
      const content = buildTsConfigContent(args(projectDir));
      // Without this flag Next's typecheck fails with TS5097 on every
      // `@portosaur/app/*` import (explicit `.ts`/`.tsx` extensions).
      expect(content).toContain('"allowImportingTsExtensions": true');
      expect(content).toContain('"moduleResolution": "bundler"');
      // Type globs cover BOTH the export distDir (what `next dev`
      // wants) and `.next` (what `next build` wants — build
      // artifacts stay in `.next` under `output: 'export'`).
      // Emitting only one set makes the other mode rewrite the
      // tsconfig on every run.
      expect(content).toContain('"../build/types/**/*.ts"');
      expect(content).toContain('"../build/dev/types/**/*.ts"');
      expect(content).toContain('".next/types/**/*.ts"');
      expect(content).toContain('".next/dev/types/**/*.ts"');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("derives the type globs from a custom output dir", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-tsconfig-"));
    try {
      const content = buildTsConfigContent(
        args(projectDir, { outDir: path.join(projectDir, "dist") }),
      );
      expect(content).toContain('"../dist/types/**/*.ts"');
      expect(content).toContain('"../dist/dev/types/**/*.ts"');
      expect(content).toContain('".next/types/**/*.ts"');
      expect(content).toContain('".next/dev/types/**/*.ts"');
      expect(content).not.toContain("../build/types");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("buildRootLayoutContent", () => {
  test("imports the app CSS and renders the app RootLayout", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const content = buildRootLayoutContent(options(), args(projectDir));
      expect(content).toContain('import "@portosaur/app/css/global.css"');
      expect(content).toContain(
        'import { RootLayout } from "@portosaur/app/components/layouts/root-layout"',
      );
      expect(content).toContain(
        "<RootLayout config={config}>{children}</RootLayout>",
      );
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("imports the user's custom_css files relative to the generated root", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const content = buildRootLayoutContent(
        options({ theme: { customCss: "custom.css" } }),
        args(projectDir),
      );
      expect(content).toContain('import "../../custom.css";');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("buildHomePageContent", () => {
  test("renders the docs home in docs mode", () => {
    const content = buildHomePageContent(options(), 0);
    expect(content).toContain(
      'import { DocsHomePage } from "@portosaur/app/components/pages/docs-home-page"',
    );
    expect(content).toContain("<DocsHomePage config={config} />");
  });

  test("renders a placeholder in portfolio mode (Phase 3 builds the real home)", () => {
    const content = buildHomePageContent(options({ siteMode: "portfolio" }), 0);
    expect(content).not.toContain("DocsHomePage");
    expect(content).toContain("{config.site.title}");
  });

  test("titles the home Home in docs mode, Me in portfolio mode (OG rule)", () => {
    // Absolute, with the site title baked in: the root layout's
    // template never applies to the root page itself (Next quirk —
    // see the builder's doc comment).
    expect(buildHomePageContent(options(), 0)).toContain(
      'title: { absolute: "Home | Test Site" }',
    );
    expect(
      buildHomePageContent(options({ siteMode: "portfolio" }), 0),
    ).toContain('title: { absolute: "Me | Test Site" }');
  });
});

describe("static page metadata", () => {
  test("tasks title follows the tasks toggle", () => {
    // Disabled (the fixture default) — the disabled page's title.
    expect(buildTasksPageContent(options(), 0)).toContain(
      'title: "Tasks are Disabled"',
    );
    // Enabled — the configured tasks title.
    const enabled = buildTasksPageContent(
      options({ tasks: { enable: true, title: "Tasks" } }),
      0,
    );
    expect(enabled).toContain('title: "Tasks"');
  });

  test("search title is absolute (no | {site title} suffix)", () => {
    expect(buildSearchPageContent(0)).toContain(
      'title: { absolute: "Search the documentation" }',
    );
  });

  test("offline, redirect, and not-found carry their OG titles", () => {
    expect(buildOfflinePageContent(0)).toContain(`title: "You're Offline"`);
    expect(buildRedirectPageContent(0)).toContain(
      'title: "Opening in browser…"',
    );
    expect(buildNotFoundContent(0)).toContain('title: "Page Not Found"');
  });
});

describe("buildDocPageContent", () => {
  test("renders the app DocPage with static params and metadata", () => {
    const content = buildDocPageContent("docs", 0);
    expect(content).toContain(
      'import { DocPage } from "@portosaur/app/components/pages/doc-page"',
    );
    expect(content).toContain('PageProps<"/docs/[[...slug]]">');
    // The route passes the page tree (breadcrumbs/prev-next), the
    // edit URL, and the relative-link `a` override — all part of
    // DocPage's props contract.
    expect(content).toContain("tree={source.getPageTree()}");
    expect(content).toContain("editUrl={editUrl}");
    expect(content).toContain(
      "components={{ a: createRelativeLink(source, page) }}",
    );
    expect(content).toContain(
      'import { createRelativeLink } from "@portosaur/app/lib/mdx-link"',
    );
    expect(content).toContain("return source.generateParams();");
    // Metadata title is frontmatter ?? content H1 ?? file-base fallback
    // — never a bare page.data.title, which is undefined for title-less
    // pages.
    expect(content).toContain(
      'import { docPageTitles, docFileTitle } from "@portosaur/app/lib/docPage"',
    );
    expect(content).toContain(
      'import { CONTENT_TITLE_KEY } from "@portosaur/app/plugins/remarkContentTitle"',
    );
    expect(content).toContain("docPageTitles(");
    expect(content).toContain("docFileTitle(page.path)");
    expect(content).toContain("title: metaTitle");
    expect(content).not.toContain("title: page.data.title");
    expect(content).toContain("description: page.data.desc");
  });

  test("required catch-all uses [...slug] and drops the empty root slug", () => {
    const content = buildDocPageContent("notes", 0, "required");
    expect(content).toContain('PageProps<"/notes/[...slug]">');
    expect(content).not.toContain("[[...slug]]");
    // The notes index owns /notes/, so the detail route must not
    // generate the empty root slug.
    expect(content).toContain(
      "return source.generateParams().filter((p) => p.slug.length > 0);",
    );
  });
});

describe("buildBlogPostContent", () => {
  test("uses the same metadata title rule as doc pages", () => {
    const content = buildBlogPostContent(0);
    expect(content).toContain(
      'import { BlogPostPage } from "@portosaur/app/components/pages/blog-post-page"',
    );
    expect(content).toContain('PageProps<"/blog/[slug]">');
    // The route passes the post (renamed prop), the sidebar list,
    // the newer/older neighbors, the authors, and the relative-link
    // `a` override — all part of BlogPostPage's props contract.
    expect(content).toContain(
      "post={{ ...page, date: page.data.date ?? null }}",
    );
    expect(content).toContain("sidebarPosts={getBlogSidebarPosts()}");
    expect(content).toContain("newer={newer}");
    expect(content).toContain("older={older}");
    expect(content).toContain("authors={getBlogAuthors()}");
    expect(content).toContain(
      "components={{ a: createRelativeLink(blogSource, page) }}",
    );
    expect(content).toContain("docPageTitles(");
    expect(content).toContain("docFileTitle(page.path)");
    expect(content).toContain("title: metaTitle");
    expect(content).not.toContain("title: page.data.title");
    // generateParams() returns catch-all-shaped params, so the [slug]
    // params are mapped by hand.
    expect(content).toContain(
      'return blogSource.getPages().map((page) => ({ slug: page.slugs.join("/") }));',
    );
  });
});

describe("buildNotesIndexContent", () => {
  test("maps loader pages to note cards (top-level only, filename order)", () => {
    const content = buildNotesIndexContent(0);
    expect(content).toContain("NotesIndexPage,");
    expect(content).toContain("type NoteCardPage,");
    expect(content).toContain(
      '} from "@portosaur/app/components/pages/notes-index-page"',
    );
    expect(content).toContain(".filter((page) => page.slugs.length === 1)");
    expect(content).toContain("const pages: NoteCardPage[] = source");
    expect(content).toContain("docPageTitles(");
    expect(content).toContain(
      "title: route.charAt(0).toUpperCase() + route.slice(1)",
    );
  });
});

describe("buildLibBlogContent", () => {
  test("exports the shared blog helpers (authors, posts, sidebar, counts)", () => {
    const content = buildLibBlogContent(0);
    expect(content).toContain("export function getBlogAuthors()");
    expect(content).toContain("export function getBlogPosts()");
    expect(content).toContain("export function getSortedBlogPosts()");
    expect(content).toContain("export function getBlogSidebarPosts()");
    expect(content).toContain("export function getBlogAuthorsWithCounts()");
    expect(content).toContain(
      'import { loadBlogAuthors } from "@portosaur/app/lib/blog-server"',
    );
    expect(content).toContain(
      'path.join(config.projectDir, config.site.blogDir, "authors.yml")',
    );
  });
});

describe("buildBlogIndexContent", () => {
  test("passes mapped posts + authors (not raw loader pages)", () => {
    const content = buildBlogIndexContent(0);
    expect(content).toContain("posts={getBlogPosts()}");
    expect(content).toContain("authors={getBlogAuthors()}");
    expect(content).not.toContain("pages={blogSource.getPages()}");
    expect(content).toContain('return { title: "Blog" };');
  });
});

describe("buildBlogAuthorsContent", () => {
  test("passes authors with counts", () => {
    const content = buildBlogAuthorsContent(0);
    expect(content).toContain("authors={getBlogAuthorsWithCounts()}");
    expect(content).not.toContain("pages={blogSource.getPages()}");
    expect(content).toContain('return { title: "Authors" };');
  });
});

describe("buildNextRootFiles", () => {
  test("docs mode generates docs routes and skips notes detail routes", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const files = buildNextRootFiles(options(), args(projectDir));
      expect(files["app/docs/[[...slug]]/page.tsx"]).toBeDefined();
      expect(files["app/docs/layout.tsx"]).toBeDefined();
      expect(
        files["app/notes/(with-sidebar)/[...slug]/page.tsx"],
      ).toBeUndefined();
      expect(files["app/notes/(with-sidebar)/layout.tsx"]).toBeUndefined();
      // The notes index exists in both modes.
      expect(files["app/notes/page.tsx"]).toBeDefined();
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("portfolio mode generates notes routes and no docs routes", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const files = buildNextRootFiles(
        options({
          siteMode: "portfolio",
          site: { notesDir: "notes", notesRoute: "notes" },
        }),
        args(projectDir),
      );
      expect(
        files["app/notes/(with-sidebar)/[...slug]/page.tsx"],
      ).toBeDefined();
      expect(files["app/notes/(with-sidebar)/layout.tsx"]).toBeDefined();
      // No layout at the notes root: it would wrap the index too,
      // and the index renders its own shell (double navbar/footer
      // + a sidebar the index must not have).
      expect(files["app/notes/layout.tsx"]).toBeUndefined();
      expect(files["app/docs/[[...slug]]/page.tsx"]).toBeUndefined();
      expect(files["app/docs/layout.tsx"]).toBeUndefined();
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("generates the full shared file list in both modes", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      for (const mode of ["docs", "portfolio"] as const) {
        const files = buildNextRootFiles(
          options({ siteMode: mode }),
          args(projectDir),
        );
        for (const rel of [
          "next.config.mjs",
          "source.config.ts",
          "lib/source.ts",
          "lib/config.ts",
          "lib/blog.ts",
          "postcss.config.mjs",
          "tsconfig.json",
          "next-env.d.ts",
          "app/layout.tsx",
          "app/page.tsx",
          "app/notes/page.tsx",
          "app/blog/page.tsx",
          "app/blog/[slug]/page.tsx",
          "app/blog/authors/page.tsx",
          "app/tasks/page.tsx",
          "app/search/page.tsx",
          "app/offline/page.tsx",
          "app/redirect/page.tsx",
          "app/not-found.tsx",
          "app/api/search/route.ts",
          "app/sitemap.ts",
          "app/robots.ts",
          "app/llms.txt/route.ts",
          "app/llms-full.txt/route.ts",
          "app/llms.mdx/[...path]/route.ts",
        ]) {
          expect(files[rel], `${mode}: ${rel}`).toBeDefined();
        }
      }
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("only the blog post route needs a post", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const withPosts = buildNextRootFiles(options(), args(projectDir));
      expect(withPosts["app/blog/page.tsx"]).toBeDefined();
      expect(withPosts["app/blog/[slug]/page.tsx"]).toBeDefined();
      expect(withPosts["app/blog/authors/page.tsx"]).toBeDefined();

      // A post-less blog keeps its index and authors pages — they
      // are static routes that render their empty state. Only the
      // dynamic post route is skipped: under output "export" a
      // route with zero generateStaticParams fails the build.
      const withoutPosts = buildNextRootFiles(
        options(),
        args(projectDir, { hasBlogPosts: false }),
      );
      expect(withoutPosts["app/blog/page.tsx"]).toBeDefined();
      expect(withoutPosts["app/blog/authors/page.tsx"]).toBeDefined();
      expect(withoutPosts["app/blog/[slug]/page.tsx"]).toBeUndefined();
      // The shared blog helpers still exist — only the route is gated.
      expect(withoutPosts["lib/blog.ts"]).toBeDefined();
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("the search route uses the static ZBSearch export", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const files = buildNextRootFiles(options(), args(projectDir));
      const search = files["app/api/search/route.ts"];
      expect(search).toContain(
        'import { createFromSource } from "fumadocs-core/search/server"',
      );
      expect(search).toContain(
        "export const { staticGET: GET } = createFromSource(source, {",
      );
      expect(search).toContain('language: "english"');
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("the sitemap uses trailing-slash page URLs", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const files = buildNextRootFiles(options(), args(projectDir));
      const sitemap = files["app/sitemap.ts"];
      expect(sitemap).toContain(
        'import { pageHref } from "@portosaur/app/lib/pageUrl"',
      );
      expect(sitemap).toContain("pageHref(url)");
      expect(sitemap).toContain("source.getPages()");
      expect(sitemap).toContain("blogSource.getPages()");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
