import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  collectSiteIcons,
  generateSiteIcons,
  renderSiteIconsModule,
} from "../src/lib/icon-scan.ts";

const coreRoot = path.resolve(import.meta.dirname, "..");

/** A tiny fixture site: content with icons + a config file. */
function fixtureSite(): { projectDir: string; contentDir: string } {
  const projectDir = mkdtempSync(path.join(tmpdir(), "porto-icons-"));
  const contentDir = path.join(projectDir, "docs");
  fs.mkdirSync(path.join(contentDir, "1 - python"), { recursive: true });
  fs.writeFileSync(
    path.join(contentDir, "1 - python", "guide.md"),
    `---
title: Python Guide
icon: md:home
---

A shortcode :si:react: in prose.

<Btn icon="md:settings">Go</Btn>

<DynamicIcon slug="kotlin" />

<DynamicIcon slug="arduino" />

\`\`\`yaml
# A code sample — never scanned.
icon: md:not-real
\`\`\`
`,
  );
  fs.writeFileSync(
    path.join(contentDir, "bad.md"),
    `---
title: Bad Icons
icon: md:definitely-not-an-icon
---

<Icon id="notanicon" />
`,
  );
  fs.writeFileSync(
    path.join(projectDir, "porto.yml"),
    `site:
  title: Test
docsHome:
  features:
    - title: Books
      icon: md:book
home_page:
  social:
    links:
      - name: LinkedIn
        url: https://linkedin.com/in/test
`,
  );
  return { projectDir, contentDir };
}

describe("collectSiteIcons", () => {
  test("collects frontmatter, props, shortcodes, slugs, and config icons", () => {
    const { projectDir, contentDir } = fixtureSite();
    try {
      const { icons, warnings } = collectSiteIcons({
        projectDir,
        contentDirs: [contentDir],
        configFile: path.join(projectDir, "porto.yml"),
        coreRoot,
      });
      // Frontmatter `icon:`, the shortcode, the Btn prop.
      expect(icons.has("mdi:home")).toBe(true);
      expect(icons.has("simple-icons:react")).toBe(true);
      expect(icons.has("mdi:settings")).toBe(true);
      // The `1 - python` dir slug guesses the Python icon, the
      // kotlin slug guesses from techMap, and the arduino slug
      // guesses devicon (arduino is not in techMap).
      expect(icons.has("simple-icons:python")).toBe(true);
      expect(icons.has("simple-icons:kotlin")).toBe(true);
      expect(icons.has("devicon:arduino")).toBe(true);
      // The config feature icon.
      expect(icons.has("mdi:book")).toBe(true);
      // A config list-item `name:` guesses its icon from the
      // techmap, so a social link needs no explicit `icon:`.
      expect(icons.has("mdi:linkedin")).toBe(true);
      // The fixed icons the core's own pages render.
      expect(icons.has("mdi:folder")).toBe(true);
      expect(icons.has("mdi:notebook")).toBe(true);
      // The code sample's icon is never scanned.
      expect(icons.has("mdi:not-real")).toBe(false);
      // Unknown and malformed ids warn once each.
      expect(warnings).toContain(
        "[Icons] Icon not found: md:definitely-not-an-icon",
      );
      expect(warnings).toContain("[Icons] Malformed icon id: notanicon");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("an icon entry carries the pack's viewBox and body", () => {
    const { projectDir, contentDir } = fixtureSite();
    try {
      const { icons } = collectSiteIcons({
        projectDir,
        contentDirs: [contentDir],
        coreRoot,
      });
      const home = icons.get("mdi:home");
      expect(home).toBeDefined();
      expect(home?.viewBox).toBe("0 0 24 24");
      expect(home?.body).toContain("<path");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("collects icon ids containing digits", () => {
    // Digits carry the Emoji property, so a bare contains-check
    // skipped ids like `lu:maximize-2` as emoji, silently.
    const { projectDir, contentDir } = fixtureSite();
    try {
      fs.writeFileSync(
        path.join(contentDir, "digits.md"),
        `---\ntitle: Digits\nicon: lu:maximize-2\n---\n`,
      );
      const { icons, warnings } = collectSiteIcons({
        projectDir,
        contentDirs: [contentDir],
        coreRoot,
      });
      expect(icons.has("lucide:maximize-2")).toBe(true);
      expect(warnings).not.toContain("[Icons] Icon not found: lu:maximize-2");
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });

  test("collects file-tree auto icons from fences and JSX names", () => {
    const { projectDir, contentDir } = fixtureSite();
    try {
      fs.writeFileSync(
        path.join(contentDir, "tree.md"),
        [
          "---",
          "title: Tree",
          "---",
          "",
          "```files",
          "project",
          "├── src",
          "│   └── index.ts",
          "├── package.json",
          "```",
          "",
          "<FileTree>",
          '  <File name="photo.png" />',
          "</FileTree>",
          "",
        ].join("\n"),
      );
      const { icons } = collectSiteIcons({
        projectDir,
        contentDirs: [contentDir],
        coreRoot,
      });
      // The fence's folder, file, and special name.
      expect(icons.has("lucide:folder-code")).toBe(true);
      expect(icons.has("simple-icons:typescript")).toBe(true);
      expect(icons.has("simple-icons:npm")).toBe(true);
      // The JSX File's extension.
      expect(icons.has("lucide:file-image")).toBe(true);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("renderSiteIconsModule", () => {
  test("emits a typed module with sorted entries", () => {
    const { projectDir, contentDir } = fixtureSite();
    try {
      const { icons } = collectSiteIcons({
        projectDir,
        contentDirs: [contentDir],
        coreRoot,
      });
      const module = renderSiteIconsModule(icons);
      expect(module).toContain(
        'import type { SiteIcons } from "@portosaur/core/lib/site-icons";',
      );
      expect(module).toContain("export const siteIcons: SiteIcons = {");
      expect(module).toContain('"mdi:home": { viewBox: "0 0 24 24"');
      const homeIndex = module.indexOf('"mdi:home"');
      const pythonIndex = module.indexOf('"simple-icons:python"');
      expect(homeIndex).toBeLessThan(pythonIndex);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

describe("generateSiteIcons", () => {
  test("writes the module, and rewrites only when it changed", () => {
    const { projectDir, contentDir } = fixtureSite();
    try {
      const outFile = path.join(projectDir, ".portosaur", "site-icons.ts");
      const spec = {
        projectDir,
        contentDirs: [contentDir],
        configFile: path.join(projectDir, "porto.yml"),
        coreRoot,
        outFile,
      };
      const first = generateSiteIcons(spec);
      expect(first.changed).toBe(true);
      expect(first.count).toBeGreaterThan(0);
      expect(fs.existsSync(outFile)).toBe(true);
      const mtime = fs.statSync(outFile).mtimeMs;
      const second = generateSiteIcons(spec);
      expect(second.changed).toBe(false);
      expect(fs.statSync(outFile).mtimeMs).toBe(mtime);
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  });
});
