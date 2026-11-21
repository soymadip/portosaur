import { describe, test, expect, spyOn } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkVarsPlugin, {
  type RemarkVarsOptions,
} from "../src/plugins/remarkVars.ts";

/**
 * `remarkVarsPlugin` replaces `{vars.key}` references from
 * porto.yml's `vars` section and `{env.VAR}` references from the
 * build environment. These tests run it through the real unified
 * pipeline, the way the MDX compiler calls it: the factory is
 * invoked with its options, and the returned transformer runs on
 * the parsed tree.
 */

function process(
  mdx: string,
  options: RemarkVarsOptions = {},
): { output: string; messages: string[] } {
  const file = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkVarsPlugin, options)
    .use(remarkStringify)
    .processSync(mdx);
  return {
    output: String(file),
    messages: file.messages.map((message) => message.message),
  };
}

function run(mdx: string, options: RemarkVarsOptions = {}): string {
  return process(mdx, options).output;
}

/**
 * Run a function with console.warn spied on, restoring it after.
 * Returns the warn calls alongside the function's result, so warn
 * tests stay quiet and can assert on the printed warning.
 */
function captureWarn<T>(fn: () => T): { result: T; warns: any[][] } {
  // spyOn calls through to the real console.warn by default, so
  // silence it — otherwise warn tests print into the suite output.
  const spy = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const result = fn();
    return { result, warns: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
}

describe("remarkVarsPlugin", () => {
  test("with no vars defined, leaves plain text untouched", () => {
    expect(run("# Hello\n\nSome text.\n")).toContain("Some text.");
  });

  test("replaces {vars.key} in text nodes", () => {
    const out = run("Visit {vars.site} today.\n", {
      vars: { site: "example.com" },
    });
    expect(out).toContain("Visit example.com today.");
  });

  test("throws a descriptive error on an unknown key", () => {
    expect(() =>
      run("Visit {vars.missing} today.\n", { vars: { site: "example.com" } }),
    ).toThrow('[Portosaur] Unknown vars key "{vars.missing}"');
  });

  test("with no vars, leaves {vars.key} untouched", () => {
    // A project without a vars section keeps the old behavior:
    // vars references pass through, only env references resolve.
    const out = run("`{vars.missing}`\n");
    expect(out).toContain("{vars.missing}");
  });

  test("with onMissingVar warn, warns and renders an unknown key empty", () => {
    const {
      result: { output, messages },
      warns,
    } = captureWarn(() =>
      process("A{vars.missing}B\n", {
        vars: { site: "example.com" },
        onMissingVar: "warn",
      }),
    );
    expect(output).toContain("AB");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Unknown vars key "{vars.missing}"');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain('Unknown vars key "{vars.missing}"');
  });

  test("with onMissingVar ignore, silently renders an unknown key empty", () => {
    const { output, messages } = process("A{vars.missing}B\n", {
      vars: { site: "example.com" },
      onMissingVar: "ignore",
    });
    expect(output).toContain("AB");
    expect(messages).toHaveLength(0);
  });

  test("with onMissingVar throw, fails on an unknown key", () => {
    expect(() =>
      run("A{vars.missing}B\n", {
        vars: { site: "example.com" },
        onMissingVar: "throw",
      }),
    ).toThrow('[Portosaur] Unknown vars key "{vars.missing}"');
  });

  test("with onMissingVar warn, warns on an unknown key in an MDX expression", () => {
    const {
      result: { output, messages },
      warns,
    } = captureWarn(() =>
      process("{vars.missing}\n", {
        vars: { site: "example.com" },
        onMissingVar: "warn",
      }),
    );
    expect(output).not.toContain("{vars.missing}");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Unknown vars key "{vars.missing}"');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain('Unknown vars key "{vars.missing}"');
  });

  test("replaces {env.VAR} in text nodes", () => {
    const out = run("Visit {env.PORTO_TEST_SITE} today.\n", {
      vars: { site: "example.com" },
      env: { PORTO_TEST_SITE: "example.com" },
    });
    expect(out).toContain("Visit example.com today.");
  });

  test("resolves an unset env var to an empty string", () => {
    // Default mode warns; the spy keeps the warning out of the test output.
    const { result: out } = captureWarn(() =>
      run("A{env.PORTO_TEST_MISSING}B\n"),
    );
    expect(out).toContain("AB");
    expect(out).not.toContain("{env.");
  });

  test("warns by default on an unset env var", () => {
    const {
      result: { output, messages },
      warns,
    } = captureWarn(() => process("A{env.PORTO_TEST_MISSING}B\n"));
    expect(output).toContain("AB");
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Unset env var "{env.PORTO_TEST_MISSING}"');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain('Unset env var "{env.PORTO_TEST_MISSING}"');
  });

  test("with onMissingEnv throw, fails on an unset env var", () => {
    expect(() =>
      run("A{env.PORTO_TEST_MISSING}B\n", { onMissingEnv: "throw" }),
    ).toThrow('[Portosaur] Unset env var "{env.PORTO_TEST_MISSING}"');
  });

  test("with onMissingEnv ignore, silently renders an unset env var empty", () => {
    const { output, messages } = process("A{env.PORTO_TEST_MISSING}B\n", {
      onMissingEnv: "ignore",
    });
    expect(output).toContain("AB");
    expect(messages).toHaveLength(0);
  });

  test("with onMissingEnv throw, fails on an unset env var in an MDX expression", () => {
    expect(() =>
      run("{env.PORTO_TEST_MISSING}\n", { onMissingEnv: "throw" }),
    ).toThrow('[Portosaur] Unset env var "{env.PORTO_TEST_MISSING}"');
  });

  test("leaves the escape form {{env.VAR}} literal", () => {
    const out = run("```\nDeploy to {{env.PORTO_TEST_SITE}}.\n```\n", {
      env: { PORTO_TEST_SITE: "example.com" },
    });
    expect(out).toContain("{env.PORTO_TEST_SITE}");
    expect(out).not.toContain("example.com");
  });

  test("replaces {env.VAR} in link URLs", () => {
    const out = run("[Site]({env.PORTO_TEST_SITE}/page)\n", {
      env: { PORTO_TEST_SITE: "https://example.com" },
    });
    expect(out).toContain("https://example.com/page");
  });

  test("replaces {env.VAR} as an MDX expression", () => {
    const out = run("{env.PORTO_TEST_SITE}\n", {
      env: { PORTO_TEST_SITE: "example.com" },
    });
    expect(out).toContain("example.com");
    expect(out).not.toContain("{env.");
  });

  test("resolves env vars with no vars defined", () => {
    const out = run("A{env.FOO}B\n", { env: { FOO: "x" } });
    expect(out).toContain("AxB");
  });

  test("throws a descriptive error on an invalid onMissingVar value", () => {
    expect(() =>
      run("Some text.\n", { onMissingVar: "explode" as never }),
    ).toThrow('[Portosaur] Invalid site.content.on_missing_var "explode"');
  });

  test("throws a descriptive error on an invalid onMissingEnv value", () => {
    expect(() =>
      run("Some text.\n", { onMissingEnv: "explode" as never }),
    ).toThrow('[Portosaur] Invalid site.content.on_missing_env "explode"');
  });
});
