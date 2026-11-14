import { describe, test, expect } from "bun:test";
import path from "node:path";
import {
  localImageDimensions,
  staticDirsForConfig,
} from "../src/utils/imageSize.ts";

/**
 * `localImageDimensions` reads a configured image's intrinsic size so
 * components can pass `width` / `height` to Astro's `<Image />`
 * (required for public-dir images). Remote URLs and missing files
 * return null — callers fall back to a plain `<img>`.
 */

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");
const APP_STATIC = path.join(REPO_ROOT, "packages/app/static");

describe("localImageDimensions", () => {
  test("sizes a theme-default image", async () => {
    // `img/icon.png` is the theme default (also the playground's
    // profile picture and the docs home icon).
    const dims = await localImageDimensions("img/icon.png", [APP_STATIC]);
    expect(dims).toEqual({ width: 418, height: 512 });
  });

  test("accepts an absolute site-root path", async () => {
    const dims = await localImageDimensions("/img/icon.png", [APP_STATIC]);
    expect(dims).toEqual({ width: 418, height: 512 });
  });

  test("returns null for remote URLs", async () => {
    expect(
      await localImageDimensions("https://example.com/x.png", [APP_STATIC]),
    ).toBeNull();
    expect(
      await localImageDimensions("//example.com/x.png", [APP_STATIC]),
    ).toBeNull();
  });

  test("returns null for data URIs and missing files", async () => {
    expect(
      await localImageDimensions("data:image/png;base64,abc", [APP_STATIC]),
    ).toBeNull();
    expect(
      await localImageDimensions("img/does-not-exist.png", [APP_STATIC]),
    ).toBeNull();
    expect(await localImageDimensions("", [APP_STATIC])).toBeNull();
  });

  test("falls through static dirs in order", async () => {
    const dims = await localImageDimensions("img/icon.png", [
      "/nonexistent/static",
      APP_STATIC,
    ]);
    expect(dims).toEqual({ width: 418, height: 512 });
  });
});

describe("staticDirsForConfig", () => {
  test("orders project static before theme defaults before staging", () => {
    const dirs = staticDirsForConfig({
      projectDir: "/proj",
      portoPaths: { static: "/app/static" },
    });
    expect(dirs).toEqual([
      path.join("/proj", "static"),
      "/app/static",
      path.join("/proj", ".portosaur", "static"),
    ]);
  });

  test("tolerates missing config", () => {
    expect(staticDirsForConfig({})).toEqual([]);
  });
});
