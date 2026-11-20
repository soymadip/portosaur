import { expect, test, describe } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  resolveSiteIconSpec,
  findLocalIcon,
  reshapeToCircle,
  ensurePublicUnion,
  generateFavicons,
} from "../src/engine/utils/favicons.ts";
import type { PortosaurOptions } from "../src/engine/generators/siteConfig.ts";

/** Minimal options — the favicon pipeline only reads the fields listed here. */
function options(overrides: Record<string, any> = {}): PortosaurOptions {
  return {
    site: {
      url: "https://example.com",
      baseUrl: "/",
      title: "Test Site",
      tagline: "A test tagline",
      ...(overrides.site ?? {}),
    },
    siteMode: overrides.siteMode ?? "docs",
    docsHome: overrides.docsHome ?? {},
    homePage: overrides.homePage ?? {},
    cssFiles: overrides.cssFiles ?? [],
  } as PortosaurOptions;
}

const coreStaticDir = path.resolve(import.meta.dirname, "../../core/static");

/** A small non-square test image (200x100, solid red). */
async function makeTestImage(dir: string, name = "icon.png"): Promise<string> {
  const target = path.join(dir, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp({
    create: {
      width: 200,
      height: 100,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toFile(target);
  return target;
}

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  success: () => {},
};

describe("resolveSiteIconSpec", () => {
  test("docs mode reads docs_home.icon", () => {
    expect(
      resolveSiteIconSpec(options({ docsHome: { icon: "img/docs.png" } })),
    ).toBe("img/docs.png");
  });

  test("portfolio mode reads the hero profile picture", () => {
    expect(
      resolveSiteIconSpec(
        options({
          siteMode: "portfolio",
          homePage: { heroSection: { profilePic: "img/me.jpg" } },
        }),
      ),
    ).toBe("img/me.jpg");
  });

  test("unwraps { src, fallback } remote images", () => {
    expect(
      resolveSiteIconSpec(
        options({
          siteMode: "portfolio",
          homePage: {
            heroSection: {
              profilePic: {
                src: "https://example.com/me.png",
                fallback: "/fallbacks/x.png",
              },
            },
          },
        }),
      ),
    ).toBe("https://example.com/me.png");
  });

  test("falls back to img/icon.png when nothing is configured", () => {
    expect(resolveSiteIconSpec(options())).toBe("img/icon.png");
    expect(
      resolveSiteIconSpec(
        options({ siteMode: "portfolio", homePage: { heroSection: {} } }),
      ),
    ).toBe("img/icon.png");
  });
});

describe("findLocalIcon", () => {
  test("searches dirs in order and returns null when nowhere", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const first = path.join(root, "a");
      const second = path.join(root, "b");
      fs.mkdirSync(path.join(second, "img"), { recursive: true });
      fs.writeFileSync(path.join(second, "img", "icon.png"), "x");
      expect(findLocalIcon("img/icon.png", [first, second])).toBe(
        path.join(second, "img", "icon.png"),
      );
      expect(findLocalIcon("img/missing.png", [first, second])).toBeNull();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("reshapeToCircle", () => {
  test("cover crops to the smaller side, contain fits the larger side", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const input = await makeTestImage(root);
      const coverOut = path.join(root, "cover.png");
      await reshapeToCircle(input, coverOut, "cover");
      const coverMeta = await sharp(coverOut).metadata();
      expect(coverMeta.width).toBe(100);
      expect(coverMeta.height).toBe(100);

      const containOut = path.join(root, "contain.png");
      await reshapeToCircle(input, containOut, "contain");
      const containMeta = await sharp(containOut).metadata();
      expect(containMeta.width).toBe(200);
      expect(containMeta.height).toBe(200);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("corners are transparent (circle mask)", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const input = await makeTestImage(root);
      const out = path.join(root, "circle.png");
      await reshapeToCircle(input, out, "cover");
      const { data } = await sharp(out)
        .raw()
        .toBuffer({ resolveWithObject: true });
      // Top-left corner pixel: alpha channel is the 4th byte.
      expect(data[3]).toBe(0);
      // Center pixel: fully opaque red.
      const center = (50 * 100 + 50) * 4;
      expect(data[center]).toBe(255);
      expect(data[center + 3]).toBe(255);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("ensurePublicUnion", () => {
  test("links static entries and replaces a legacy whole-dir symlink", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const staticDir = path.join(root, "static");
      fs.mkdirSync(path.join(staticDir, "img"), { recursive: true });
      fs.writeFileSync(path.join(staticDir, "img", "a.png"), "x");
      fs.writeFileSync(path.join(staticDir, "robots.txt"), "y");
      const publicDir = path.join(root, ".portosaur", "public");
      fs.mkdirSync(path.join(root, ".portosaur"), { recursive: true });
      fs.symlinkSync("../static", publicDir, "dir");

      const linked = ensurePublicUnion({ projectDir: root, publicDir });
      expect(linked.sort()).toEqual(["img", "robots.txt"]);
      expect(fs.lstatSync(publicDir).isSymbolicLink()).toBe(false);
      expect(fs.lstatSync(path.join(publicDir, "img")).isSymbolicLink()).toBe(
        true,
      );
      expect(fs.readFileSync(path.join(publicDir, "robots.txt"), "utf-8")).toBe(
        "y",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("prunes stale symlinks but never deletes real files", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const staticDir = path.join(root, "static");
      fs.mkdirSync(staticDir, { recursive: true });
      fs.writeFileSync(path.join(staticDir, "keep.txt"), "y");
      const publicDir = path.join(root, ".portosaur", "public");
      ensurePublicUnion({ projectDir: root, publicDir });
      // A generated real file + a symlink that goes stale.
      fs.writeFileSync(path.join(publicDir, "manifest.webmanifest"), "{}");
      fs.symlinkSync("../../static/gone.txt", path.join(publicDir, "gone.txt"));
      fs.writeFileSync(path.join(staticDir, "gone.txt"), "y");
      ensurePublicUnion({ projectDir: root, publicDir });
      fs.rmSync(path.join(staticDir, "gone.txt"), { force: true });

      ensurePublicUnion({ projectDir: root, publicDir });
      expect(fs.existsSync(path.join(publicDir, "gone.txt"))).toBe(false);
      expect(fs.existsSync(path.join(publicDir, "manifest.webmanifest"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(publicDir, "keep.txt"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a user entry replaces a generated real dir (user wins)", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const staticDir = path.join(root, "static");
      fs.mkdirSync(staticDir, { recursive: true });
      const publicDir = path.join(root, ".portosaur", "public");
      fs.mkdirSync(path.join(publicDir, "favicon"), { recursive: true });
      fs.writeFileSync(
        path.join(publicDir, "favicon", "favicon.ico"),
        "generated",
      );
      fs.mkdirSync(path.join(staticDir, "favicon"), { recursive: true });
      fs.writeFileSync(path.join(staticDir, "favicon", "favicon.ico"), "mine");

      ensurePublicUnion({ projectDir: root, publicDir });
      expect(
        fs.lstatSync(path.join(publicDir, "favicon")).isSymbolicLink(),
      ).toBe(true);
      expect(
        fs.readFileSync(
          path.join(publicDir, "favicon", "favicon.ico"),
          "utf-8",
        ),
      ).toBe("mine");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("links the app static dir when the user has no static dir", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    const coreRoot = mkdtempSync(path.join(tmpdir(), "porto-app-static-"));
    try {
      const appDir = path.join(coreRoot, "static");
      fs.mkdirSync(path.join(appDir, "img"), { recursive: true });
      fs.writeFileSync(path.join(appDir, "img", "icon.png"), "app-icon");
      const publicDir = path.join(root, ".portosaur", "public");

      const linked = ensurePublicUnion({
        projectDir: root,
        publicDir,
        coreStaticDir: appDir,
      });
      expect(linked).toEqual([]);
      expect(fs.lstatSync(path.join(publicDir, "img")).isSymbolicLink()).toBe(
        true,
      );
      expect(
        fs.readFileSync(path.join(publicDir, "img", "icon.png"), "utf-8"),
      ).toBe("app-icon");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(coreRoot, { recursive: true, force: true });
    }
  });

  test("merges a directory both sides have, user files winning per name", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    const coreRoot = mkdtempSync(path.join(tmpdir(), "porto-app-static-"));
    try {
      const staticDir = path.join(root, "static");
      fs.mkdirSync(path.join(staticDir, "img"), { recursive: true });
      fs.writeFileSync(path.join(staticDir, "img", "icon.png"), "mine");
      fs.writeFileSync(
        path.join(staticDir, "img", "custom.png"),
        "mine-custom",
      );
      const appDir = path.join(coreRoot, "static");
      fs.mkdirSync(path.join(appDir, "img"), { recursive: true });
      fs.writeFileSync(path.join(appDir, "img", "icon.png"), "app");
      fs.writeFileSync(path.join(appDir, "img", "other.png"), "app-other");
      const publicDir = path.join(root, ".portosaur", "public");

      const union = () =>
        ensurePublicUnion({
          projectDir: root,
          publicDir,
          coreStaticDir: appDir,
        });
      union();
      // A second run rebuilds the merged dir — it must survive.
      union();
      expect(fs.lstatSync(path.join(publicDir, "img")).isSymbolicLink()).toBe(
        false,
      );
      expect(
        fs.readFileSync(path.join(publicDir, "img", "icon.png"), "utf-8"),
      ).toBe("mine");
      expect(
        fs.readFileSync(path.join(publicDir, "img", "custom.png"), "utf-8"),
      ).toBe("mine-custom");
      expect(
        fs.readFileSync(path.join(publicDir, "img", "other.png"), "utf-8"),
      ).toBe("app-other");
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(coreRoot, { recursive: true, force: true });
    }
  });

  test("prunes a stale app entry", () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    const coreRoot = mkdtempSync(path.join(tmpdir(), "porto-app-static-"));
    try {
      const appDir = path.join(coreRoot, "static");
      fs.mkdirSync(path.join(appDir, "img"), { recursive: true });
      fs.writeFileSync(path.join(appDir, "img", "icon.png"), "app-icon");
      const publicDir = path.join(root, ".portosaur", "public");
      ensurePublicUnion({ projectDir: root, publicDir, coreStaticDir: appDir });
      expect(fs.existsSync(path.join(publicDir, "img", "icon.png"))).toBe(true);

      fs.rmSync(path.join(appDir, "img"), { recursive: true, force: true });
      ensurePublicUnion({ projectDir: root, publicDir, coreStaticDir: appDir });
      expect(fs.existsSync(path.join(publicDir, "img"))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(coreRoot, { recursive: true, force: true });
    }
  });
});

describe("generateFavicons", () => {
  test("writes the icon set + manifest from the site icon", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const staticDir = path.join(root, "static");
      await makeTestImage(path.join(staticDir, "img"));
      const cssFile = path.join(root, "scheme.css");
      fs.writeFileSync(cssFile, ":root { --porto-color-bg: #123456; }");
      const publicDir = path.join(root, ".portosaur", "public");
      fs.mkdirSync(publicDir, { recursive: true });

      const result = await generateFavicons({
        projectDir: root,
        options: options({
          docsHome: { icon: "img/icon.png" },
          cssFiles: [cssFile],
        }),
        publicDir,
        cacheDir: path.join(root, ".portosaur", "cache"),
        coreStaticDir,
        logger: silentLogger,
      });
      expect(result.skipped).toBe(false);
      for (const name of [
        "favicon.ico",
        "icon-192x192.png",
        "icon-512x512.png",
        "apple-touch-icon.png",
      ]) {
        expect(fs.existsSync(path.join(publicDir, "favicon", name))).toBe(true);
      }
      const icoMeta = await sharp(
        path.join(publicDir, "favicon", "favicon.ico"),
      ).metadata();
      expect(icoMeta.width).toBe(32);
      expect(icoMeta.height).toBe(32);
      const icon192Meta = await sharp(
        path.join(publicDir, "favicon", "icon-192x192.png"),
      ).metadata();
      expect(icon192Meta.width).toBe(192);

      const manifest = JSON.parse(
        fs.readFileSync(path.join(publicDir, "manifest.webmanifest"), "utf-8"),
      );
      expect(manifest.name).toBe("Test Site");
      expect(manifest.theme_color).toBe("#123456");
      expect(manifest.icons).toHaveLength(4);
      expect(manifest.icons[0].src).toBe("/favicon/icon-192x192.png");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("skips when the user provides their own favicon dir", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const staticDir = path.join(root, "static");
      fs.mkdirSync(path.join(staticDir, "favicon"), { recursive: true });
      fs.writeFileSync(path.join(staticDir, "favicon", "favicon.ico"), "mine");
      const publicDir = path.join(root, ".portosaur", "public");
      ensurePublicUnion({ projectDir: root, publicDir });

      const result = await generateFavicons({
        projectDir: root,
        options: options(),
        publicDir,
        cacheDir: path.join(root, ".portosaur", "cache"),
        coreStaticDir,
        logger: silentLogger,
      });
      expect(result.skipped).toBe(true);
      expect(
        fs.readFileSync(
          path.join(publicDir, "favicon", "favicon.ico"),
          "utf-8",
        ),
      ).toBe("mine");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("second run is a no-op when the source is unchanged", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const staticDir = path.join(root, "static");
      await makeTestImage(path.join(staticDir, "img"));
      const publicDir = path.join(root, ".portosaur", "public");
      fs.mkdirSync(publicDir, { recursive: true });
      const params = {
        projectDir: root,
        options: options({ docsHome: { icon: "img/icon.png" } }),
        publicDir,
        cacheDir: path.join(root, ".portosaur", "cache"),
        coreStaticDir,
        logger: silentLogger,
      };
      const first = await generateFavicons(params);
      expect(first.skipped).toBe(false);
      const mtime = fs.statSync(
        path.join(publicDir, "favicon", "favicon.ico"),
      ).mtimeMs;
      const second = await generateFavicons(params);
      expect(second.skipped).toBe(true);
      expect(
        fs.statSync(path.join(publicDir, "favicon", "favicon.ico")).mtimeMs,
      ).toBe(mtime);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("falls back to the default icon when the configured one is missing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-"));
    try {
      const publicDir = path.join(root, ".portosaur", "public");
      fs.mkdirSync(publicDir, { recursive: true });
      const warnings: string[] = [];
      const result = await generateFavicons({
        projectDir: root,
        options: options({ docsHome: { icon: "img/nope.png" } }),
        publicDir,
        cacheDir: path.join(root, ".portosaur", "cache"),
        coreStaticDir,
        logger: { ...silentLogger, warn: (m: string) => warnings.push(m) },
      });
      expect(result.skipped).toBe(false);
      expect(warnings.length).toBeGreaterThan(0);
      expect(
        fs.existsSync(path.join(publicDir, "favicon", "favicon.ico")),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
