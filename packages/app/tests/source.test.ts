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

  test("accepts topic_list as a boolean or a record", () => {
    expect(portoDocSchema.parse({ topic_list: true }).topic_list).toBe(true);
    expect(
      portoDocSchema.parse({ topic_list: { depth: 2 } }).topic_list,
    ).toEqual({ depth: 2 });
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
      "---\nslug: /manual\n---\n# Guide\n",
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

  test("honors an absolute frontmatter slug", () => {
    expect(
      portoSlugs(file("guide/setup.mdx", { slug: "/custom" }), next),
    ).toEqual(["custom"]);
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
});
