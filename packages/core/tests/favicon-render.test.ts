import { expect, test, describe } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { renderFavicons } from "../src/lib/favicon-render.ts";

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

describe("renderFavicons", () => {
  test("cover crops to the smaller side, contain fits the larger side", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-render-"));
    try {
      const input = await makeTestImage(root);
      const coverOut = path.join(root, "cover.png");
      await renderFavicons({
        source: input,
        fitMode: "cover",
        reshapedPath: coverOut,
        outputs: [],
      });
      const coverMeta = await sharp(coverOut).metadata();
      expect(coverMeta.width).toBe(100);
      expect(coverMeta.height).toBe(100);

      const containOut = path.join(root, "contain.png");
      await renderFavicons({
        source: input,
        fitMode: "contain",
        reshapedPath: containOut,
        outputs: [],
      });
      const containMeta = await sharp(containOut).metadata();
      expect(containMeta.width).toBe(200);
      expect(containMeta.height).toBe(200);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("corners are transparent (circle mask) and outputs render at size", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-render-"));
    try {
      const input = await makeTestImage(root);
      const reshaped = path.join(root, "reshaped.png");
      const out32 = path.join(root, "out", "favicon.ico");
      const out192 = path.join(root, "out", "icon-192x192.png");
      await renderFavicons({
        source: input,
        fitMode: "cover",
        reshapedPath: reshaped,
        outputs: [
          { path: out32, size: 32 },
          { path: out192, size: 192 },
        ],
      });
      const { data } = await sharp(reshaped)
        .raw()
        .toBuffer({ resolveWithObject: true });
      // Top-left corner pixel: alpha channel is the 4th byte.
      expect(data[3]).toBe(0);
      // Center pixel: fully opaque red.
      const center = (50 * 100 + 50) * 4;
      expect(data[center]).toBe(255);
      expect(data[center + 3]).toBe(255);

      const meta32 = await sharp(out32).metadata();
      expect(meta32.width).toBe(32);
      expect(meta32.height).toBe(32);
      const meta192 = await sharp(out192).metadata();
      expect(meta192.width).toBe(192);
      expect(meta192.height).toBe(192);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("throws when the source is missing", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-favicon-render-"));
    try {
      await expect(
        renderFavicons({
          source: path.join(root, "nope.png"),
          fitMode: "cover",
          reshapedPath: path.join(root, "out.png"),
          outputs: [],
        }),
      ).rejects.toThrow("Input file not found");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
