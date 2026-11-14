import { describe, test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Theming contract (Phase 3, §4.5): six color schemes, each defining the
 * same `--porto-*` token set in light and dark mode, scoped to
 * `[data-scheme][data-theme]`; no `--ifm-*` survives anywhere.
 *
 * Source-level checks always run. Built-output checks need a docs build
 * (`bun run --cwd docs build`) and skip with a note when `docs/build`
 * is absent, so `bun test` stays runnable without building first.
 */

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const THEME_CSS_DIR = path.join(REPO_ROOT, "packages/theme/src/css");
const THEMES_DIR = path.join(THEME_CSS_DIR, "themes");
const DOCS_BUILD_DIR = path.join(REPO_ROOT, "docs/build");

const SCHEMES = [
  "catppuccin",
  "dracula",
  "github",
  "gruvbox",
  "nord",
  "portosaur",
];
const MODES = ["light", "dark"];

// Matches `[data-scheme="x"][data-theme="y"] { ... }` in source and the
// minified `[data-scheme=x][data-theme=y]{...}` form in built CSS.
const BLOCK_RE =
  /\[data-scheme="?([^"\]]+)"?\]\[data-theme="?(\w+)"?\]\s*\{([^}]*)\}/g;
// Token *definitions* only — `var(--porto-x)` references inside values
// don't count as defining the token.
const TOKEN_DEF_RE = /(--porto-[a-z0-9-]+)\s*:/g;

/**
 * Extracts scheme blocks from CSS text: `"scheme:mode" -> Set` of the
 * `--porto-*` tokens the block defines.
 */
function schemeBlocks(css) {
  const blocks = new Map();
  for (const [, scheme, mode, body] of css.matchAll(BLOCK_RE)) {
    const tokens = new Set(
      [...body.matchAll(TOKEN_DEF_RE)].map((m) => m[1]),
    );
    blocks.set(`${scheme}:${mode}`, tokens);
  }
  return blocks;
}

function collectFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, ext, out);
    } else if (entry.name.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

describe("theming", () => {
  test("all six scheme files exist", () => {
    for (const scheme of SCHEMES) {
      expect(fs.existsSync(path.join(THEMES_DIR, `${scheme}.css`))).toBe(
        true,
      );
    }
  });

  test("custom.css imports all six scheme files", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    for (const scheme of SCHEMES) {
      expect(entry).toContain(`@import "./themes/${scheme}.css"`);
    }
  });

  test("every scheme defines the same token set in light and dark", () => {
    let reference = null;
    for (const scheme of SCHEMES) {
      const css = fs.readFileSync(
        path.join(THEMES_DIR, `${scheme}.css`),
        "utf8",
      );
      const blocks = schemeBlocks(css);
      for (const mode of MODES) {
        expect(blocks.has(`${scheme}:${mode}`)).toBe(true);
      }
      const light = blocks.get(`${scheme}:light`);
      const dark = blocks.get(`${scheme}:dark`);
      expect([...light].sort()).toEqual([...dark].sort());
      // The core tokens the layout and components rely on.
      for (const token of ["--porto-bg", "--porto-primary", "--porto-text"]) {
        expect(light.has(token)).toBe(true);
      }
      if (reference === null) {
        reference = light;
      } else {
        expect([...light].sort()).toEqual([...reference].sort());
      }
    }
  });

  test("no --ifm-* or --docusaurus-* in theme source CSS", () => {
    for (const file of collectFiles(THEME_CSS_DIR, ".css")) {
      const css = fs.readFileSync(file, "utf8");
      expect(css).not.toContain("--ifm-");
      expect(css).not.toContain("--docusaurus-");
    }
  });

  test("theme CSS uses no @apply and no @tailwindcss/typography", () => {
    for (const file of collectFiles(THEME_CSS_DIR, ".css")) {
      // Comments may name the things this forbids ("Deliberately not
      // `@tailwindcss/typography`") — strip them before checking.
      const css = fs
        .readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(css).not.toContain("@apply");
      expect(css).not.toContain("@tailwindcss/typography");
    }
  });

  describe("built output", () => {
    const hasDocsBuild = fs.existsSync(
      path.join(DOCS_BUILD_DIR, "index.html"),
    );
    if (!hasDocsBuild) {
      console.warn(
        "theming: docs/build missing — run `bun run --cwd docs build` to enable built-output checks",
      );
    }
    // `bun test` must stay green without a prior build; the built
    // checks run (and must pass) whenever the build exists.
    const builtTest = hasDocsBuild ? test : test.skip;

    const builtCss = () =>
      collectFiles(DOCS_BUILD_DIR, ".css")
        .map((file) => fs.readFileSync(file, "utf8"))
        .join("\n");

    builtTest("built CSS contains all 12 scheme blocks", () => {
      const blocks = schemeBlocks(builtCss());
      for (const scheme of SCHEMES) {
        for (const mode of MODES) {
          expect(blocks.has(`${scheme}:${mode}`)).toBe(true);
          expect(blocks.get(`${scheme}:${mode}`).size).toBeGreaterThan(0);
        }
      }
    });

    builtTest("built CSS contains no --ifm-* or --docusaurus-*", () => {
      const css = builtCss();
      expect(css).not.toContain("--ifm-");
      expect(css).not.toContain("--docusaurus-");
    });

    builtTest("docs home renders data-scheme and data-theme on <html>", () => {
      const html = fs.readFileSync(
        path.join(DOCS_BUILD_DIR, "index.html"),
        "utf8",
      );
      const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
      expect(htmlTag).toContain('data-scheme="portosaur"');
      expect(htmlTag).toContain('data-theme="dark"');
    });
  });
});
