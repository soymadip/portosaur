import { describe, test, expect } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { getDefaultColorScheme } from "../packages/cli/src/engine/utils/css.ts";

/**
 * Theming contract (Starlight UI, commits 1–2): styling is plain CSS
 * in Starlight's variable system, copied and integrated into
 * Portosaur's own CSS files in `css/` with every identifier renamed
 * `sl-` → `porto-` (see `packages/app/NOTICE.md`). Base values live
 * in `css/variables.css` (dark on `:root`, light under
 * `:root[data-theme='light']`); seven color schemes override the
 * `--porto-color-*` set in light and dark mode, scoped to
 * `[data-scheme][data-theme]`; no Tailwind anywhere in the theme CSS
 * or any component; no `sl-` / `starlight` identifiers in the copied
 * code (comments may cite Starlight as the source, and the
 * `starlight` *scheme name* is an intentional palette name — see the
 * exclusions documented in the rename test below). The portfolio,
 * blog, and tasks styles (`portfolio.css`, `blog.css`, `tasks.css`)
 * are original Portosaur code in the same design language — Starlight
 * has no UI for those, so they carry no attribution header.
 *
 * Source-level checks always run. Built-output checks need a docs
 * build (`bun run --cwd docs build`) and/or a playground build
 * (`bun run build`) and skip with a note when the build dir is
 * absent, so `bun test` stays runnable without building first.
 */

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const APP_SRC = path.join(REPO_ROOT, "packages/app/src");
const THEME_CSS_DIR = path.join(APP_SRC, "css");
const THEMES_DIR = path.join(THEME_CSS_DIR, "themes");
const DOCS_BUILD_DIR = path.join(REPO_ROOT, "docs/build");
const PLAYGROUND_BUILD_DIR = path.join(REPO_ROOT, ".playground/build");

// The Starlight-derived stylesheets, integrated into Portosaur's own
// CSS files at the `css/` root — there is no vendored `starlight/`
// directory. `variables.css` holds the renamed variable system;
// `code.css` is a new Portosaur file (Shiki frame in Starlight's
// visual language), not a copy.
const INTEGRATED_CSS_FILES = [
  "variables.css",
  "reset.css",
  "content.css",
  "anchor-links.css",
  "asides.css",
  "utilities.css",
  "tabs.css",
  "code.css",
  "page.css",
  "print.css",
];

// Original Portosaur stylesheets in Starlight's design language
// (portfolio home sections + notes, blog pages, tasks page) — NOT
// copied from Starlight, so they carry no attribution header.
const PORTFOLIO_CSS_FILES = ["portfolio.css", "blog.css", "tasks.css"];

const SCHEMES = [
  "catppuccin",
  "dracula",
  "github",
  "gruvbox",
  "nord",
  "portosaur",
  "starlight",
];
const MODES = ["light", "dark"];

// The renamed variable system: a representative set variables.css must
// define (base values, dark on `:root`).
const BASE_VARS = [
  "--porto-color-white",
  "--porto-color-gray-1",
  "--porto-color-gray-6",
  "--porto-color-black",
  "--porto-color-accent-low",
  "--porto-color-accent",
  "--porto-color-accent-high",
  "--porto-color-orange",
  "--porto-color-green",
  "--porto-color-blue",
  "--porto-color-purple",
  "--porto-color-red",
  "--porto-color-bg",
  "--porto-color-text",
  "--porto-color-text-accent",
  "--porto-color-hairline",
  "--porto-text-h1",
  "--porto-text-body",
  "--porto-text-code",
  "--porto-line-height",
  "--porto-font-system",
  "--porto-font-markdown",
  "--porto-nav-height",
  "--porto-sidebar-width",
  "--porto-content-width",
  "--porto-shadow-sm",
  "--porto-shadow-md",
  "--porto-shadow-lg",
];

// Matches `[data-scheme="x"][data-theme="y"] { ... }` in source and the
// minified `[data-scheme=x][data-theme=y]{...}` form in built CSS.
const BLOCK_RE =
  /\[data-scheme="?([^"\]]+)"?\]\[data-theme="?(\w+)"?\]\s*\{([^}]*)\}/g;
