import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkVarsPlugin from "../src/plugins/remarkVars.ts";

/**
 * `remarkVarsPlugin` replaces `{vars.key}` references from
 * config.yml's `vars` section. These tests run it through the real
 * unified pipeline, the way the MDX compiler calls it: the factory
 * is invoked with its options, and the returned transformer runs on
 * the parsed tree.
 */

function run(mdx: string, vars: Record<string, unknown>): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkVarsPlugin, vars)
    .use(remarkStringify)
    .processSync(mdx);
  return String(file);
}

describe("remarkVarsPlugin", () => {
  test("with no vars, leaves the tree untouched (identity transformer)", () => {
    // Regression test: the factory used to return a thunk yielding
    // the identity transformer. Unified treats the factory's return
    // as the transformer, so the thunk ran as the transformer,
    // returned a function, and unified replaced the whole tree with
    // it — the next plugin then crashed on a non-node tree.
    expect(run("# Hello\n\nSome text.\n", {})).toContain("Some text.");
  });

  test("replaces {vars.key} in text nodes", () => {
    const out = run("Visit {vars.site} today.\n", { site: "example.com" });
    expect(out).toContain("Visit example.com today.");
  });

  test("throws a descriptive error on an unknown key", () => {
    // Non-empty vars so the real transformer runs (empty vars is
    // the identity transformer, which replaces nothing).
    expect(() =>
      run("Visit {vars.missing} today.\n", { site: "example.com" }),
    ).toThrow('[Portosaur] Unknown vars key "{vars.missing}"');
  });
});
