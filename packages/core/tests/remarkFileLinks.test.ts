import { describe, test, expect, beforeAll, afterAll, spyOn } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkFileLinks, {
  type ContentDir,
} from "../src/plugins/remarkFileLinks.ts";

/**
 * `remarkFileLinks` rewrites relative links to Markdown files to
 * the target page's clean URL (the old Docusaurus behavior), so
 * authors link by filename instead of translating to the URL.
 *
 * These tests parse real MDX and run the plugin against a real
 * temp content tree, the way the build does. Numbered names carry
 * spaces, which a bare Markdown link destination cannot hold — so
 * links to numbered files use `%20` (as the old site did) or the
 * `<>` destination form, while JSX attributes take the literal
 * name with spaces.
 */

let projectDir!: string;
let docsDir!: string;
let contentDirs!: ContentDir[];

function write(rel: string, content: string): void {
  const file = path.join(projectDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

beforeAll(() => {
  projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-filelinks-"));
  docsDir = path.join(projectDir, "docs");
  contentDirs = [
    { dir: docsDir, route: "docs" },
    { dir: path.join(projectDir, "blog"), route: "blog" },
  ];
  write("docs/README.mdx", "# Docs\n");
  write("docs/getting-started.mdx", "# Getting Started\n");
  write("docs/1 - getting-started/README.mdx", "# Getting Started\n");
  write("docs/1 - getting-started/2 - installation.mdx", "# Installation\n");
  write("docs/1 - getting-started/3 - sibling.mdx", "# Sibling\n");
  write("docs/1 - getting-started/plain.mdx", "# Plain\n");
  write(
    "docs/1 - getting-started/4 - slugged.mdx",
    "---\nslug: my-slug\n---\n# Slugged\n",
  );
  write("docs/1 - getting-started/4.1 - dotted/5 - deep.mdx", "# Deep\n");
  write("docs/3 - config/README.mdx", "# Config\n");
  write("docs/3 - config/1 - dynamic-variables.mdx", "# Dynamic Variables\n");
  write("docs/guide/index.mdx", "---\nslug: /manual\n---\n# Guide\n");
  write("docs/guide/setup.mdx", "# Setup\n");
  write("blog/hello.mdx", "# Hello\n");
  write("outside.mdx", "# Outside\n");
});

afterAll(() => {
  fs.rmSync(projectDir, { recursive: true, force: true });
});

function fakeFile(current: string | null): any {
  const messages: string[] = [];
  const file: any = {
    data: {},
    // No history entry either when there is no path: unified wraps
    // the file in a VFile, which derives `path` from history.
    history: current === null ? [] : [current],
    messages,
    message(reason: string) {
      messages.push(String(reason));
    },
  };
  if (current !== null) {
    file.path = current;
  }
  return file;
}

function currentFile(): string {
  return path.join(docsDir, "1 - getting-started", "2 - installation.mdx");
}

async function transform(
  mdx: string,
  current: string | null = currentFile(),
  dirs: ContentDir[] = contentDirs,
): Promise<{ tree: any; file: any }> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkFileLinks, dirs);
  const tree = processor.parse(mdx);
  const file = fakeFile(current);
  await processor.run(tree, file);
  return { tree, file };
}

/**
 * Run a function with console.warn spied on, restoring it after.
 * Returns the warn calls alongside the function's result, so warn
 * tests stay quiet and can assert on the printed warning.
 */
