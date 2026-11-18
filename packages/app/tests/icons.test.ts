import { describe, expect, test } from "bun:test";
import {
  renderIcon,
  renderIconSymbol,
  renderIconUse,
  renderSidebarIcon,
  collectSidebarSprite,
  resolveDynamicIconId,
} from "../src/lib/icons.ts";

// Ported from the Astro app tests (migrate/astro
// packages/app/tests/icons.test.ts). The `pageHref` tests moved
// to pageUrl.test.ts with the helper itself.

describe("resolveDynamicIconId", () => {
  test("returns the Iconify id for an explicit id or techMap name", () => {
    expect(resolveDynamicIconId("md:home")).toBe("md:home");
    expect(resolveDynamicIconId("github")).toBe("md:github");
  });

  test("returns null for emoji, images and raw SVG", () => {
    expect(resolveDynamicIconId("📁")).toBeNull();
    expect(resolveDynamicIconId("img/logo.png")).toBeNull();
    expect(resolveDynamicIconId("<svg></svg>")).toBeNull();
  });

  test("guesses from the slug, then the fallback", () => {
    expect(
      resolveDynamicIconId(undefined, {
        slug: "python",
        fallbackIcon: "md:notebook",
      }),
    ).toBe("si:python");
    expect(
      resolveDynamicIconId(undefined, {
        slug: "some-unknown-topic",
        fallbackIcon: "md:notebook",
      }),
    ).toBe("md:notebook");
  });

  test("returns null when nothing resolves", () => {
    expect(resolveDynamicIconId("md:definitely-not-an-icon")).toBeNull();
    expect(resolveDynamicIconId(undefined, {})).toBeNull();
  });
});

describe("sidebar icon sprite", () => {
  test("a symbol carries the icon's viewBox and body verbatim", () => {
    const inline = renderIcon("md:home");
    const symbol = renderIconSymbol("md:home");
    const viewBox = inline.match(/viewBox="([^"]+)"/)?.[1];
    const body = inline.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
    expect(viewBox).toBe("0 0 24 24");
    expect(symbol).toBe(
      `<symbol id="porto-icon-md:home" viewBox="${viewBox}">${body}</symbol>`,
    );
  });

  test("a use reference is the same 1em svg with the body replaced", () => {
    expect(renderIconUse("md:home")).toBe(
      `<svg width="1em" height="1em" aria-hidden="true"><use href="#porto-icon-md:home"/></svg>`,
    );
  });

  test("collects repeated icons, ignores single-use ones", () => {
    const tree = [
      {
        label: "Alpha Guide",
        type: "category",
        items: [
          { label: "First Doc", type: "doc" },
          { label: "Second Doc", type: "doc" },
        ],
      },
      {
        label: "Beta Guide",
        type: "category",
        items: [{ label: "Third Doc", type: "doc" }],
      },
    ];
    const sprite = collectSidebarSprite(tree);
    // Both fallbacks repeat (two categories, three docs).
    expect([...sprite.ids].sort()).toEqual(["md:folder", "md:notebook"]);
    expect(sprite.html).toContain("<symbol");
    expect(sprite.html).toContain("data-porto-sprite");
    // The sprite + references must be smaller than the inline SVGs.
    const rows = 5;
    const inlineTotal =
      2 * renderIcon("md:folder").length + 3 * renderIcon("md:notebook").length;
    const spriteTotal =
      sprite.html.length +
      2 * renderIconUse("md:folder").length +
      3 * renderIconUse("md:notebook").length;
    expect(spriteTotal).toBeLessThan(inlineTotal);
    expect(rows).toBe(5);
  });

  test("emits no sprite when no icon repeats", () => {
    const sprite = collectSidebarSprite([{ label: "Only Doc", type: "doc" }]);
    expect(sprite.html).toBe("");
    expect(sprite.ids.size).toBe(0);
  });

  test("renderSidebarIcon uses the sprite only for member icons", () => {
    const ids = new Set(["md:notebook"]);
    const opts = { slug: "some-unknown-topic", fallbackIcon: "md:notebook" };
    expect(renderSidebarIcon(undefined, opts, ids)).toBe(
      renderIconUse("md:notebook"),
    );
    expect(renderSidebarIcon(undefined, opts, new Set())).toBe(
      renderIcon("md:notebook"),
    );
    // Emoji rows never use the sprite, even when the id set is passed.
    expect(renderSidebarIcon("📁", {}, ids)).toContain("📁");
  });
});
