// Favicon renderer — standalone, no TypeScript, runs under node or bun.
//
// This lives in @portosaur/core (not the CLI) on purpose: it imports
// sharp, and sharp's platform binary is ~20MB. The CLI must stay light
// for a quick global install, so the CLI only orchestrates — finding
// the icon, the stamp check, the manifest — and spawns this script
// with the project's sharp when the icon actually changed. Every user
// project installs @portosaur/core anyway, so the weight lands where
// the site's other heavy dependencies already live.
//
// Usage: node make-favicons.mjs <spec.json>
// Spec: { source, fitMode, reshapedPath, outputs: [{ path, size }] }
//
// The script circle-crops the source (cover crops to the smaller
// side, contain fits the larger side with 15% padding so the image
// doesn't touch the circle's edges), writes the reshaped PNG, then
// renders each output size from it. Exits non-zero with the error on
// stderr when anything fails.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const specPath = process.argv[2];
if (!specPath) {
  console.error("make-favicons: missing spec file argument");
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));

if (!fs.existsSync(spec.source)) {
  console.error(`make-favicons: input file not found: ${spec.source}`);
  process.exit(2);
}
fs.mkdirSync(path.dirname(spec.reshapedPath), { recursive: true });

const image = sharp(spec.source);
const metadata = await image.metadata();
if (!metadata.width || !metadata.height) {
  console.error("make-favicons: could not read image metadata (width/height)");
  process.exit(2);
}

let finalSize;
let resizeSize;
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