async function captureWarn<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; warns: any[][] }> {
  // spyOn calls through to the real console.warn by default, so
  // silence it — otherwise warn tests print into the suite output.
  const spy = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const result = await fn();
    return { result, warns: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
}

function findLinks(tree: any): string[] {
  const urls: string[] = [];
  const walk = (node: any) => {
    if (node.type === "link") {
      urls.push(node.url);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree);
  return urls;
}

function findDefinitions(tree: any): string[] {
  const urls: string[] = [];
  const walk = (node: any) => {
    if (node.type === "definition") {
      urls.push(node.url);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree);
  return urls;
}

function findJsxAttrs(tree: any, name: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: any) => {
    if (
      (node.type === "mdxJsxFlowElement" ||
        node.type === "mdxJsxTextElement") &&
      node.name === name
    ) {
      const attrs: Record<string, unknown> = {};
      for (const attr of node.attributes ?? []) {
        attrs[attr.name] = attr.value;
      }
      found.push(attrs);
    }
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(tree);
  return found;
}

describe("remarkFileLinks", () => {
  test("rewrites a sibling link to the page URL", async () => {
    const { tree, file } = await transform("[x](./plain.mdx)");
    expect(findLinks(tree)).toEqual(["/docs/getting-started/plain/"]);
    expect(file.messages).toHaveLength(0);
  });

  test("decodes %20 in a numbered sibling name", async () => {
    const { tree, file } = await transform("[x](./3%20-%20sibling.mdx)");
    expect(findLinks(tree)).toEqual(["/docs/getting-started/sibling/"]);
    expect(file.messages).toHaveLength(0);
  });

  test("accepts the <> destination form with literal spaces", async () => {
    const { tree, file } = await transform("[x](<./3 - sibling.mdx>)");
    expect(findLinks(tree)).toEqual(["/docs/getting-started/sibling/"]);
    expect(file.messages).toHaveLength(0);
  });

  test("rewrites a parent-dir link", async () => {
    const { tree, file } = await transform(
      "[x](../3%20-%20config/1%20-%20dynamic-variables.mdx)",
    );
    expect(findLinks(tree)).toEqual(["/docs/config/dynamic-variables/"]);
    expect(file.messages).toHaveLength(0);
  });

  test("resolves a README target to the folder URL", async () => {
    const { tree } = await transform("[x](./README.mdx)");
    expect(findLinks(tree)).toEqual(["/docs/getting-started/"]);
  });

  test("resolves the root README to the section URL", async () => {
    const { tree } = await transform("[x](../README.mdx)");
    expect(findLinks(tree)).toEqual(["/docs/"]);
  });

  test("strips dotted number prefixes on the way down", async () => {
    const { tree } = await transform(
      "[x](./4.1%20-%20dotted/5%20-%20deep.mdx)",
    );
    expect(findLinks(tree)).toEqual(["/docs/getting-started/dotted/deep/"]);
  });

  test("preserves a #hash", async () => {
    const { tree } = await transform("[x](./plain.mdx#section)");
    expect(findLinks(tree)).toEqual(["/docs/getting-started/plain/#section"]);
  });

  test("honors the target's frontmatter slug", async () => {
    const { tree } = await transform("[x](./4%20-%20slugged.mdx)");
    expect(findLinks(tree)).toEqual(["/docs/getting-started/my-slug/"]);
  });

  test("inherits a parent index slug", async () => {
    const { tree } = await transform("[x](../guide/setup.mdx)");
    expect(findLinks(tree)).toEqual(["/docs/manual/setup/"]);
  });

  test("resolves a link into another content dir", async () => {
    const { tree } = await transform("[x](../../blog/hello.mdx)");
    expect(findLinks(tree)).toEqual(["/blog/hello/"]);
  });

  test("leaves absolute, external, anchor, and non-markdown links alone", async () => {
    const { tree, file } = await transform(
      "[a](/docs/config/) [b](https://example.com/x.mdx) [c](#section) " +
        "[d](mailto:a@b.c) [e](./image.png) [f](./notes.txt) [g](page)",
    );
    expect(findLinks(tree)).toEqual([
      "/docs/config/",
      "https://example.com/x.mdx",
      "#section",
      "mailto:a@b.c",
      "./image.png",
      "./notes.txt",
      "page",
    ]);
    expect(file.messages).toHaveLength(0);
  });

  test("warns and leaves a missing file untouched", async () => {
    const {
      result: { tree, file },
      warns,
    } = await captureWarn(() => transform("[x](./no-such-page.mdx)"));
    expect(findLinks(tree)).toEqual(["./no-such-page.mdx"]);
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0]).toContain("does not exist");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain("does not exist");
    expect(warns[0]?.[0]).toContain("2 - installation.mdx");
  });

  test("warns and leaves a link outside the content dirs untouched", async () => {
    const {
      result: { tree, file },
      warns,
    } = await captureWarn(() => transform("[x](../../outside.mdx)"));
    expect(findLinks(tree)).toEqual(["../../outside.mdx"]);
    expect(file.messages).toHaveLength(1);
    expect(file.messages[0]).toContain("outside the content directories");
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain("outside the content directories");
    expect(warns[0]?.[0]).toContain("2 - installation.mdx");
  });

  test("rewrites a definition node", async () => {
    const { tree, file } = await transform("[x][ref]\n\n[ref]: ./plain.mdx\n");
    expect(findDefinitions(tree)).toEqual(["/docs/getting-started/plain/"]);
    expect(file.messages).toHaveLength(0);
  });

  test("rewrites JSX Link and Btn string attributes", async () => {
    const { tree, file } = await transform(
      '<Link href="./plain.mdx">x</Link>\n\n<Btn to="./3 - sibling.mdx">y</Btn>\n',
    );
    expect(findJsxAttrs(tree, "Link")).toEqual([
      { href: "/docs/getting-started/plain/" },
    ]);
    expect(findJsxAttrs(tree, "Btn")).toEqual([
      { to: "/docs/getting-started/sibling/" },
    ]);
    expect(file.messages).toHaveLength(0);
  });

  test("leaves JSX expression attributes alone", async () => {
    const { tree, file } = await transform(
      '<Link href={"./plain.mdx"}>x</Link>\n',
    );
    const attrs = findJsxAttrs(tree, "Link");
    expect(attrs).toHaveLength(1);
    expect(attrs[0].href).not.toBe("/docs/getting-started/plain/");
    expect(file.messages).toHaveLength(0);
  });

  test("leaves links untouched without a vfile path", async () => {
    const { tree, file } = await transform("[x](./plain.mdx)", null);
    expect(findLinks(tree)).toEqual(["./plain.mdx"]);
    expect(file.messages).toHaveLength(0);
  });

  test("leaves links untouched with no content dirs", async () => {
    const { tree, file } = await transform(
      "[x](./plain.mdx)",
      currentFile(),
      [],
    );
    expect(findLinks(tree)).toEqual(["./plain.mdx"]);
    expect(file.messages).toHaveLength(0);
  });
});
