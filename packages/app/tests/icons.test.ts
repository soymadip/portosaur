import { describe, expect, test } from "bun:test";
import {
  pageHref,
  renderIcon,
  renderIconSymbol,
  renderIconUse,
  renderSidebarIcon,
  collectSidebarSprite,
  resolveDynamicIconId,
} from "../src/utils/icons.ts";

describe("pageHref", () => {
  test("appends a trailing slash to a bare page path", () => {
    expect(pageHref("/docs/cli-reference")).toBe("/docs/cli-reference/");
    expect(pageHref("/notes")).toBe("/notes/");
  });

  test("leaves already-slashed paths and the root alone", () => {
    expect(pageHref("/docs/cli-reference/")).toBe("/docs/cli-reference/");
    expect(pageHref("/")).toBe("/");
  });

  test("keeps a query or hash after the slash", () => {
    expect(pageHref("/docs/guide?tab=1")).toBe("/docs/guide/?tab=1");
    expect(pageHref("/docs/guide#setup")).toBe("/docs/guide/#setup");
    expect(pageHref("/#about")).toBe("/#about");
  });

  test("leaves absolute URLs and hash links alone", () => {
    expect(pageHref("https://example.com/docs")).toBe(
      "https://example.com/docs",
    );
    expect(pageHref("//example.com/docs")).toBe("//example.com/docs");
    expect(pageHref("#setup")).toBe("#setup");
    expect(pageHref("mailto:me@example.com")).toBe("mailto:me@example.com");
  });

  test("leaves asset URLs alone", () => {
    expect(pageHref("/resume.pdf")).toBe("/resume.pdf");
    expect(pageHref("/img/logo.png")).toBe("/img/logo.png");
    expect(pageHref("/sitemap.xml")).toBe("/sitemap.xml");
  });

  test("slashes a slug with a dot that is not a file extension", () => {
    expect(pageHref("/docs/v1.2")).toBe("/docs/v1.2/");
  });

  test("leaves an empty path alone", () => {
    expect(pageHref("")).toBe("");
  });
});

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
      2 * renderIcon("md:folder").length +
      3 * renderIcon("md:notebook").length;
    const spriteTotal =
      sprite.html.length +
      2 * renderIconUse("md:folder").length +
      3 * renderIconUse("md:notebook").length;
    expect(spriteTotal).toBeLessThan(inlineTotal);
    expect(rows).toBe(5);
  });

  test("emits no sprite when no icon repeats", () => {
    const sprite = collectSidebarSprite([
      { label: "Only Doc", type: "doc" },
    ]);
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
