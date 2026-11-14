/**
 * Theme mode (light / dark / auto) management — Starlight's
 * theme-select logic (see `ThemeSelect.astro`) adapted to Portosaur,
 * plus the theme-color meta sync (old `getThemeColorSyncScript`).
 *
 * Resolution order: a stored `localStorage` choice wins; otherwise
 * the site's `defaultMode` wins (the mode the inline script in
 * `BaseLayout` already applied pre-paint). `auto` follows the OS
 * `prefers-color-scheme` preference, live — if the OS preference
 * changes while the page is open, an `auto` choice re-resolves.
 *
 * The preference lives under the existing `"theme"` localStorage key,
 * so stored `light`/`dark` choices stay valid; `auto` is the new
 * third value. The inline script in `BaseLayout` applies the
 * resolved mode pre-paint (no flash); this module — imported by
 * `BaseLayout` on every page — wires the theme dropdowns
 * (`porto-theme-select`, rendered by `Navbar` and
 * `MobileMenuFooter`) and keeps the `theme-color` meta tag in sync
 * with the background token.
 */

const STORAGE_KEY = "theme";

/** Tokens consulted for the theme-color meta, in order. */
const THEME_COLOR_VARS = ["--porto-color-bg"];

export type ThemeMode = "light" | "dark";
export type ThemePreference = "light" | "dark" | "auto";

/** The mode currently applied to `<html data-theme>`. */
export function getTheme(): ThemeMode {
  const current = document.documentElement.getAttribute("data-theme");
  if (current === "light" || current === "dark") {
    return current;
  }
  return "dark";
}

/** Get the preferred system color scheme. */
export function getPreferredColorScheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/**
 * Load the stored preference. When nothing valid is stored, fall
 * back to the mode the pre-paint script applied — the site's
 * `defaultMode` — so the selects show the effective choice.
 */
export function loadTheme(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "auto" || stored === "dark" || stored === "light") {
      return stored;
    }
  } catch {
    // Storage unavailable (private mode, disabled cookies).
  }
  return getTheme();
}

const THEME_LABELS: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  auto: "Auto",
};

/**
 * Syncs every theme dropdown on the page with the given preference:
 * the `data-current` attribute (drives which icon shows), the
 * summary label, and the checked option.
 */
function syncThemeControls(preference: ThemePreference): void {
  document.querySelectorAll("porto-theme-select").forEach((control) => {
    control.setAttribute("data-current", preference);
    const label = control.querySelector("[data-theme-current-label]");
    if (label) {
      label.textContent = THEME_LABELS[preference];
    }
    control.querySelectorAll("[data-theme-value]").forEach((button) => {
      button.setAttribute(
        "aria-checked",
        String(button.getAttribute("data-theme-value") === preference),
      );
    });
  });
}

/** Applies a preference, persists it, and re-syncs the theme-color meta. */
export function setTheme(preference: ThemePreference): void {
  const mode = preference === "auto" ? getPreferredColorScheme() : preference;
  document.documentElement.setAttribute("data-theme", mode);
  syncThemeControls(preference);
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage unavailable (private mode, disabled cookies) — the
    // mode still applies for this page load.
  }
  updateThemeColor();
}

/**
 * Syncs the `theme-color` meta tag with the background token, so the
 * browser chrome matches the active mode. Port of the old
 * `getThemeColorSyncScript`, reading the `--porto-color-bg` token
 * instead of the old Infima navbar variable.
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
  // Sync every dropdown with the resolved preference, then wire its
  // option buttons (the pre-paint script already applied the mode).
  const preference = loadTheme();
  syncThemeControls(preference);
  document.querySelectorAll("porto-theme-select").forEach((control) => {
    control
      .querySelectorAll<HTMLButtonElement>("[data-theme-value]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const value = button.getAttribute("data-theme-value");
          if (value === "auto" || value === "dark" || value === "light") {
            setTheme(value);
          }
          // Close the dropdown after choosing (the navbar script
          // also closes it on outside click / Escape).
          control.querySelector("details")?.removeAttribute("open");
        });
      });
  });

  // React to changes in system color scheme.
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (loadTheme() === "auto") {
        setTheme("auto");
      }
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
