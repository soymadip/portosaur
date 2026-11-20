// Minimal PNG read/write for the favicon tests — no image dependency.
// The CLI must not depend on sharp (it lives in @portosaur/core), so
// the tests make their own fixtures and read dimensions/pixels here.
//
// Writer: solid-color RGBA, color type 6, bit depth 8, one filter-0
// row per scanline. Reader: color types 6 (RGBA) and 2 (RGB), bit
// depth 8, non-interlaced, all five row filters. Enough for what
// sharp writes and what these tests assert.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])));
  crc.copy(out, 8 + data.length);
  return out;
}

/** Write a solid-color RGBA PNG. */
export function writeSolidPng(
  file: string,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const row = Buffer.alloc(1 + width * 4);
  for (let x = 0; x < width; x++) {
    row[1 + x * 4] = r;
    row[1 + x * 4 + 1] = g;
    row[1 + x * 4 + 2] = b;
    row[1 + x * 4 + 3] = a;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
}

/** Read a PNG's dimensions from its IHDR chunk. */
export function readPngSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

export interface DecodedPng {
  width: number;
  height: number;
  /** RGBA bytes, row-major. */
  data: Buffer;
}

/** Decode a non-interlaced 8-bit RGB/RGBA PNG into raw pixels. */
export function readPngPixels(file: string): DecodedPng {
  const buf = fs.readFileSync(file);
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(
      `Unsupported PNG in test helper: bit depth ${bitDepth}, color type ${colorType}`,
    );
  }
  const channels = colorType === 6 ? 4 : 3;
  const idat: Buffer[] = [];
  let offset = 8;
  while (offset < buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      idat.push(buf.subarray(offset + 8, offset + 8 + length));
    }
    if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const data = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const left = i >= channels ? out[i - channels] : 0;
      const up = prev[i];
      const upLeft = i >= channels ? prev[i - channels] : 0;
      let predict = 0;
      if (filter === 1) {
        predict = left;
      } else if (filter === 2) {
        predict = up;
      } else if (filter === 3) {
        predict = Math.floor((left + up) / 2);
      } else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predict = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      out[i] = (row[i] + predict) & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4;
      const si = x * channels;
      data[di] = out[si];
      data[di + 1] = out[si + 1];
      data[di + 2] = out[si + 2];
      data[di + 3] = channels === 4 ? out[si + 3] : 255;
    }
    prev = out;
  }
  return { width, height, data };
}