// Token *definitions* only — `var(--porto-color-x)` references inside
// values don't count as defining the token.
const COLOR_DEF_RE = /(--porto-color-[a-z0-9-]+)\s*:/g;

/**
 * Extracts scheme blocks from CSS text: `"scheme:mode" -> Set` of the
 * `--porto-color-*` tokens the block defines.
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

/**
 * Strips comments from source text before identifier greps: block
 * comments (`/* ... *\/`, including Astro `{/* ... *\/}`) and full-line
 * `//` comments. Comments may cite Starlight as the source of copied
 * code — the rename rule governs identifiers and shipped strings, not
 * provenance notes. (Only full-line `//` comments are stripped, so
 * `//` inside string literals — URLs, data URIs — survives.)
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
}

// Every .astro file in the app — the no-Tailwind rule covers all of
// them since commit 2 (docs and portfolio alike).
const ALL_ASTRO_FILES = collectFiles(APP_SRC, ".astro");

describe("theming", () => {
  test("all seven scheme files exist", () => {
    for (const scheme of SCHEMES) {
      expect(fs.existsSync(path.join(THEMES_DIR, `${scheme}.css`))).toBe(
        true,
      );
    }
  });

  test("custom.css imports the Starlight system and all seven scheme files", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    for (const file of INTEGRATED_CSS_FILES) {
      expect(entry).toContain(`@import "./${file}"`);
    }
    for (const scheme of SCHEMES) {
      expect(entry).toContain(`@import "./themes/${scheme}.css"`);
    }
  });

  test("custom.css imports the portfolio, blog, and tasks stylesheets", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    for (const file of PORTFOLIO_CSS_FILES) {
      expect(fs.existsSync(path.join(THEME_CSS_DIR, file))).toBe(true);
      expect(entry).toContain(`@import "./${file}"`);
    }
  });

  test("portfolio stylesheets are original Portosaur code, not copies", () => {
    // No attribution header (they are not derived from Starlight),
    // no `sl-` identifiers, and they use the renamed var system.
    for (const file of PORTFOLIO_CSS_FILES) {
      const css = fs.readFileSync(path.join(THEME_CSS_DIR, file), "utf8");
      expect(css).not.toContain("Derived from Starlight (MIT License)");
      expect(stripComments(css)).not.toContain("sl-");
      expect(css).toContain("--porto-color-");
      expect(css).toContain("@layer porto.components");
    }
  });

  test("no vendored css/starlight/ directory", () => {
    // The copied Starlight styles live integrated in Portosaur's own
    // CSS files at the `css/` root — never bulk-vendored as a block.
    expect(fs.existsSync(path.join(THEME_CSS_DIR, "starlight"))).toBe(
      false,
    );
    for (const file of INTEGRATED_CSS_FILES) {
      expect(fs.existsSync(path.join(THEME_CSS_DIR, file))).toBe(true);
    }
  });

  test("custom.css declares the cascade layer order first", () => {
    // The declaration must live in custom.css itself (the build
    // pipeline drops a file whose only content is this statement) and
    // must precede the @imports, so it is the first thing in the
    // bundle — without it, layers sort by first appearance and a
    // component's `@layer porto.components.icon` block would declare
    // `porto.components` before `porto.content`.
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    const declaration =
      "@layer porto.base, porto.reset, porto.core, porto.content, porto.components,";
    expect(entry).toContain(declaration);
    expect(entry).toContain("porto.components.icon, porto.components.aside");
    expect(entry).toContain("porto.utils;");
    expect(entry.indexOf("@layer")).toBeLessThan(entry.indexOf("@import"));
    expect(fs.existsSync(path.join(THEME_CSS_DIR, "layers.css"))).toBe(
      false,
    );
  });

  test("custom.css imports no deleted CSS file", () => {
    const entry = fs.readFileSync(
      path.join(THEME_CSS_DIR, "custom.css"),
      "utf8",
    );
    for (const deleted of [
      "tokens.css",
      "shiki.css",
      "empty-state.css",
      "overrides/navbar.css",
      "overrides/footer.css",
      "overrides/search.css",
      "overrides/pagination.css",
    ]) {
      expect(entry).not.toContain(deleted);
    }
  });

  test("variables.css defines the renamed variable system", () => {
    const props = fs.readFileSync(
      path.join(THEME_CSS_DIR, "variables.css"),
      "utf8",
    );
    for (const token of BASE_VARS) {
      expect(props).toContain(`${token}:`);
    }
    // Light-mode overrides live under :root[data-theme="light"].
    expect(props).toContain(':root[data-theme="light"]');
    // No old short tokens survive in the base values.
    expect(props).not.toContain("--color-primary");
    expect(props).not.toContain("--color-background");
  });

  test("every scheme defines the same color set in light and dark", () => {
    let lightReference: Set<string> | null = null;
    let darkReference: Set<string> | null = null;
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
      // Light mode defines one extra token: --porto-color-gray-7
      // (Starlight's light-only navbar background).
      expect([...light].sort()).toEqual(
        [...dark, "--porto-color-gray-7"].sort(),
      );
      // The core tokens the layout and components rely on.
      for (const token of [
        "--porto-color-bg",
        "--porto-color-accent",
        "--porto-color-white",
        "--porto-color-black",
      ]) {
        expect(light.has(token)).toBe(true);
        expect(dark.has(token)).toBe(true);
      }
      if (lightReference === null || darkReference === null) {
        lightReference = light;
        darkReference = dark;
      } else {
        expect([...light].sort()).toEqual([...lightReference].sort());
        expect([...dark].sort()).toEqual([...darkReference].sort());
      }
    }
  });

  test("scheme files use no -rgb triplets", () => {
    for (const scheme of SCHEMES) {
      // Header comments may mention "-rgb triplets" (as removed) —
      // strip comments before checking.
      const css = stripComments(
        fs.readFileSync(path.join(THEMES_DIR, `${scheme}.css`), "utf8"),
      );
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
    for (const token of ["--porto-color-bg", "--porto-color-accent"]) {
      expect(template).toContain(`${token}:`);
    }
    // The template must stay small — the whole point of the rebuild.
    expect(template.split("\n").length).toBeLessThan(80);
  });

  test("getDefaultColorScheme returns starlight for docs and portfolio", () => {
    // Starlight's palette is the default for now (comparison against
    // real Starlight); the user will make portosaur the default later.
    expect(getDefaultColorScheme({ siteMode: "docs" })).toBe("starlight");
    expect(getDefaultColorScheme({ siteMode: "portfolio" })).toBe(
      "starlight",
    );
    expect(getDefaultColorScheme({})).toBe("starlight");
  });

  test("Search component is the redone Starlight-style modal", () => {
    const search = fs.readFileSync(
      path.join(APP_SRC, "components/Search.astro"),
      "utf8",
    );
    expect(search).toContain("<porto-search");
    expect(search).toContain("data-open-modal");
    expect(search).toContain("#porto__search");
    expect(search).toContain("PagefindUI");
    expect(search).toContain("data-bundle-path");
    expect(search).not.toContain("preact");
  });

  test("no Tailwind in theme CSS", () => {
    for (const file of collectFiles(THEME_CSS_DIR, ".css")) {
      const css = stripComments(fs.readFileSync(file, "utf8"));
      expect(css).not.toContain("tailwind");
      expect(css).not.toContain("@apply");
      expect(css).not.toContain("@theme");
      expect(css).not.toContain("@custom-variant");
    }
  });

  test("no tailwindcss dependency or plugin", () => {
    const pkg = JSON.parse(
      fs.readFileSync(
        path.join(REPO_ROOT, "packages/app/package.json"),
        "utf8",
      ),
    );
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };
    expect("tailwindcss" in deps).toBe(false);
    expect("@tailwindcss/vite" in deps).toBe(false);
    const integration = fs.readFileSync(
      path.join(APP_SRC, "integration.ts"),
      "utf8",
    );
    expect(integration).not.toContain("@tailwindcss/vite");
    expect(integration).not.toContain("tailwindcss()");
  });

  test("no tailwind references in any .astro file", () => {
    for (const file of ALL_ASTRO_FILES) {
      const text = stripComments(fs.readFileSync(file, "utf8"));
      expect(text.toLowerCase()).not.toContain("tailwind");
    }
  });

  test("no Tailwind utilities in any .astro class attribute", () => {
    // Token-level check: a bare utility class (flex, text-muted,
    // bg-surface, …) in a class attribute means the file still
    // expects Tailwind. The renamed Starlight utilities (`porto-*`,
    // `md:porto-*`, …) and the `print:` / `sr-only` utilities are
    // real classes in css/ and don't count; plain CSS inside
    // <style> blocks is out of scope here (covered by the CSS
    // tests). `class:list` object keys (`{ active: … }`) are not
    // class strings — strip them before tokenizing.
    // (`truncate` is DocCardList's own scoped class, not a utility,
    // so it stays out of the list.)
    const UTILITY_RE =
      /^(?:flex|grid|block|hidden|inline-flex|inline-block|relative|absolute|fixed|sticky|items-\w+|justify-\w+|gap-\d|gap-\[|p-\d|px-\d|py-\d|pt-\d|pb-\d|pl-\d|pr-\d|m-\d|mx-\d|my-\d|mt-\d|mb-\d|ml-\d|mr-\d|w-\[|w-\d|h-\[|h-\d|min-h-\[|max-w-\[|max-w-\d|size-\[|size-\d|text-\[|text-\w+|font-\w+|leading-\[|rounded|rounded-\w+|shadow|shadow-\w+|border|border-\w+|bg-\w+|transition|duration-\d|ease-\[|opacity-\d|overflow-\w+|cursor-\w+|object-\w+|whitespace-\w+|capitalize|uppercase|line-clamp-\d|inset-\d|top-\d|bottom-\d|left-\d|right-\d|z-\d|grid-cols-\[|grid-cols-\d|snap-\w+|animate-\[|motion-reduce:|hover:|focus:|active:|disabled:|max-\[|after:|before:|group-hover:|\[)/;
    for (const file of ALL_ASTRO_FILES) {
      const text = stripComments(fs.readFileSync(file, "utf8"));
      const attrRe =
        /class(?:\:list)?=(?:"([^"]*)"|\{`([^`]*)`\}|\{\[([^\]]*)\]\})/g;
      for (const match of text.matchAll(attrRe)) {
        const raw = match[1] ?? match[2] ?? match[3] ?? "";
        const cleaned = raw
          .replace(/\$\{[^}]*\}/g, " ")
          .replace(/\{[^}]*\}/g, " ")
          .replace(/["',]/g, " ");
        for (const token of cleaned.split(/\s+/).filter(Boolean)) {
          if (token.includes("porto-")) {
            continue;
          }
          expect(token).not.toMatch(UTILITY_RE);
        }
      }
    }
  });

  test("no sl- or starlight identifiers in copied code", () => {
    // Scope: the copied Starlight stylesheets (integrated into
    // Portosaur's own CSS files at the `css/` root), the copied/adapted
    // components, layouts, scripts, utils, and all pages — plus the
    // original portfolio/blog/tasks stylesheets, which must not
    // introduce Starlight identifiers either. Comments are stripped
    // (they may cite Starlight as the source).
    //
    // Intentional exclusions (scheme-name references, not copied
    // Starlight identifiers):
    // - `themes/starlight.css`: the `starlight` palette, a scheme name
    //   like `dracula` or `nord` (`[data-scheme="starlight"]`).
    // - `config/shiki.ts` and `packages/cli/src/engine/utils/css.ts`:
    //   the `starlight` scheme name in the Shiki theme map and in
    //   `getDefaultColorScheme`.
    // - `packages/app/NOTICE.md`: the MIT attribution itself.
    // - `docs/`: documentation of the derivation, not copied code.
    // - `css/custom.css`: imports `./themes/starlight.css` by name.
    const files = [
      ...INTEGRATED_CSS_FILES.map((file) =>
        path.join(THEME_CSS_DIR, file),
      ),
      ...PORTFOLIO_CSS_FILES.map((file) => path.join(THEME_CSS_DIR, file)),
      ...collectFiles(path.join(APP_SRC, "components"), ".astro"),
      ...collectFiles(path.join(APP_SRC, "layouts"), ".astro"),
      ...collectFiles(path.join(APP_SRC, "scripts"), ".ts"),
      path.join(APP_SRC, "utils/porto-icons.ts"),
      path.join(APP_SRC, "utils/navbar.ts"),
      path.join(APP_SRC, "utils/imageSize.ts"),
      path.join(APP_SRC, "constants.ts"),
      path.join(APP_SRC, "integration.ts"),
      ...collectFiles(path.join(APP_SRC, "pages"), ".astro"),
    ];
    for (const file of files) {
      const text = stripComments(fs.readFileSync(file, "utf8"));
      expect(text).not.toContain("sl-");
      expect(text.toLowerCase()).not.toContain("starlight");
    }
  });

  test("attribution exists: NOTICE.md and copied-file headers", () => {
    const notice = fs.readFileSync(
      path.join(REPO_ROOT, "packages/app/NOTICE.md"),
      "utf8",
    );
    expect(notice).toContain("Starlight");
    expect(notice).toContain("MIT License");
    for (const file of INTEGRATED_CSS_FILES.map((f) =>
      path.join(THEME_CSS_DIR, f),
    )) {
      const css = fs.readFileSync(file, "utf8");
      // code.css is a new Portosaur file (Shiki frame in Starlight's
      // visual language), not a copy — no attribution header.
      if (path.basename(file) === "code.css") {
        continue;
      }
      expect(css).toContain("Derived from Starlight (MIT License)");
    }
  });

  test("no --ifm-* or --docusaurus-* in theme source CSS", () => {
    for (const file of collectFiles(THEME_CSS_DIR, ".css")) {
      const css = fs.readFileSync(file, "utf8");
      expect(css).not.toContain("--ifm-");
      expect(css).not.toContain("--docusaurus-");
    }
  });

  test("no old --color-* short tokens in theme source CSS", () => {
    for (const file of collectFiles(THEME_CSS_DIR, ".css")) {
      const css = stripComments(fs.readFileSync(file, "utf8"));
      expect(css).not.toContain("--color-primary");
      expect(css).not.toContain("--color-background");
      expect(css).not.toContain("--color-surface");
      expect(css).not.toContain("--color-foreground");
      expect(css).not.toContain("--color-muted");
      expect(css).not.toContain("--color-border");
    }
  });

  describe("theme select", () => {
    // Starlight's Light / Dark / Auto select replaces Portosaur's
    // light/dark toggle button (commit after the portfolio commit).
    // The preference lives under the existing `"theme"` localStorage
    // key (stored `light`/`dark` choices stay valid; `auto` is new),
    // and when nothing is stored the site's `defaultMode` wins.
    const selectSrc = fs.readFileSync(
      path.join(APP_SRC, "components/ThemeSelect.astro"),
      "utf8",
    );
    const selectWidgetSrc = fs.readFileSync(
      path.join(APP_SRC, "components/Select.astro"),
      "utf8",
    );
    const themeModeSrc = fs.readFileSync(
      path.join(APP_SRC, "scripts/theme-mode.ts"),
      "utf8",
    );
    const baseLayoutSrc = fs.readFileSync(
      path.join(APP_SRC, "layouts/BaseLayout.astro"),
      "utf8",
    );

    test("ThemeSelect and Select exist with attribution headers", () => {
      expect(selectSrc).toContain("Derived from Starlight (MIT License)");
      expect(selectWidgetSrc).toContain(
        "Derived from Starlight (MIT License)",
      );
      expect(selectSrc).toContain("<porto-theme-select>");
      // (comments may cite the Starlight originals — strip them first)
      expect(stripComments(selectSrc)).not.toContain("starlight-theme-select");
      // Plain strings, not i18n calls (Portosaur has no i18n).
      expect(selectSrc).not.toContain("Astro.locals.t");
      for (const value of ['value: "dark"', 'value: "light"', 'value: "auto"']) {
        expect(selectSrc).toContain(value);
      }
      // The server-rendered selected option is the configured
      // defaultMode, not Starlight's `auto`.
      expect(selectSrc).toContain("config.theme.defaultMode");
      expect(selectSrc).toContain('selected: defaultMode === "dark"');
      expect(selectSrc).toContain('selected: defaultMode === "light"');
    });

    test("no toggle button code remains in app source", () => {
      const files = [
        ...collectFiles(path.join(APP_SRC, "components"), ".astro"),
        ...collectFiles(path.join(APP_SRC, "layouts"), ".astro"),
        ...collectFiles(path.join(APP_SRC, "scripts"), ".ts"),
      ];
      for (const file of files) {
        const text = fs.readFileSync(file, "utf8");
        expect(text).not.toContain("data-theme-toggle");
        expect(text).not.toContain("toggleTheme");
        expect(text).not.toContain("Toggle dark mode");
      }
      // The moon/sun Icon entries themselves stay — generic icon
      // data, used elsewhere (and by the select's icons).
      const icons = fs.readFileSync(
        path.join(APP_SRC, "utils/porto-icons.ts"),
        "utf8",
      );
      expect(icons).toContain("moon:");
      expect(icons).toContain("sun:");
      expect(icons).toContain("laptop:");
    });

    test('preference lives under the existing "theme" key', () => {
      for (const src of [selectSrc, themeModeSrc, baseLayoutSrc]) {
        expect(src).toContain('"theme"');
        // (comments may cite Starlight's key — strip them first)
        expect(stripComments(src)).not.toContain("starlight-theme");
      }
      expect(themeModeSrc).toContain('const STORAGE_KEY = "theme"');
    });

    test("theme-mode handles auto and live OS-preference changes", () => {
      expect(themeModeSrc).toContain(
        'export type ThemePreference = "light" | "dark" | "auto"',
      );
      expect(themeModeSrc).toContain("getPreferredColorScheme");
      expect(themeModeSrc).toContain("prefers-color-scheme: light");
      expect(themeModeSrc).toContain('addEventListener("change"');
      // Change wiring targets the selects, and applying a choice
      // syncs every select on the page.
      expect(themeModeSrc).toContain("porto-theme-select select");
      expect(themeModeSrc).toContain("select.value = preference");
      // Theme-color sync survives the rewrite.
      expect(themeModeSrc).toContain("updateThemeColor");
      expect(themeModeSrc).toContain("--porto-color-bg");
    });

    test("pre-paint script resolves auto against the OS preference", () => {
      expect(baseLayoutSrc).toContain('stored === "auto"');
      expect(baseLayoutSrc).toContain("prefers-color-scheme: light");
      expect(baseLayoutSrc).toContain('localStorage.getItem("theme")');
    });

    test("select renders in navbar and mobile menu footer, gated", () => {
      const navbar = fs.readFileSync(
        path.join(APP_SRC, "components/Navbar.astro"),
        "utf8",
      );
      expect(navbar).toContain('import ThemeSelect from "./ThemeSelect.astro"');
      expect(navbar).toContain("<ThemeSelect />");
      expect(navbar).toContain("showThemeSwitch");
      const footer = fs.readFileSync(
        path.join(APP_SRC, "components/MobileMenuFooter.astro"),
        "utf8",
      );
      expect(footer).toContain('import ThemeSelect from "./ThemeSelect.astro"');
      expect(footer).toContain("<ThemeSelect />");
      expect(footer).toContain("config.theme.showThemeSwitch");
    });
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

    builtTest("built CSS contains all 14 scheme blocks", () => {
      const blocks = schemeBlocks(builtCss());
      for (const scheme of SCHEMES) {
        for (const mode of MODES) {
          expect(blocks.has(`${scheme}:${mode}`)).toBe(true);
          expect(blocks.get(`${scheme}:${mode}`)!.size).toBeGreaterThan(0);
        }
      }
    });

    builtTest("built CSS emits the renamed tokens", () => {
      const css = builtCss();
      expect(css).toContain("--porto-color-accent:");
      expect(css).toContain("--porto-color-bg:");
      expect(css).toContain("--porto-color-text:");
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

    builtTest("doc page renders the sidebar frame and TOC", () => {
      const html = fs.readFileSync(
        path.join(DOCS_BUILD_DIR, "docs/getting-started/index.html"),
        "utf8",
      );
      const htmlTag = html.match(/<html[^>]*>/)?.[0] ?? "";
      expect(htmlTag).toContain("data-has-sidebar");
      expect(htmlTag).toContain("data-has-toc");
      expect(html).toContain('id="porto__sidebar"');
      expect(html).toContain("<porto-toc");
      expect(html).toContain('id="_top"');
    });

    builtTest("docs home hero image is an <Image /> with dimensions", () => {
      // The docs home icon (img/icon.png, 418x512) goes through
      // Astro's <Image />, so the built <img> carries width/height.
      const html = fs.readFileSync(
        path.join(DOCS_BUILD_DIR, "index.html"),
        "utf8",
      );
      const img = html.match(/<img[^>]*alt="Hero"[^>]*>/)?.[0] ?? "";
      expect(img).toContain('width="418"');
      expect(img).toContain('height="512"');
    });

    builtTest("doc page renders the theme select, no toggle", () => {
      const html = fs.readFileSync(
        path.join(DOCS_BUILD_DIR, "docs/getting-started/index.html"),
        "utf8",
      );
      // Navbar select + mobile menu footer select.
      expect(html.match(/<porto-theme-select[\s>]/g)?.length).toBe(2);
      expect(html).toContain('<option value="dark"');
      expect(html).toContain('<option value="light"');
      expect(html).toContain('<option value="auto"');
      expect(html).not.toContain("data-theme-toggle");
    });
  });

  describe("built output (playground)", () => {
    const hasPlaygroundBuild = fs.existsSync(
      path.join(PLAYGROUND_BUILD_DIR, "index.html"),
    );
    if (!hasPlaygroundBuild) {
      console.warn(
        "theming: .playground/build missing — run `bun run build` to enable playground built-output checks",
      );
    }
    const playgroundTest = hasPlaygroundBuild ? test : test.skip;

    playgroundTest("hero profile picture is an <Image /> with dimensions", () => {
      // The playground profile picture (img/icon.png, 418x512) goes
      // through Astro's <Image />, so the built <img> carries
      // width/height (and the dev-toolbar Audit warning is gone for
      // it). The playground config sets no fallback, so no onerror
      // is expected here — the fallback path is covered by the
      // HeroSection source (onerror passes through <Image />).
      const html = fs.readFileSync(
        path.join(PLAYGROUND_BUILD_DIR, "index.html"),
        "utf8",
      );
      const img = html.match(/<img[^>]*alt="profile"[^>]*>/)?.[0] ?? "";
      expect(img).toContain('width="418"');
      expect(img).toContain('height="512"');
      expect(img).toContain('class="porto-hero-picture"');
    });

    playgroundTest("about portrait is an <Image /> with dimensions", () => {
      const html = fs.readFileSync(
        path.join(PLAYGROUND_BUILD_DIR, "index.html"),
        "utf8",
      );
      const img =
        html.match(/<img[^>]*class="porto-about-avatar"[^>]*>/)?.[0] ?? "";
      expect(img).toContain('width="418"');
      expect(img).toContain('height="512"');
    });

    playgroundTest("built CSS contains the portfolio styles", () => {
      const css = collectFiles(PLAYGROUND_BUILD_DIR, ".css")
        .map((file) => fs.readFileSync(file, "utf8"))
        .join("\n");
      for (const selector of [
        ".porto-hero",
        ".porto-about-card",
        ".porto-project-card",
        ".porto-contact-card",
        ".porto-note-grid",
        ".porto-tasks-table",
        ".porto-blog-layout",
        ".porto-link-button",
      ]) {
        expect(css).toContain(selector);
      }
      // No Tailwind utilities leak into the built CSS.
      expect(css).not.toContain(".text-muted");
      expect(css).not.toContain(".bg-surface");
    });
    playgroundTest("home renders the theme select, no toggle", () => {
      const html = fs.readFileSync(
        path.join(PLAYGROUND_BUILD_DIR, "index.html"),
        "utf8",
      );
      // Navbar select + mobile slide-down menu select.
      expect(html.match(/<porto-theme-select[\s>]/g)?.length).toBe(2);
      expect(html).toContain('<option value="dark"');
      expect(html).toContain('<option value="light"');
      expect(html).toContain('<option value="auto"');
      expect(html).not.toContain("data-theme-toggle");
    });
  });
});
