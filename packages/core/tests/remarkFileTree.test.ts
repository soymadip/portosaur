import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkFileTree from "../src/plugins/remarkFileTree.ts";

/**
 * `remarkFileTree` turns ```files fences into a `<FileTree>`
 * component. These tests run it through the real unified
 * pipeline, the way the MDX compiler calls it, and read the
 * stringified JSX back.
 */

function process(mdx: string): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkFileTree)
    .use(remarkStringify)
    .processSync(mdx);
  return String(file);
}

describe("remarkFileTree", () => {
  test("a drawn tree becomes a FileTree with open folders", () => {
    const output = process(
      [
        "```files",
        "project",
        "├── src",
        "│   ├── index.ts",
        "│   └── components",
        "│       └── Button.tsx",
        "├── package.json",
        "```",
        "",
      ].join("\n"),
    );
    expect(output).toContain("<FileTree>");
    expect(output).toContain('<Folder name="project" defaultOpen>');
    expect(output).toContain('<Folder name="src" defaultOpen>');
    expect(output).toContain('<File name="index.ts" />');
    expect(output).toContain('<Folder name="components" defaultOpen>');
    expect(output).toContain('<File name="Button.tsx" />');
    expect(output).toContain('<File name="package.json" />');
    expect(output).toContain("</FileTree>");
  });

  test("several roots render side by side with no wrapper folder", () => {
    const output = process(
      ["```files", "src", "package.json", "```", ""].join("\n"),
    );
    expect(output).toContain("<FileTree>");
    expect(output).toContain('<File name="src" />');
    expect(output).toContain('<File name="package.json" />');
    expect(output).not.toContain("<Folder");
  });

  test("a trailing slash makes a folder, and the slash is stripped", () => {
    const output = process(["```files", "src/", "```", ""].join("\n"));
    expect(output).toContain('<Folder name="src" defaultOpen />');
    expect(output).not.toContain('name="src/"');
  });

  test("a file that gains a child becomes a folder", () => {
    const output = process(
      ["```files", "src", "    index.ts", "```", ""].join("\n"),
    );
    expect(output).toContain('<Folder name="src" defaultOpen>');
    expect(output).toContain('<File name="index.ts" />');
  });

  test("plain indentation nests without tree characters", () => {
    const output = process(
      [
        "```files",
        "project",
        "  src",
        "    index.ts",
        "  package.json",
        "```",
        "",
      ].join("\n"),
    );
    expect(output).toContain('<Folder name="project" defaultOpen>');
    expect(output).toContain('<Folder name="src" defaultOpen>');
    expect(output).toContain('<File name="index.ts" />');
    expect(output).toContain('<File name="package.json" />');
  });

  test("other fences are left alone", () => {
    const output = process(["```js", "const x = 1;", "```", ""].join("\n"));
    expect(output).toContain("```js");
    expect(output).not.toContain("<FileTree>");
  });

  test("an empty files fence is left alone", () => {
    const output = process(["```files", "```", ""].join("\n"));
    expect(output).toContain("```files");
    expect(output).not.toContain("<FileTree>");
  });

  test("the lang matches case-insensitively", () => {
    const output = process(["```Files", "package.json", "```", ""].join("\n"));
    expect(output).toContain('<File name="package.json" />');
  });
});
