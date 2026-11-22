import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  portoDocSchema,
  portoSlugs,
  portoTreeTransformers,
} from "../src/lib/source.ts";

/**
 * Content-layer tests: the frontmatter schema, the slug function,
 * and the page-tree transformers.
 */

describe("portoDocSchema", () => {
  test("accepts a full docs frontmatter block", () => {
    const parsed = portoDocSchema.parse({
      title: "CLI Reference",
      desc: "Every command, flag, and option.",
      icon: "lu:terminal",
      color: "#60fc02",
      sidebar_label: "CLI",
      slug: "cli",
      tags: ["cli"],
      authors: ["soymadip"],
      date: "2026-11-15",
      draft: false,
      math: true,
    });
    expect(parsed.title).toBe("CLI Reference");
    expect(parsed.desc).toBe("Every command, flag, and option.");
    expect(parsed.date).toBeInstanceOf(Date);
  });

  test("title is optional (the content H1 is the fallback)", () => {
    expect(portoDocSchema.parse({}).title).toBeUndefined();
  });

  test("strips the old description key (renamed to desc)", () => {
    const parsed = portoDocSchema.parse({
      description: "Old key",
      desc: "New key",
    }) as Record<string, unknown>;
    expect(parsed.description).toBeUndefined();
    expect(parsed.desc).toBe("New key");
  });

  test("strips sidebar_position (removed — ordering is by filename)", () => {
    const parsed = portoDocSchema.parse({
      sidebar_position: 3,
    }) as Record<string, unknown>;
    expect(parsed.sidebar_position).toBeUndefined();
  });

  test("strips unknown keys", () => {
    const parsed = portoDocSchema.parse({
      bogus_key: "nope",
    }) as Record<string, unknown>;
    expect(parsed.bogus_key).toBeUndefined();
  });

  test("renames the toc frontmatter key to table_of_contents", () => {
    const parsed = portoDocSchema.parse({
      toc: { enable: false, max_level: 3 },
    });
    expect(parsed.table_of_contents).toEqual({
      enable: false,
      max_level: 3,
    });
    expect("toc" in parsed).toBe(false);
    expect(portoDocSchema.parse({}).table_of_contents).toBeUndefined();
  });

  test("accepts topic_list as a boolean or a record", () => {
    expect(portoDocSchema.parse({ topic_list: true }).topic_list).toBe(true);
    expect(
      portoDocSchema.parse({ topic_list: { depth: 2 } }).topic_list,
    ).toEqual({ depth: 2 });
  });

  test("accepts a single-segment slug", () => {
    expect(portoDocSchema.parse({ slug: "custom" }).slug).toBe("custom");
    // Cleaning to a URL segment happens in the slug function, not
    // the schema — the schema only checks the shape.
    expect(portoDocSchema.parse({ slug: "My Page" }).slug).toBe("My Page");
  });

  test("rejects a multi-segment slug", () => {
    expect(() => portoDocSchema.parse({ slug: "apple/google" })).toThrow(
      "slug must be a single segment, no slashes",
    );
  });

  test("rejects an absolute slug", () => {
    expect(() => portoDocSchema.parse({ slug: "/apple" })).toThrow(
      "slug must be a single segment, no slashes",
    );
  });

  test("rejects dot and empty slugs", () => {
    for (const slug of ["", ".", ".."]) {
      expect(() => portoDocSchema.parse({ slug })).toThrow(
        "slug must be a single segment, no slashes",
      );
    }
  });

  test("rejects a slug with no letters or digits", () => {
    expect(() => portoDocSchema.parse({ slug: "---" })).toThrow(
      "slug must be a single segment, no slashes",
    );
  });
});

