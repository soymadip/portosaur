import { describe, test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";

/**
 * Theming contract: tokens live directly in Tailwind's `@theme` in
 * `tokens.css` (short names: `--color-surface`, `--font-body`,
 * `--radius-card`, ...), with the same values repeated in a plain
 * `:root` fallback block; six color schemes, each defining the same
 * `--color-*` set in light and dark mode, scoped to
 * `[data-scheme][data-theme]`; no `--porto-*` names survive anywhere
 * (clean break for 1.0.0); no `--ifm-*` survives anywhere.
 *
 * Source-level checks always run. Built-output checks need a docs build
 * (`bun run --cwd docs build`) and skip with a note when `docs/build`
 * is absent, so `bun test` stays runnable without building first.
 */

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const THEME_CSS_DIR = path.join(REPO_ROOT, "packages/app/src/css");
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

// The new live token set (45): every name `@theme` (and the `:root`
// fallback block) must define.
const NEW_TOKENS = [
  "--color-primary",
  "--color-primary-dark",
  "--color-primary-darker",
  "--color-primary-light",
  "--color-success",
  "--color-warning",
  "--color-danger",
  "--color-info",
  "--color-secondary",
  "--color-red",
  "--color-orange",
  "--color-yellow",
  "--color-green",
  "--color-teal",
  "--color-blue",
  "--color-purple",
  "--color-pink",
  "--color-background",
  "--color-background-alt",
  "--color-surface",
  "--color-surface-1",
  "--color-surface-2",
  "--color-hover-overlay",
  "--color-foreground",
  "--color-muted",
  "--color-border",
  "--color-gray-100",
  "--color-gray-200",
  "--color-gray-300",
  "--color-gray-400",
  "--color-gray-500",
  "--color-gray-600",
  "--color-gray-700",
  "--color-gray-800",
  "--font-body",
  "--font-markdown",
  "--radius-card",
  "--shadow-sm",
  "--shadow-md",
  "--shadow-lg",
  "--navbar-height",
  "--navbar-shadow",
  "--scroll-margin-top",
  "--pre-padding",
  "--line-height",
];

// Matches `[data-scheme="x"][data-theme="y"] { ... }` in source and the
// minified `[data-scheme=x][data-theme=y]{...}` form in built CSS.
const BLOCK_RE =
  /\[data-scheme="?([^"\]]+)"?\]\[data-theme="?(\w+)"?\]\s*\{([^}]*)\}/g;
// Token *definitions* only — `var(--color-x)` references inside values
// don't count as defining the token.
const COLOR_DEF_RE = /(--color-[a-z0-9-]+)\s*:/g;

/**
 * Extracts scheme blocks from CSS text: `"scheme:mode" -> Set` of the
 * `--color-*` tokens the block defines.
 */
function schemeBlocks(css: string): Map<string, Set<string>> {
  const blocks = new Map<string, Set<string>>();
  for (const [, scheme, mode, body] of css.matchAll(BLOCK_RE)) {
    const tokens = new Set(
      [...body.matchAll(COLOR_DEF_RE)].map((m) => m[1]),
    );
    blocks.set(`${scheme}:${mode}`, tokens);
  }
  return blocks;
}

