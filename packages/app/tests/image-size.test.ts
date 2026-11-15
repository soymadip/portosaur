import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { localImageDimensions } from "../src/lib/image-size.ts";

// Fixtures are generated here (minimal valid headers — the parser
// only reads the width/height fields), written to a temp static
// dir, and cleaned up afterwards.

let staticDir: string;

function pngFixture(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt8(0x89, 0);
  buffer.write("PNG\r\n\x1a\n", 1, "ascii");
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

function gifFixture(width: number, height: number): Buffer {
  // 13 bytes: the 6-byte signature, width/height, then the packed
  // field + background + aspect bytes of a real header. (The
  // dispatch gate needs at least 12 bytes before it looks.)
  const buffer = Buffer.alloc(13);
  buffer.write("GIF89a", 0, "ascii");
  buffer.writeUInt16LE(width, 6);
  buffer.writeUInt16LE(height, 8);
  return buffer;
}

function jpegFixture(width: number, height: number): Buffer {
  // SOI + APP0 (length 16) + SOF0 (length 17, precision 8,
  // height then width as big-endian uint16s). The buffer must
  // cover the whole SOF0 segment (ends at byte 39) — the parser
  // rejects a segment that runs past the header.
  const buffer = Buffer.alloc(48);
  buffer.writeUInt8(0xff, 0);
  buffer.writeUInt8(0xd8, 1);
  buffer.writeUInt8(0xff, 2);
  buffer.writeUInt8(0xe0, 3);
  buffer.writeUInt16BE(16, 4);
  buffer.write("JFIF\0", 6, "ascii");
  buffer.writeUInt8(0xff, 20);
  buffer.writeUInt8(0xc0, 21);
  buffer.writeUInt16BE(17, 22);
  buffer.writeUInt8(8, 24);
  buffer.writeUInt16BE(height, 25);
  buffer.writeUInt16BE(width, 27);
  return buffer;
}

function webpFixture(width: number, height: number): Buffer {
  // RIFF + WEBP + VP8X chunk: width/height minus one as 24-bit
  // little-endian at bytes 24/27.
  const buffer = Buffer.alloc(30);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(22, 4);
  buffer.write("WEBP", 8, "ascii");
  buffer.write("VP8X", 12, "ascii");
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

beforeAll(() => {
  staticDir = fs.mkdtempSync(path.join(os.tmpdir(), "porto-img-test-"));
  fs.writeFileSync(path.join(staticDir, "pic.png"), pngFixture(800, 600));
  fs.writeFileSync(path.join(staticDir, "pic.gif"), gifFixture(320, 240));
  fs.writeFileSync(path.join(staticDir, "pic.jpg"), jpegFixture(1024, 768));
  fs.writeFileSync(path.join(staticDir, "pic.webp"), webpFixture(640, 480));
  fs.writeFileSync(path.join(staticDir, "notes.txt"), "not an image");
});

afterAll(() => {
  fs.rmSync(staticDir, { recursive: true, force: true });
});

describe("localImageDimensions", () => {
  test("reads PNG dimensions from the IHDR chunk", async () => {
    expect(await localImageDimensions("/pic.png", [staticDir])).toEqual({
      width: 800,
      height: 600,
    });
  });

  test("reads GIF dimensions", async () => {
    expect(await localImageDimensions("/pic.gif", [staticDir])).toEqual({
      width: 320,
      height: 240,
    });
  });

  test("reads JPEG dimensions from the SOF0 marker", async () => {
    expect(await localImageDimensions("/pic.jpg", [staticDir])).toEqual({
      width: 1024,
      height: 768,
    });
  });

  test("reads WebP VP8X dimensions", async () => {
    expect(await localImageDimensions("/pic.webp", [staticDir])).toEqual({
      width: 640,
      height: 480,
    });
  });

  test("returns null for remote URLs, data URIs and missing files", async () => {
    expect(
      await localImageDimensions("https://example.com/pic.png", [staticDir]),
    ).toBeNull();
    expect(
      await localImageDimensions("data:image/png;base64,AAAA", [staticDir]),
    ).toBeNull();
    expect(await localImageDimensions("/nope.png", [staticDir])).toBeNull();
  });

  test("returns null for files that cannot be sized", async () => {
    expect(await localImageDimensions("/notes.txt", [staticDir])).toBeNull();
  });
});