describe("portoSlugs", () => {
  let projectDir!: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-source-"));
    const docsDir = path.join(projectDir, "docs");
    fs.mkdirSync(path.join(docsDir, "guide"), { recursive: true });
    fs.mkdirSync(path.join(docsDir, "3 - config"), { recursive: true });
    // Parent index with a custom slug, for the inheritance case.
    fs.writeFileSync(
      path.join(docsDir, "guide", "index.mdx"),
      "---\nslug: manual\n---\n# Guide\n",
    );
    fs.writeFileSync(path.join(docsDir, "guide", "setup.mdx"), "# Setup\n");
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function file(contentPath: string, data: Record<string, unknown> = {}): any {
    return {
      path: contentPath,
      absolutePath: path.join(projectDir, "docs", ...contentPath.split("/")),
      data,
    };
  }

  const next = () => ["unused"];

  test("computes a plain slug", () => {
    expect(portoSlugs(file("getting-started.mdx"), next)).toEqual([
      "getting-started",
    ]);
  });

  test("strips number prefixes from file and directory names", () => {
    expect(
      portoSlugs(file("python/4 - loops/4.1 - while-loops.mdx"), next),
    ).toEqual(["python", "loops", "while-loops"]);
  });

  test("resolves an index file to its directory", () => {
    expect(portoSlugs(file("3 - config/README.mdx"), next)).toEqual(["config"]);
  });

  test("resolves the root index to the empty slug", () => {
    expect(portoSlugs(file("index.mdx"), next)).toEqual([]);
  });

  test("honors a relative frontmatter slug", () => {
    // A directory with no index file, so no parent slug is inherited.
    expect(
      portoSlugs(file("other/setup.mdx", { slug: "custom" }), next),
    ).toEqual(["other", "custom"]);
  });

  test("cleans a frontmatter slug to one segment", () => {
    // A directory with no index file, so no parent slug is inherited.
    expect(
      portoSlugs(file("other/setup.mdx", { slug: "My Page" }), next),
    ).toEqual(["other", "my-page"]);
  });

  test("treats an absolute-looking slug as one segment", () => {
    // The schema rejects these at build time; the slug function
    // normalizes them defensively instead of re-rooting.
    expect(
      portoSlugs(file("other/setup.mdx", { slug: "/custom" }), next),
    ).toEqual(["other", "custom"]);
  });

  test("inherits slugs from parent index files on disk", () => {
    expect(portoSlugs(file("guide/setup.mdx"), next)).toEqual([
      "manual",
      "setup",
    ]);
  });

  test("works without an absolute path (no parent lookup)", () => {
    expect(
      portoSlugs(
        { path: "3 - config/1 - dynamic-variables.mdx", data: {} } as any,
        next,
      ),
    ).toEqual(["config", "dynamic-variables"]);
  });
});

