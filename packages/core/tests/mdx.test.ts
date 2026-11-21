import { describe, test, expect } from "bun:test";
import remarkEmoji from "remark-emoji";
import { portosaurMdxOptions, parseCodeBlockMeta } from "../src/mdx.ts";
import remarkMermaid from "../src/plugins/remarkMermaid.ts";

/**
 * `portosaurMdxOptions` builds the Fumadocs global MDX preset for a
 * site. The emoji-shortcodes switch (`site.content
 * .render_emoji_shortcodes`, default true) gates the remark-emoji
 * plugin: off means `:smile:` stays literal text. The mermaid switch
 * (`site.content.mermaid`, default true) gates the diagram plugin:
 * off means ```mermaid fences stay plain code blocks.
 */
describe("portosaurMdxOptions", () => {
  test("renders emoji shortcodes by default", () => {
    const { remarkPlugins } = portosaurMdxOptions();
    expect(remarkPlugins).toContain(remarkEmoji);
  });

  test("skips the emoji plugin when renderEmojiShortcodes is false", () => {
    const { remarkPlugins } = portosaurMdxOptions({
      renderEmojiShortcodes: false,
    });
    expect(remarkPlugins).not.toContain(remarkEmoji);
  });

  test("renders mermaid diagrams by default", () => {
    const { remarkPlugins } = portosaurMdxOptions();
    expect(remarkPlugins).toContain(remarkMermaid);
  });

  test("skips the diagram plugin when mermaid is false", () => {
    const { remarkPlugins } = portosaurMdxOptions({ mermaid: false });
    expect(remarkPlugins).not.toContain(remarkMermaid);
  });
});

/**
 * `parseCodeBlockMeta` mirrors Fumadocs' default fence-meta
 * parser and adds Portosaur's `noWrap` flag.
 */
describe("parseCodeBlockMeta", () => {
  test("maps noCopy and noWrap to allow flags", () => {
    expect(parseCodeBlockMeta("noCopy noWrap")).toEqual({
      allowCopy: "false",
      allowWrap: "false",
      __raw: " ",
    });
  });

  test("keeps Fumadocs' title, tab and lineNumbers behavior", () => {
    expect(parseCodeBlockMeta('title="a.js" tab="Tab"')).toEqual({
      title: "a.js",
      tab: "Tab",
      __raw: " ",
    });
    expect(parseCodeBlockMeta("lineNumbers=4")).toEqual({
      "data-line-numbers": true,
      "data-line-numbers-start": 4,
      __raw: "",
    });
  });

  test("leaves unknown meta in __raw", () => {
    expect(parseCodeBlockMeta('noCopy lang="python"')).toEqual({
      allowCopy: "false",
      __raw: ' lang="python"',
    });
  });
});
