import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

/**
 * Favicon rendering — the pixel work for per-site favicon
 * generation: circle-crop the site icon (cover fit for
 * portfolio, contain with 15% padding for docs) and render it
 * at 32px, 192px, 512px, and 180px.
 *
 * Lives in core, not the CLI, because it imports sharp (~20MB
 * platform binary). The CLI spawns `scripts/make-favicons.mjs`
 * (a thin runner over this module) instead of importing it.
 */

/** One sized output, rendered from the circle-cropped source. */
export interface FaviconRenderOutput {
  path: string;
  size: number;
}

export interface FaviconRenderSpec {
  source: string;
  fitMode: "cover" | "contain";
  reshapedPath: string;
  outputs: FaviconRenderOutput[];
}

/**
 * Circle-crop the source image and render each output size from
 * it. Throws when the source is missing or unreadable.
 */
export async function renderFavicons(spec: FaviconRenderSpec): Promise<void> {
  if (!fs.existsSync(spec.source)) {
    throw new Error(`Input file not found: ${spec.source}`);
  }
  fs.mkdirSync(path.dirname(spec.reshapedPath), { recursive: true });

  const image = sharp(spec.source);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not extract image metadata (width/height)");
  }

  let finalSize: number;
  let resizeSize: number;
  let padding = 0;
  if (spec.fitMode === "contain") {
    finalSize = Math.max(metadata.width, metadata.height);
    // 15% padding so the image doesn't touch the edges of the
    // circle (matches the Astro PWA logic).
    padding = Math.floor(finalSize * 0.15);
    resizeSize = finalSize - padding * 2;
  } else {
    finalSize = Math.min(metadata.width, metadata.height);
    resizeSize = finalSize;
  }

  let pipeline = image.resize({
    width: resizeSize,
    height: resizeSize,
    fit: spec.fitMode,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
  if (padding > 0) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  const radius = finalSize / 2;
  const circleSvg = Buffer.from(
    `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" /></svg>`,
  );
  pipeline = pipeline.composite([{ input: circleSvg, blend: "dest-in" }]);

  await pipeline.png().toFile(spec.reshapedPath);

  const baseImage = await sharp(spec.reshapedPath).png().toBuffer();
  for (const output of spec.outputs ?? []) {
    fs.mkdirSync(path.dirname(output.path), { recursive: true });
    await sharp(baseImage).resize(output.size, output.size).toFile(output.path);
  }
}