describe("portoTreeTransformers", () => {
  const transformer = portoTreeTransformers[0];

  function fileContext(files: Record<string, any>): any {
    return {
      storage: {
        read: (filePath: string) => files[filePath],
      },
    };
  }

  test("file: sidebar_label overrides the node name", () => {
    const ctx = fileContext({
      "guide/setup.mdx": {
        format: "page",
        data: { title: "Setup", sidebar_label: "Install" },
      },
    });
    const node: any = { type: "page", name: "Setup", url: "/docs/setup" };
    const out = transformer.file!.call(ctx, node, "guide/setup.mdx") as any;
    expect(out.name).toBe("Install");
  });

  test("file: desc becomes the node description", () => {
    const ctx = fileContext({
      "guide/setup.mdx": {
        format: "page",
        data: { title: "Setup", desc: "How to install." },
      },
    });
    const node: any = { type: "page", name: "Setup", url: "/docs/setup" };
    const out = transformer.file!.call(ctx, node, "guide/setup.mdx") as any;
    expect(out.description).toBe("How to install.");
  });

  test("file: frontmatter color is copied onto the node", () => {
    const ctx = fileContext({
      "guide/setup.mdx": {
        format: "page",
        data: { title: "Setup", color: "#f00" },
      },
    });
    const node: any = { type: "page", name: "Setup", url: "/docs/setup" };
    const out = transformer.file!.call(ctx, node, "guide/setup.mdx") as any;
    expect(out.color).toBe("#f00");
  });

  test("file: leaves the node alone with no sidebar_label or desc", () => {
    const ctx = fileContext({
      "guide/setup.mdx": { format: "page", data: { title: "Setup" } },
    });
    const node: any = { type: "page", name: "Setup", url: "/docs/setup" };
    const out = transformer.file!.call(ctx, node, "guide/setup.mdx") as any;
    expect(out.name).toBe("Setup");
    expect(out.description).toBeUndefined();
  });

  test("folder: strips the number prefix from a path-fallback name", () => {
    // The builder's path fallback for "3 - config" is "3   config"
    // (pathToName capitalizes the first letter and turns "-" into
    // spaces) — the transformer rewrites exactly that name.
    const node: any = { type: "folder", name: "3   config", children: [] };
    const out = transformer.folder!.call({} as any, node, "3 - config") as any;
    expect(out.name).toBe("Config");
  });

  test("folder: leaves an author-chosen name alone", () => {
    // A meta title or index-page name is not the path fallback, so
    // it is never rewritten — even when it looks numeric.
    const node: any = {
      type: "folder",
      name: "Configuration Guide",
      children: [],
    };
    const out = transformer.folder!.call({} as any, node, "3 - config") as any;
    expect(out.name).toBe("Configuration Guide");
  });

  test("folder: promotes the README page to the folder index", () => {
    // Fumadocs only treats `index` as an index page. The README's
    // URL is already the folder URL, so it is the child page whose
    // URL every sibling page URL starts with.
    const readme: any = {
      type: "page",
      name: "Getting Started",
      url: "/docs/getting-started",
    };
    const node: any = {
      type: "folder",
      name: "1   getting started",
      children: [
        readme,
        {
          type: "page",
          name: "Installation",
          url: "/docs/getting-started/installation",
        },
        {
          type: "page",
          name: "Project Structure",
          url: "/docs/getting-started/project-structure",
        },
      ],
    };
    const out = transformer.folder!.call(
      {} as any,
      node,
      "1 - getting-started",
    ) as any;
    expect(out.index).toBe(readme);
    expect(out.children).not.toContain(readme);
    expect(out.children).toHaveLength(2);
    // The index page's title wins over the folder name.
    expect(out.name).toBe("Getting Started");
  });

  test("folder: does not promote when no child is the folder page", () => {
    const node: any = {
      type: "folder",
      name: "1   getting started",
      children: [
        {
          type: "page",
          name: "Installation",
          url: "/docs/getting-started/installation",
        },
        {
          type: "page",
          name: "Project Structure",
          url: "/docs/getting-started/project-structure",
        },
      ],
    };
    const out = transformer.folder!.call(
      {} as any,
      node,
      "1 - getting-started",
    ) as any;
    expect(out.index).toBeUndefined();
    expect(out.children).toHaveLength(2);
    expect(out.name).toBe("Getting started");
  });

  test("folder: sorts children into filename order, folders interleaved", () => {
    // Fumadocs' builder groups pages before folders. Portosaur
    // orders by filename — the root's sections read 1 -, 2 -, 3 -,
    // 10 - in the sidebar and on the docs index alike. The sort is
    // numeric-aware: "10 - pwa" comes after "3 - config".
    const node: any = {
      type: "folder",
      root: true,
      name: "Docs",
      children: [
        {
          type: "page",
          name: "CLI Reference",
          url: "/docs/cli-reference",
          $ref: "2 - cli-reference.mdx",
        },
        {
          type: "page",
          name: "PWA",
          url: "/docs/pwa",
          $ref: "10 - pwa.mdx",
        },
        {
          type: "folder",
          name: "1   getting started",
          children: [],
          $ref: { folder: "1 - getting-started" },
        },
        {
          type: "folder",
          name: "3   config",
          children: [],
          $ref: { folder: "3 - config" },
        },
      ],
    };
    const out = transformer.folder!.call({} as any, node, "") as any;
    expect(out.children.map((child: any) => child.name)).toEqual([
      "1   getting started",
      "CLI Reference",
      "3   config",
      "PWA",
    ]);
  });

  test("folder: leaves a meta.json pages order alone", () => {
    // An explicit `pages` list is author-chosen order — the
    // filename sort must not rewrite it.
    const ctx = fileContext({
      "meta.json": {
        format: "meta",
        data: { pages: ["b-page", "a-page"] },
      },
    });
    const node: any = {
      type: "folder",
      name: "Guide",
      children: [
        {
          type: "page",
          name: "B",
          url: "/docs/b",
          $ref: "b-page.mdx",
        },
        {
          type: "page",
          name: "A",
          url: "/docs/a",
          $ref: "a-page.mdx",
        },
      ],
    };
    const out = transformer.folder!.call(
      ctx,
      node,
      "guide",
      "meta.json",
    ) as any;
    expect(out.children.map((child: any) => child.name)).toEqual(["B", "A"]);
  });
});

