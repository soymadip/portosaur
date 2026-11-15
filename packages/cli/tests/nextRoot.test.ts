import { expect, test, describe } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildNextConfigContent,
  buildSourceConfigContent,
  buildLibSourceContent,
  buildLibConfigContent,
  buildTsConfigContent,
  buildRootLayoutContent,
  buildHomePageContent,
  buildDocPageContent,
  buildBlogPostContent,
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
      build: { outputDir: "build" },
      ...(overrides.site ?? {}),
    },
    theme: {
      colorScheme: "portosaur",
      customCss: [],
      ...(overrides.theme ?? {}),
    },
    siteMode: overrides.siteMode ?? "docs",
    userVars: overrides.userVars ?? { project: "Test" },
  } as PortosaurOptions;
}

function args(projectDir: string) {
  return {
    projectDir,
    outDir: path.join(projectDir, "build"),
    mtime: 0,
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
      expect(content).toContain(
        `distDir: ${JSON.stringify(path.join(projectDir, "build"))}`,
      );
      expect(content).toContain("export default withMDX(config);");
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
    expect(content).toContain('userVars: {"project":"Test"}');
    expect(content).toContain('colorScheme: "portosaur"');
    // The npm plugins live inside the app package — the generated file
    // must not import them (directly or via @portosaur/app/plugins/*),
    // because they would not resolve from the generated root.
    expect(content).not.toContain("remark-math");
    expect(content).not.toContain("remark-directive");
    expect(content).not.toContain("remark-emoji");
    expect(content).not.toContain("rehype-katex");
    expect(content).not.toContain("@portosaur/app/plugins/");
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
    const content = buildTsConfigContent(0);
    // Without this flag Next's typecheck fails with TS5097 on every
    // `@portosaur/app/*` import (explicit `.ts`/`.tsx` extensions).
    expect(content).toContain('"allowImportingTsExtensions": true');
    expect(content).toContain('"moduleResolution": "bundler"');
  });
});

describe("buildRootLayoutContent", () => {
  test("imports the app CSS and renders the app RootLayout", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const content = buildRootLayoutContent(options(), args(projectDir));
      expect(content).toContain('import "@portosaur/app/css/global.css"');
      expect(content).toContain(
        'import { RootLayout } from "@portosaur/app/components/root-layout"',
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
      'import { DocsHomePage } from "@portosaur/app/components/docs-home-page"',
    );
    expect(content).toContain("<DocsHomePage config={config} />");
  });

  test("renders a placeholder in portfolio mode (Phase 3 builds the real home)", () => {
    const content = buildHomePageContent(options({ siteMode: "portfolio" }), 0);
    expect(content).not.toContain("DocsHomePage");
    expect(content).toContain("{config.site.title}");
  });
});

describe("buildDocPageContent", () => {
  test("renders the app DocPage with static params and metadata", () => {
    const content = buildDocPageContent("docs", 0);
    expect(content).toContain(
      'import { DocPage } from "@portosaur/app/components/doc-page"',
    );
    expect(content).toContain('PageProps<"/docs/[[...slug]]">');
    expect(content).toContain("<DocPage config={config} page={page} />");
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
});

describe("buildBlogPostContent", () => {
  test("uses the same metadata title rule as doc pages", () => {
    const content = buildBlogPostContent(0);
    expect(content).toContain(
      'import { BlogPostPage } from "@portosaur/app/components/blog-post-page"',
    );
    expect(content).toContain('PageProps<"/blog/[slug]">');
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

describe("buildNextRootFiles", () => {
  test("docs mode generates docs routes and skips notes detail routes", () => {
    const projectDir = mkdtempSync(path.join(tmpdir(), "porto-next-"));
    try {
      const files = buildNextRootFiles(options(), args(projectDir));
      expect(files["app/docs/[[...slug]]/page.tsx"]).toBeDefined();
      expect(files["app/docs/layout.tsx"]).toBeDefined();
      expect(files["app/notes/[[...slug]]/page.tsx"]).toBeUndefined();
      expect(files["app/notes/layout.tsx"]).toBeUndefined();
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
      expect(files["app/notes/[[...slug]]/page.tsx"]).toBeDefined();
      expect(files["app/notes/layout.tsx"]).toBeDefined();
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
