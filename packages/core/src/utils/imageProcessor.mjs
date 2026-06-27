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
export async function reshapeImage(inputPath, outputPath, shape = "circle") {
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

    // Extract and crop to square
    const size = Math.min(metadata.width, metadata.height);

    let pipeline = image.extract({
      left: Math.floor((metadata.width - size) / 2),
      top: Math.floor((metadata.height - size) / 2),
      width: size,
      height: size,
    });

    if (shape === "circle") {
      const radius = size / 2;
      const circleSvg = Buffer.from(
        `<svg><circle cx="${radius}" cy="${radius}" r="${radius}" /></svg>`,
      );

      pipeline = pipeline.composite([{ input: circleSvg, blend: "dest-in" }]);
    } else if (shape === "squircle") {
      const rx = size * 0.225;
      const squircleSvg = Buffer.from(
        `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${rx}" ry="${rx}" /></svg>`,
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
