import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import fs from "fs";
import path from "path";
import { getCssVar } from "../src/index.mjs";

describe("getCssVar", () => {
  const tmpDir = path.resolve(__dirname, "tmp-css-test");
  const file1 = path.join(tmpDir, "file1.css");
  const file2 = path.join(tmpDir, "file2.css");
  const file3 = path.join(tmpDir, "file3.css");

  beforeAll(() => {
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Direct variable
    fs.writeFileSync(file1, `
      :root {
        --foo-color: #ff0000;
        --spacing: 8px !important;
      }
    `);

    // Nested variable mapping
    fs.writeFileSync(file2, `
      :root {
        --primary-color: var(--foo-color);
        --background: var(--non-existent, #ffffff);
      }
    `);

    // Override cascade
    fs.writeFileSync(file3, `
      :root {
        --foo-color: #00ff00;
      }
    `);
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("should resolve basic css variables", () => {
    const val = getCssVar("--spacing", [file1]);
    expect(val).toBe("8px");
  });

  test("should return null for non-existent variable", () => {
    const val = getCssVar("--not-here", [file1]);
    expect(val).toBeNull();
  });

  test("should resolve recursively nested variables across multiple files", () => {
    const val = getCssVar("--primary-color", [file2, file1]);
    expect(val).toBe("#ff0000");
  });

  test("should obey the cascade order of file resolution", () => {
    // In CSS cascade, later files override earlier values
    // Here we pass file3 first, then file1. The extractor parses files in the order they are passed,
    // returning the first value it resolves. So we pass them in reverse-cascade order to prioritize overrides.
    const val1 = getCssVar("--foo-color", [file3, file1]);
    expect(val1).toBe("#00ff00");

    const val2 = getCssVar("--foo-color", [file1, file3]);
    expect(val2).toBe("#ff0000");
  });
});
