import { expect, test, describe } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  absoluteImageUrl,
  siteOriginOf,
  sizedSocialImage,
} from "../src/lib/metadata.ts";
import type { PortosaurOptions } from "../src/lib/config.ts";

/** Minimal config — the metadata helpers only read the fields here. */
function config(overrides: Record<string, any> = {}): PortosaurOptions {
  return {
    site: {
      url: "https://example.com",
      baseUrl: "/",
      ...(overrides.site ?? {}),
    },
    projectDir: overrides.projectDir ?? "/site",
    portoPaths: overrides.portoPaths ?? {},
  } as PortosaurOptions;
}

describe("siteOriginOf", () => {
  test("is the bare URL at the site root", () => {
    expect(siteOriginOf(config())).toBe("https://example.com");
  });

  test("appends the base path, no trailing slash", () => {
    expect(siteOriginOf(config({ site: { baseUrl: "/porto-astro/" } }))).toBe(
      "https://example.com/porto-astro",
    );
    expect(siteOriginOf(config({ site: { baseUrl: "/porto-astro" } }))).toBe(
      "https://example.com/porto-astro",
    );
  });

  test("strips a trailing slash from the URL", () => {
    expect(
      siteOriginOf(config({ site: { url: "https://example.com/" } })),
    ).toBe("https://example.com");
  });
});

describe("absoluteImageUrl", () => {
  test("passes remote URLs through unchanged", () => {
    expect(absoluteImageUrl(config(), "https://cdn.example.com/card.png")).toBe(
      "https://cdn.example.com/card.png",
    );
    expect(absoluteImageUrl(config(), "//cdn.example.com/card.png")).toBe(
      "//cdn.example.com/card.png",
    );
  });

  test("prefixes local paths with the origin", () => {
    expect(absoluteImageUrl(config(), "img/social-card.jpeg")).toBe(
      "https://example.com/img/social-card.jpeg",
    );
    expect(absoluteImageUrl(config(), "/img/social-card.jpeg")).toBe(
      "https://example.com/img/social-card.jpeg",
    );
  });

  test("includes the base path, never twice", () => {
    const based = config({ site: { baseUrl: "/porto-astro/" } });
    expect(absoluteImageUrl(based, "img/social-card.jpeg")).toBe(
      "https://example.com/porto-astro/img/social-card.jpeg",
    );
    expect(absoluteImageUrl(based, "/img/social-card.jpeg")).toBe(
      "https://example.com/porto-astro/img/social-card.jpeg",
    );
  });
});

describe("sizedSocialImage", () => {
  test("sizes a local image from the file", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-metadata-"));
    try {
      const imgDir = path.join(root, "static", "img");
      fs.mkdirSync(imgDir, { recursive: true });
      await sharp({
        create: {
          width: 800,
          height: 400,
          channels: 3,
          background: { r: 40, g: 120, b: 200 },
        },
      })
        .png()
        .toFile(path.join(imgDir, "card.png"));
      const sized = await sizedSocialImage(
        config({ projectDir: root }),
        "img/card.png",
      );
      expect(sized).toEqual({
        url: "https://example.com/img/card.png",
        width: 800,
        height: 400,
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("returns the URL alone for remote and missing images", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-metadata-"));
    try {
      const cfg = config({ projectDir: root });
      expect(
        await sizedSocialImage(cfg, "https://cdn.example.com/card.png"),
      ).toEqual({ url: "https://cdn.example.com/card.png" });
      expect(await sizedSocialImage(cfg, "img/nope.png")).toEqual({
        url: "https://example.com/img/nope.png",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
