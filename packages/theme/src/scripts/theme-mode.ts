/**
 * Theme mode (dark/light) management — vanilla port of Docusaurus
 * `useColorMode`, plus the theme-color meta sync (old
 * `getThemeColorSyncScript`).
 *
 * Resolution order (matches the old config, which set
 * `respectPrefersColorScheme: false`): a stored `localStorage` choice
 * wins; otherwise the site's `defaultMode` wins. `prefers-color-scheme`
 * is deliberately NOT consulted.
 *
 * The inline script in `BaseLayout` applies the resolved mode pre-paint
 * (no flash); this module — imported by `BaseLayout` on every page —
 * wires the toggle buttons (`[data-theme-toggle]`, rendered by
 * `Navbar`) and keeps the `theme-color` meta tag in sync with the
 * navbar token.
 */

const STORAGE_KEY = "theme";

/** Tokens consulted for the theme-color meta, in order. */
const THEME_COLOR_VARS = ["--porto-navbar-bg", "--porto-bg"];

export type ThemeMode = "light" | "dark";

/** The mode currently applied to `<html data-theme>`. */
export function getTheme(): ThemeMode {
  const current = document.documentElement.getAttribute("data-theme");
  if (current === "light" || current === "dark") {
    return current;
  }
  return "dark";
}

/** Applies a mode, persists it, and re-syncs the theme-color meta. */
export function setTheme(mode: ThemeMode): void {
  document.documentElement.setAttribute("data-theme", mode);
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (private mode, disabled cookies) — the mode
    // still applies for this page load.
  }
  updateThemeColor();
}

/** Flips between light and dark. */
export function toggleTheme(): void {
  if (getTheme() === "dark") {
    setTheme("light");
  } else {
    setTheme("dark");
  }
}

/**
 * Syncs the `theme-color` meta tag with the navbar background token, so
 * the browser chrome matches the active mode. Port of the old
 * `getThemeColorSyncScript`, reading `--porto-*` tokens instead of the
 * old Infima navbar variable.
 */
export function updateThemeColor(): void {
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  const style = window.getComputedStyle(document.documentElement);
  for (const token of THEME_COLOR_VARS) {
    const value = style.getPropertyValue(token).trim();
    if (value) {
      meta.content = value;
      return;
    }
  }
}

function initThemeMode(): void {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleTheme();
    });
  });

  // Re-sync the theme color whenever the mode flips.
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === "data-theme") {
        window.setTimeout(updateThemeColor, 10);
      }
    }
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateThemeColor);
  } else {
    updateThemeColor();
  }
  // Also run on window load to ensure all stylesheets have been parsed.
  window.addEventListener("load", updateThemeColor);
}

initThemeMode();