describe("portoTreeTransformers file: content H1", () => {
  const transformer = portoTreeTransformers[0];
  let projectDir!: string;

  beforeAll(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-h1-"));
    const write = (name: string, content: string) => {
      fs.writeFileSync(path.join(projectDir, name), content);
    };
    write("h1-only.mdx", "# Install Guide\n\nText.\n");
    write("h1-beats-title.mdx", "# Install Guide\n\nText.\n");
    write("h1-beats-label.mdx", "# Install Guide\n\nText.\n");
    write("no-h1.mdx", "## Section\n\nText.\n");
    write("blockquote-h1.mdx", "> # Quoted\n\n## Section\n\nText.\n");
    write("fence-h1.mdx", "```md\n# Not a heading\n```\n\n## Section\n");
    write("h2-first.mdx", "## First\n\n# Later\n\nText.\n");
    write("empty-h1.mdx", "#\n\n## Section\n\nText.\n");
    write("code-span-h1.mdx", "# Using `bun`\n\nText.\n");
    write(
      "fm-comment.mdx",
      "---\n# a comment\ntitle: Setup\n---\n\n## Section\n",
    );
    write("expr-h1.mdx", "# {frontmatter.title}\n\nText.\n");
  });

  afterAll(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  function labelFor(
    name: string,
    builderName: string,
    data: Record<string, unknown> = {},
    withPath = true,
  ): string {
    const ctx: any = {
      storage: {
        read: () => ({
          format: "page",
          data,
          ...(withPath ? { absolutePath: path.join(projectDir, name) } : {}),
        }),
      },
    };
    const node: any = { type: "page", name: builderName, url: "/docs/x" };
    const out = transformer.file!.call(ctx, node, name) as any;
    return out.name;
  }

  test("H1 beats the file name", () => {
    expect(labelFor("h1-only.mdx", "Setup")).toBe("Install Guide");
  });

  test("H1 beats the frontmatter title", () => {
    expect(labelFor("h1-beats-title.mdx", "Setup", { title: "Setup" })).toBe(
      "Install Guide",
    );
  });

  test("sidebar_label beats the H1", () => {
    expect(
      labelFor("h1-beats-label.mdx", "Setup", {
        title: "Setup",
        sidebar_label: "Install",
      }),
    ).toBe("Install");
  });

  test("no H1 leaves the builder name alone", () => {
    expect(labelFor("no-h1.mdx", "Setup", { title: "Setup" })).toBe("Setup");
  });

  test("an H1 nested in a blockquote does not count", () => {
    expect(labelFor("blockquote-h1.mdx", "Setup", { title: "Setup" })).toBe(
      "Setup",
    );
  });

  test("a `#` inside a fenced code block does not count", () => {
    expect(labelFor("fence-h1.mdx", "Setup", { title: "Setup" })).toBe("Setup");
  });

  test("first-heading-H2 plus a later H1 does not count", () => {
    expect(labelFor("h2-first.mdx", "Setup", { title: "Setup" })).toBe("Setup");
  });

  test("an empty H1 contributes nothing", () => {
    expect(labelFor("empty-h1.mdx", "Setup", { title: "Setup" })).toBe("Setup");
  });

  test("the H1 text is extracted plain (code spans unwrapped)", () => {
    expect(labelFor("code-span-h1.mdx", "Setup")).toBe("Using bun");
  });

  test("a `#` comment in the frontmatter does not count", () => {
    expect(labelFor("fm-comment.mdx", "Setup", { title: "Setup" })).toBe(
      "Setup",
    );
  });

  test("a frontmatter expression in the H1 resolves", () => {
    expect(labelFor("expr-h1.mdx", "Setup", { title: "Resolved" })).toBe(
      "Resolved",
    );
  });

  test("without an absolute path the builder name stands", () => {
    expect(labelFor("h1-only.mdx", "Setup", { title: "Setup" }, false)).toBe(
      "Setup",
    );
  });
});
