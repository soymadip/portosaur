import { describe, test, expect, spyOn } from "bun:test";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkStringify from "remark-stringify";
import remarkDuplicateAnchors, {
  type RemarkDuplicateAnchorsOptions,
} from "../src/plugins/remarkDuplicateAnchors.ts";

/**
 * `remarkDuplicateAnchors` reports headings that share an anchor
 * id within one page, following `site.content.on_duplicate_anchor`:
 * "throw" fails the build, "warn" warns (default), "ignore" stays
 * silent. These tests run it through the real unified pipeline,
 * the way the MDX compiler calls it.
 */

function process(
  mdx: string,
  options: RemarkDuplicateAnchorsOptions = {},
): { output: string; messages: string[] } {
  const file = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkDuplicateAnchors, options)
    .use(remarkStringify)
    .processSync(mdx);
  return {
    output: String(file),
    messages: file.messages.map((message) => message.message),
  };
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

describe("remarkDuplicateAnchors", () => {
  test("distinct headings are quiet", () => {
    const { result, warns } = captureWarn(() =>
      process("## One\n\n## Two\n\n## Three\n"),
    );
    expect(result.messages).toHaveLength(0);
    expect(warns).toHaveLength(0);
  });

  test("two identical headings warn by default", () => {
    const {
      result: { messages },
      warns,
    } = captureWarn(() =>
      process("## Prerequisites\n\nSome text.\n\n## Prerequisites\n"),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Duplicate heading "Prerequisites"');
    expect(messages[0]).toContain('"prerequisites-1"');
    expect(warns).toHaveLength(1);
    expect(warns[0]?.[0]).toContain('Duplicate heading "Prerequisites"');
  });

  test("with throw, fails the build on a duplicate", () => {
    expect(() =>
      process("## Same\n\n## Same\n", { onDuplicateAnchor: "throw" }),
    ).toThrow('Duplicate heading "Same"');
  });

  test("with ignore, stays silent on a duplicate", () => {
    const { result, warns } = captureWarn(() =>
      process("## Same\n\n## Same\n", { onDuplicateAnchor: "ignore" }),
    );
    expect(result.messages).toHaveLength(0);
    expect(warns).toHaveLength(0);
  });

  test("an invalid behavior fails at plugin creation", () => {
    expect(() =>
      process("## Same\n", {
        onDuplicateAnchor: "error" as never,
      }),
    ).toThrow('Invalid site.content.on_duplicate_anchor "error"');
  });

  test("two headings with the same custom id warn", () => {
    const {
      result: { messages },
    } = captureWarn(() =>
      process("## First [#shared]\n\n## Second [#shared]\n"),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Duplicate heading id "shared"');
  });

  test("a plain heading matching a custom id warns", () => {
    const {
      result: { messages },
    } = captureWarn(() => process("## First [#shared]\n\n## Shared\n"));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('Duplicate heading "Shared"');
    expect(messages[0]).toContain('"shared-1"');
  });

  test("different text slugging to the same id warns", () => {
    const {
      result: { messages },
    } = captureWarn(() => process("## Foo Bar\n\n## Foo-Bar\n"));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('"foo-bar-1"');
  });

  test("headings with inline code keep their underscores", () => {
    const {
      result: { messages },
    } = captureWarn(() =>
      process("### `topic_list` Options\n\n### `topic_list` Options\n"),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('"topic_list-options-1"');
  });
});
