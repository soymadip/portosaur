import { describe, test, expect } from "bun:test";
import remarkEmoji from "remark-emoji";
import { portosaurMdxOptions } from "../src/mdx.ts";

/**
 * `portosaurMdxOptions` builds the Fumadocs global MDX preset for a
 * site. The emoji-shortcodes switch (`site.markdown
 * .render_emoji_shortcodes`, default true) gates the remark-emoji
 * plugin: off means `:smile:` stays literal text.
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
});
