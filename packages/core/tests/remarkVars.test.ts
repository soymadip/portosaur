import { describe, test, expect } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkVarsPlugin from "../src/plugins/remarkVars.ts";

/**
 * `remarkVarsPlugin` replaces `{vars.key}` references from
 * porto.yml's `vars` section and `{env.VAR}` references from the
 * build environment. These tests run it through the real unified
 * pipeline, the way the MDX compiler calls it: the factory is
 * invoked with its options, and the returned transformer runs on
 * the parsed tree.
 */

function run(
  mdx: string,
  vars: Record<string, unknown>,
  env: Record<string, string | undefined> = {},
): string {
  const file = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkVarsPlugin, vars, env)
    .use(remarkStringify)
    .processSync(mdx);
  return String(file);
}

describe("remarkVarsPlugin", () => {
  test("with no vars defined, leaves plain text untouched", () => {
    expect(run("# Hello\n\nSome text.\n", {})).toContain("Some text.");
  });

  test("replaces {vars.key} in text nodes", () => {
    const out = run("Visit {vars.site} today.\n", { site: "example.com" });
    expect(out).toContain("Visit example.com today.");
  });

  test("throws a descriptive error on an unknown key", () => {
    expect(() =>
      run("Visit {vars.missing} today.\n", { site: "example.com" }),
    ).toThrow('[Portosaur] Unknown vars key "{vars.missing}"');
  });

  test("with no vars, leaves {vars.key} untouched", () => {
    // A project without a vars section keeps the old behavior:
    // vars references pass through, only env references resolve.
    const out = run("`{vars.missing}`\n", {}, {});
    expect(out).toContain("{vars.missing}");
  });

  test("replaces {env.VAR} in text nodes", () => {
    const out = run(
      "Visit {env.PORTO_TEST_SITE} today.\n",
      { site: "example.com" },
      { PORTO_TEST_SITE: "example.com" },
    );
    expect(out).toContain("Visit example.com today.");
  });

  test("resolves an unset env var to an empty string", () => {
    const out = run("A{env.PORTO_TEST_MISSING}B\n", {}, {});
    expect(out).toContain("AB");
    expect(out).not.toContain("{env.");
  });

  test("leaves the escape form {{env.VAR}} literal", () => {
    const out = run(
      "```\nDeploy to {{env.PORTO_TEST_SITE}}.\n```\n",
      {},
      { PORTO_TEST_SITE: "example.com" },
    );
    expect(out).toContain("{env.PORTO_TEST_SITE}");
    expect(out).not.toContain("example.com");
  });

  test("replaces {env.VAR} in link URLs", () => {
    const out = run(
      "[Site]({env.PORTO_TEST_SITE}/page)\n",
      {},
      { PORTO_TEST_SITE: "https://example.com" },
    );
    expect(out).toContain("https://example.com/page");
  });

  test("replaces {env.VAR} as an MDX expression", () => {
    const out = run(
      "{env.PORTO_TEST_SITE}\n",
      {},
      { PORTO_TEST_SITE: "example.com" },
    );
    expect(out).toContain("example.com");
    expect(out).not.toContain("{env.");
  });

  test("resolves env vars with no vars defined", () => {
    const out = run("A{env.FOO}B\n", {}, { FOO: "x" });
    expect(out).toContain("AxB");
  });
});
