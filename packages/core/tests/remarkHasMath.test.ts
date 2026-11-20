import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkMath from "remark-math";
import remarkHasMath, { HAS_MATH_KEY } from "../src/plugins/remarkHasMath.ts";

/**
 * `remarkHasMath` flags pages that render math, so the doc page loads
 * the KaTeX stylesheet only on those pages: it stashes `true` at
 * `file.data[HAS_MATH_KEY]` when it sees a math node (created by
 * remark-math, which runs before it) or a frontmatter `math: true`.
 *
 * These tests parse real MDX (not hand-built trees) and run
 * remark-math first, the way mdx.ts wires the plugins.
 */

function fakeFile(
  frontmatter: Record<string, unknown> = {},
  path = "test.mdx",
): any {
  return { data: { frontmatter }, history: [path] };
}

// remark-math is a proper unified plugin (it reads `this.data()`),
// so it cannot be called directly like remarkHasMath — run both
// through a processor, in mdx.ts order.
async function transform(
  mdx: string,
  frontmatter: Record<string, unknown> = {},
): Promise<any> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkMath)
    .use(remarkHasMath);
  const tree = processor.parse(mdx);
  const file = fakeFile(frontmatter);
  await processor.run(tree, file);
  return file;
}

function flagged(file: any): unknown {
  return file.data[HAS_MATH_KEY];
}

describe("remarkHasMath", () => {
  test("flags inline math", async () => {
    expect(flagged(await transform("The value $x = 2$ holds.\n"))).toBe(true);
  });

  test("flags display math", async () => {
    expect(flagged(await transform("$$\nx^2 + y^2 = z^2\n$$\n"))).toBe(true);
  });

  test("does not flag pages without math", async () => {
    expect(flagged(await transform("# Title\n\nSome text.\n"))).toBeUndefined();
  });

  test("does not flag dollar signs in code", async () => {
    expect(
      flagged(await transform("```js\nconst s = `price: $${n}`;\n```\n")),
    ).toBeUndefined();
  });

  test("flags frontmatter math: true even without $...$ syntax", async () => {
    expect(flagged(await transform("Some text.\n", { math: true }))).toBe(true);
  });

  test("leaves the tree untouched", async () => {
    const processor = unified().use(remarkParse).use(remarkMdx).use(remarkMath);
    const tree = processor.parse("The value $x = 2$ holds.\n");
    const file = fakeFile();
    await processor.run(tree, file);
    const before = JSON.stringify(tree);
    remarkHasMath()(tree, file);
    expect(JSON.stringify(tree)).toBe(before);
  });
});
