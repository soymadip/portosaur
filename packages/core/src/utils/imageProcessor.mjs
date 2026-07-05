import fs from "fs";
import path from "path";
import sharp from "sharp";
import { logger } from "@portosaur/logger";

// Image Processing Pipeline
/**
 * Processes an image by cropping it to a square and applying a shape mask.
 *
 * @param {string} inputPath - The path to the input image file.
 * @param {string} outputPath - The path where the processed image should be saved.
 * @param {string} [shape="circle"] - The shape mask to apply ("circle", "squircle", or "none"/"square").
 * @returns {Promise<string>} A promise that resolves to the outputPath on success.
 * @throws {Error} If the input file is not found or if image processing fails.
 */
export async function reshapeImage(
  inputPath,
  outputPath,
  shape = "circle",
  fitMode = "cover",
) {
  try {
    // Validate input file
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }

    // Create output directory
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Load and analyze image
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      throw new Error("Could not extract image metadata (width/height)");
    }

    let finalSize;
    let resizeSize;
    let padding = 0;

    if (fitMode === "contain") {
      finalSize = Math.max(metadata.width, metadata.height);
      // Add 15% padding so the image doesn't touch the edges of the circle (matches PWA logic)
      padding = Math.floor(finalSize * 0.15);
      resizeSize = finalSize - padding * 2;
    } else {
      finalSize = Math.min(metadata.width, metadata.height);
      resizeSize = finalSize;
    }

    let pipeline = image.resize({
      width: resizeSize,
      height: resizeSize,
      fit: fitMode,
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

    if (shape === "circle") {
      const radius = finalSize / 2;
      const circleSvg = Buffer.from(
        `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" /></svg>`,
      );

      pipeline = pipeline.composite([{ input: circleSvg, blend: "dest-in" }]);
    } else if (shape === "squircle") {
      // Create a super-ellipse path (squircle)
      // Standard squircle curvature: a = b = size/2, n = 4
      const r = finalSize / 2;
      // We use a simplified SVG path for a squircle-like shape
      // (a rounded rectangle with continuous curvature)
      const rx = finalSize * 0.2; // 20% border radius matches the frontend CSS
      const squircleSvg = Buffer.from(
        `<svg><rect x="0" y="0" width="${finalSize}" height="${finalSize}" rx="${rx}" ry="${rx}" /></svg>`,
      );

      pipeline = pipeline.composite([{ input: squircleSvg, blend: "dest-in" }]);
    }

    // Write output file
    await pipeline.png().toFile(outputPath);
    return outputPath;
  } catch (err) {
    logger.error(`Image processing failed: ${err.message}`);
    throw err;
  }
}
