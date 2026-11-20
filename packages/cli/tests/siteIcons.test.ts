import { expect, test, describe } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { generateSiteIcons } from "../src/engine/utils/siteIcons.ts";
import type { PortosaurOptions } from "../src/engine/generators/siteConfig.ts";

/** Minimal options — the icon scan only reads the fields listed here. */
function options(overrides: Record<string, any> = {}): PortosaurOptions {
  return {
    site: {
      url: "https://example.com",
      baseUrl: "/",
      title: "Test Site",
      tagline: "A test tagline",
      notesDir: "docs",
      blogDir: "blog",
      ...(overrides.site ?? {}),
    },
    siteMode: overrides.siteMode ?? "docs",
  } as PortosaurOptions;
}

const coreRoot = path.resolve(import.meta.dirname, "../../core");

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  success: () => {},
};

describe("generateSiteIcons", () => {
  test("writes the generated module from the site's content", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-site-icons-"));
    try {
      const contentDir = path.join(root, "docs");
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(
        path.join(contentDir, "guide.md"),
        `---\ntitle: Guide\nicon: md:home\n---\n\nBody.\n`,
      );
      const nextRoot = path.join(root, ".portosaur");
      fs.mkdirSync(nextRoot, { recursive: true });

      const result = await generateSiteIcons({
        projectDir: root,
        options: options(),
        nextRoot,
        coreRoot,
        logger: silentLogger,
      });
      expect(result.changed).toBe(true);
      expect(result.count).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
      const module = fs.readFileSync(
        path.join(nextRoot, "site-icons.ts"),
        "utf-8",
      );
      expect(module).toContain("export const siteIcons: SiteIcons = {");
      expect(module).toContain('"mdi:home"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("surfaces unknown ids as warnings, not failures", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "porto-site-icons-"));
    try {
      const contentDir = path.join(root, "docs");
      fs.mkdirSync(contentDir, { recursive: true });
      fs.writeFileSync(
        path.join(contentDir, "bad.md"),
        `---\ntitle: Bad\nicon: md:definitely-not-an-icon\n---\n\nBody.\n`,
      );
      const nextRoot = path.join(root, ".portosaur");
      fs.mkdirSync(nextRoot, { recursive: true });
      const warnings: string[] = [];
      const result = await generateSiteIcons({
        projectDir: root,
        options: options(),
        nextRoot,
        coreRoot,
        logger: {
          ...silentLogger,
          warn: (message: string) => {
            warnings.push(message);
          },
        },
      });
      expect(result.changed).toBe(true);
      expect(warnings).toContain(
        "[Icons] Icon not found: md:definitely-not-an-icon",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
