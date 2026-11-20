import fs from "node:fs";
import path from "node:path";

/**
 * Dimensions of a local (public-dir) image, for sized `<img>` tags.
 *
 * Ported from the Astro app (`packages/app/src/utils/imageSize.ts`),
 * with one change: the Astro version read dimensions through `sharp`.
 * This version parses the width/height out of the image file's own
 * header (PNG, JPEG, GIF, WebP, BMP, AVIF) instead — no need to
 * load a native library for metadata alone, and the only thing
 * Portosaur ever asked sharp for was the metadata anyway.
 *
 * This runs in server components at build time, never in the browser.
 *
 * Lookup order mirrors the static merge the integration performs:
 * the project's `static/` first (user files win), then the theme
 * defaults (`portoPaths.static`), then the generated-asset staging
 * dir (`.portosaur/static`).
 *
 * Remote URLs, data URIs, and files that don't exist or can't be
 * sized (e.g. an SVG without dimensions) return `null` — callers
 * fall back to a plain `<img>` for those.
 */

export interface LocalImageDimensions {
  width: number;
  height: number;
}

const REMOTE_OR_SPECIAL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i;

/** Bytes read from the head of a file — enough for every header below. */
const HEADER_BYTES = 65536;

function readHeader(file: string): Buffer | null {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const buffer = Buffer.alloc(HEADER_BYTES);
      const read = fs.readSync(fd, buffer, 0, HEADER_BYTES, 0);
      return buffer.subarray(0, read);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

/** PNG: width/height are the first 8 bytes of the IHDR chunk. */
function pngDimensions(header: Buffer): LocalImageDimensions | null {
  if (header.length < 24) {
    return null;
  }
  if (header.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  const width = header.readUInt32BE(16);
  const height = header.readUInt32BE(20);
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

/** GIF: width/height are little-endian uint16s at bytes 6 and 8. */
function gifDimensions(header: Buffer): LocalImageDimensions | null {
  if (header.length < 10) {
    return null;
  }
  const width = header.readUInt16LE(6);
  const height = header.readUInt16LE(8);
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

/** BMP: width/height are int32s at bytes 18 and 22 of the DIB header. */
function bmpDimensions(header: Buffer): LocalImageDimensions | null {
  if (header.length < 26) {
    return null;
  }
  const width = header.readInt32LE(18);
  const height = Math.abs(header.readInt32LE(22));
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

/**
 * JPEG: walk the marker segments until a Start Of Frame marker
 * (0xC0–0xCF except 0xC4, 0xC8, 0xCC) — its payload holds the height
 * then the width as big-endian uint16s.
 */
function jpegDimensions(header: Buffer): LocalImageDimensions | null {
  let offset = 2;
  while (offset + 9 < header.length) {
    if (header[offset] !== 0xff) {
      return null;
    }
    const marker = header[offset + 1];
    if (marker === 0xd8 || marker === 0x01) {
      // SOI / TEM — no payload, keep walking.
      offset += 2;
      continue;
    }
    if (marker >= 0xd0 && marker <= 0xd9) {
      // RSTn / SOS / EOI — no length field (SOS ends the headers).
      return null;
    }
    const length = header.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > header.length) {
      return null;
    }
    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isSof) {
      const height = header.readUInt16BE(offset + 5);
      const width = header.readUInt16BE(offset + 7);
      if (width > 0 && height > 0) {
        return { width, height };
      }
      return null;
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * WebP: three chunk layouts. VP8X stores width/height minus one as
 * 24-bit little-endian at bytes 24/27. Lossy VP8 stores them as
 * 14-bit little-endian at bytes 26/28. Lossless VP8L packs them into
 * 14-bit fields starting at byte 21.
 */
function webpDimensions(header: Buffer): LocalImageDimensions | null {
  if (header.length < 30) {
    return null;
  }
  const chunk = header.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const width = header.readUIntLE(24, 3) + 1;
    const height = header.readUIntLE(27, 3) + 1;
    return { width, height };
  }
  if (chunk === "VP8 ") {
    const width = header.readUInt16LE(26) & 0x3fff;
    const height = header.readUInt16LE(28) & 0x3fff;
    if (width > 0 && height > 0) {
      return { width, height };
    }
    return null;
  }
  if (chunk === "VP8L") {
    const packed = header.readUInt32LE(21);
    const width = (packed & 0x3fff) + 1;
    const height = ((packed >> 14) & 0x3fff) + 1;
    if (width > 0 && height > 0) {
      return { width, height };
    }
    return null;
  }
  return null;
}

/**
 * AVIF: walk the top-level boxes to `meta`, then its children to the
 * `ispe` box, which holds width/height as big-endian uint32s.
 */
function avifDimensions(header: Buffer): LocalImageDimensions | null {
  let offset = 0;
  while (offset + 8 <= header.length) {
    const size = header.readUInt32BE(offset);
    const type = header.toString("ascii", offset + 4, offset + 8);
    if (size < 8 || offset + size > header.length) {
      return null;
    }
    if (type === "meta") {
      // The meta box has 4 version/flags bytes before its children.
      let child = offset + 12;
      const end = offset + size;
      while (child + 8 <= end && child + 8 <= header.length) {
        const childSize = header.readUInt32BE(child);
        const childType = header.toString("ascii", child + 4, child + 8);
        if (childSize < 8 || child + childSize > end) {
          return null;
        }
        if (childType === "ispe" && childSize >= 20) {
          const width = header.readUInt32BE(child + 12);
          const height = header.readUInt32BE(child + 16);
          if (width > 0 && height > 0) {
            return { width, height };
          }
          return null;
        }
        child += childSize;
      }
      return null;
    }
    offset += size;
  }
  return null;
}

/** Dispatches on the file's magic bytes. */
function dimensionsFromHeader(header: Buffer): LocalImageDimensions | null {
  if (header.length < 12) {
    return null;
  }
  // PNG signature.
  if (
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47
  ) {
    return pngDimensions(header);
  }
  // JPEG SOI.
  if (header[0] === 0xff && header[1] === 0xd8) {
    return jpegDimensions(header);
  }
  // GIF87a / GIF89a.
  if (header.toString("ascii", 0, 6).startsWith("GIF8")) {
    return gifDimensions(header);
  }
  // RIFF....WEBP.
  if (
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP"
  ) {
    return webpDimensions(header);
  }
  // BMP.
  if (header[0] === 0x42 && header[1] === 0x4d) {
    return bmpDimensions(header);
  }
  // ftyp....avif / avis.
  if (header.toString("ascii", 4, 8) === "ftyp") {
    const brand = header.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") {
      return avifDimensions(header);
    }
  }
  return null;
}

export async function localImageDimensions(
  src: string,
  staticDirs: string[],
): Promise<LocalImageDimensions | null> {
  if (!src || REMOTE_OR_SPECIAL_RE.test(src)) {
    return null;
  }
  // Config paths are static-root-relative (`img/icon.png`). Absolute
  // site-root paths (`/avatars/x.png`) resolve the same way.
  const relative = src.replace(/^\/+/, "");
  for (const dir of staticDirs) {
    if (!dir) {
      continue;
    }
    const file = path.join(dir, relative);
    if (!fs.existsSync(file)) {
      continue;
    }
    const header = readHeader(file);
    if (!header) {
      continue;
    }
    const dimensions = dimensionsFromHeader(header);
    if (dimensions) {
      return dimensions;
    }
    // Not an image this parser can size — try the next static dir,
    // else the caller falls back to a plain <img>.
  }
  return null;
}

/** The static directories a configured image path can resolve against. */
export function staticDirsForConfig(config: {
  projectDir?: string;
  portoPaths?: { static?: string };
}): string[] {
  const dirs: string[] = [];
  if (config.projectDir) {
    dirs.push(path.join(config.projectDir, "static"));
  }
  if (config.portoPaths?.static) {
    dirs.push(config.portoPaths.static);
  }
  if (config.projectDir) {
    dirs.push(path.join(config.projectDir, ".portosaur", "static"));
  }
  return dirs;
}