function collectFiles(dir: string, ext: string, out: string[] = []): string[] {
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

  test("custom.css imports tokens and all six scheme files", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    expect(entry).toContain('@import "./tokens.css"');
    for (const scheme of SCHEMES) {
      expect(entry).toContain(`@import "./themes/${scheme}.css"`);
    }
  });

  test("custom.css imports no deleted CSS file", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    for (const deleted of [
      "empty-state.css",
      "overrides/navbar.css",
      "overrides/footer.css",
      "overrides/search.css",
      "overrides/pagination.css",
    ]) {
      expect(entry).not.toContain(deleted);
    }
  });

  test("custom.css defines the data-theme dark variant", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    expect(entry).toContain("@custom-variant dark");
    expect(entry).toContain('[data-theme="dark"]');
  });

  test("@theme defines every new token", () => {
    const tokens = fs.readFileSync(
      path.join(THEME_CSS_DIR, "tokens.css"),
      "utf8",
    );
    const themeBlock = tokens.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(NEW_TOKENS.length).toBe(45);
    for (const token of NEW_TOKENS) {
      expect(themeBlock).toContain(`${token}:`);
    }
  });

  test(":root fallback block defines the same token set as @theme", () => {
    const tokens = fs.readFileSync(
      path.join(THEME_CSS_DIR, "tokens.css"),
      "utf8",
    );
    // The last `:root { ... }` block is the fallback block (the file has
    // no other :root block).
    const rootBlocks = [...tokens.matchAll(/:root\s*\{([\s\S]*?)\n\}/g)];
    expect(rootBlocks.length).toBe(1);
    const rootBlock = rootBlocks[0][1];
    for (const token of NEW_TOKENS) {
      expect(rootBlock).toContain(`${token}:`);
    }
  });

  test("every scheme defines the same color set in light and dark", () => {
    let reference: Set<string> | null = null;
    for (const scheme of SCHEMES) {
      const css = fs.readFileSync(
        path.join(THEMES_DIR, `${scheme}.css`),
        "utf8",
      );
      const blocks = schemeBlocks(css);
      for (const mode of MODES) {
        expect(blocks.has(`${scheme}:${mode}`)).toBe(true);
      }
      // The `has` assertions above fail the test if a block is missing,
      // so these lookups cannot be undefined here.
      const light = blocks.get(`${scheme}:light`)!;
      const dark = blocks.get(`${scheme}:dark`)!;
      expect([...light].sort()).toEqual([...dark].sort());
      // The core tokens the layout and components rely on.
      for (const token of [
        "--color-background",
        "--color-primary",
        "--color-foreground",
      ]) {
        expect(light.has(token)).toBe(true);
      }
      if (reference === null) {
        reference = light;
      } else {
        expect([...light].sort()).toEqual([...reference].sort());
      }
    }
  });

  test("scheme files use no -rgb triplets", () => {
    for (const scheme of SCHEMES) {
      // The header comment mentions "-rgb triplets" (as removed) —
      // strip comments before checking.
      const css = fs
        .readFileSync(path.join(THEMES_DIR, `${scheme}.css`), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "");
      expect(css).not.toContain("-rgb");
    }
  });

  test("custom scheme template exists and is a valid minimal scheme", () => {
    const templatePath = path.join(
      THEMES_DIR,
      "custom-scheme.template.css",
    );
    expect(fs.existsSync(templatePath)).toBe(true);
    const template = fs.readFileSync(templatePath, "utf8");
    // Plain [data-theme] blocks (no data-scheme scoping — while a custom
    // scheme is active, data-scheme holds the path, so no bundled block
    // matches and these win).
    expect(template).toContain('[data-theme="light"]');
    expect(template).toContain('[data-theme="dark"]');
    expect(template).not.toContain("[data-scheme=");
    for (const token of [
      "--color-background",
      "--color-primary",
      "--color-foreground",
    ]) {
      expect(template).toContain(`${token}:`);
    }
    // The template must stay small — the whole point of the rebuild.
    expect(template.split("\n").length).toBeLessThan(80);
  });

  test("Search component is a vanilla porto-search element with no --porto-*", () => {
    const search = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "packages/app/src/components/Search.astro",
      ),
      "utf8",
    );
    expect(search).not.toContain("--porto-");
    expect(search).toContain("<porto-search");
    expect(search).toContain("PagefindUI");
    expect(search).not.toContain("preact");
  });

  test("no --porto-* in theme source CSS", () => {
    for (const file of collectFiles(THEME_CSS_DIR, ".css")) {
      const css = fs.readFileSync(file, "utf8");
      expect(css).not.toContain("--porto-");
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
          expect(blocks.get(`${scheme}:${mode}`)!.size).toBeGreaterThan(0);
        }
      }
    });

    builtTest("built CSS emits the new tokens", () => {
      const css = builtCss();
      expect(css).toContain("--color-primary:");
      expect(css).toContain("--color-background:");
      expect(css).toContain("--color-foreground:");
    });

    builtTest("built CSS contains no --porto-*", () => {
      expect(builtCss()).not.toContain("--porto-");
    });

    builtTest("built CSS contains no --ifm-* or --docusaurus-*", () => {
      const css = builtCss();
      expect(css).not.toContain("--ifm-");
      expect(css).not.toContain("--docusaurus-");
    });

    builtTest("docs page renders the search button", () => {
      const html = fs.readFileSync(
        path.join(DOCS_BUILD_DIR, "docs/index.html"),
        "utf8",
      );
      expect(html).toContain("<porto-search");
      expect(html).toContain("data-open-modal");
    });

    builtTest("home has no search button", () => {
      const html = fs.readFileSync(
        path.join(DOCS_BUILD_DIR, "index.html"),
        "utf8",
      );
      expect(html).not.toContain("<porto-search");
      expect(html).not.toContain("data-open-modal");
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
