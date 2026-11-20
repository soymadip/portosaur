import { describe, expect, test } from "bun:test";
import {
  normalizeIconId,
  resolveSiteIcon,
  type SiteIcons,
} from "../src/lib/site-icons.ts";

// A small hand-built icon map — the resolver only ever reads the
// map, so no packs are needed here.
const icons: SiteIcons = {
  "mdi:home": { viewBox: "0 0 24 24", body: "<path d='home'/>" },
  "mdi:notebook": { viewBox: "0 0 24 24", body: "<path d='notebook'/>" },
  "mdi:folder": { viewBox: "0 0 24 24", body: "<path d='folder'/>" },
  "mdi:github": { viewBox: "0 0 24 24", body: "<path d='github'/>" },
  "simple-icons:python": {
    viewBox: "0 0 24 24",
    body: "<path d='python'/>",
  },
  "devicon:rust": { viewBox: "0 0 128 128", body: "<path d='rust'/>" },
};

describe("normalizeIconId", () => {
  test("maps shorthand prefixes to their canonical pack", () => {
    expect(normalizeIconId("md:home")).toBe("mdi:home");
    expect(normalizeIconId("mdi:home")).toBe("mdi:home");
    expect(normalizeIconId("si:python")).toBe("simple-icons:python");
    expect(normalizeIconId("di:rust")).toBe("devicon:rust");
  });

  test("returns null for malformed ids and unknown prefixes", () => {
    expect(normalizeIconId("home")).toBeNull();
    expect(normalizeIconId("md:")).toBeNull();
    expect(normalizeIconId("xx:home")).toBeNull();
    expect(normalizeIconId("md:home:extra")).toBeNull();
  });
});

describe("resolveSiteIcon", () => {
  test("returns the canonical id for an explicit id or techMap name", () => {
    expect(resolveSiteIcon("md:home", {}, icons)).toEqual({
      kind: "icon",
      id: "mdi:home",
    });
    expect(resolveSiteIcon("github", {}, icons)).toEqual({
      kind: "icon",
      id: "mdi:github",
    });
  });

  test("returns null for an unknown explicit id", () => {
    expect(resolveSiteIcon("md:definitely-not-an-icon", {}, icons)).toBeNull();
  });

  test("passes raw SVG through", () => {
    expect(resolveSiteIcon("<svg></svg>", {}, icons)).toEqual({
      kind: "svg",
      html: "<svg></svg>",
    });
  });

  test("resolves images with the site base", () => {
    expect(resolveSiteIcon("img/logo.png", { base: "/" }, icons)).toEqual({
      kind: "image",
      src: "/img/logo.png",
      fallback: undefined,
    });
    expect(resolveSiteIcon("img/logo.png", { base: "/docs/" }, icons)).toEqual({
      kind: "image",
      src: "/docs/img/logo.png",
      fallback: undefined,
    });
    expect(
      resolveSiteIcon(
        { src: "img/a.png", fallback: "img/b.png" },
        { base: "/docs/" },
        icons,
      ),
    ).toEqual({
      kind: "image",
      src: "/docs/img/a.png",
      fallback: "/docs/img/b.png",
    });
    expect(resolveSiteIcon("https://example.com/x.png", {}, icons)).toEqual({
      kind: "image",
      src: "https://example.com/x.png",
      fallback: undefined,
    });
  });

  test("resolves emoji", () => {
    expect(resolveSiteIcon("📁", {}, icons)).toEqual({
      kind: "emoji",
      value: "📁",
    });
  });

  test("guesses from the slug, then the fallback", () => {
    expect(
      resolveSiteIcon(
        undefined,
        { slug: "python", fallbackIcon: "md:notebook" },
        icons,
      ),
    ).toEqual({ kind: "icon", id: "simple-icons:python" });
    expect(
      resolveSiteIcon(
        undefined,
        { slug: "rust", fallbackIcon: "md:notebook" },
        icons,
      ),
    ).toEqual({ kind: "icon", id: "devicon:rust" });
    expect(
      resolveSiteIcon(
        undefined,
        { slug: "some-unknown-topic", fallbackIcon: "md:notebook" },
        icons,
      ),
    ).toEqual({ kind: "icon", id: "mdi:notebook" });
  });

  test("returns null when nothing resolves", () => {
    expect(resolveSiteIcon(undefined, {}, icons)).toBeNull();
    expect(
      resolveSiteIcon(undefined, { fallbackIcon: "md:not-here" }, icons),
    ).toBeNull();
    // An explicit id never falls through to the slug or fallback.
    expect(
      resolveSiteIcon("md:not-here", { slug: "python" }, icons),
    ).toBeNull();
  });
});
