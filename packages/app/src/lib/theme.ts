/**
 * Theme mode (light / dark / auto) management — the React port of the
 * Astro `theme-mode.ts` module, plus the theme-color meta sync (old
 * `getThemeColorSyncScript`).
 *
 * Resolution order: a stored `localStorage` choice wins. Otherwise
 * the site's `defaultMode` wins (the mode the pre-paint script in the
 * root layout already applied). `auto` follows the OS
 * `prefers-color-scheme` preference, live — if the OS preference
 * changes while the page is open, an `auto` choice re-resolves.
 *
 * The preference lives under the existing `"theme"` localStorage key,
 * so stored `light`/`dark` choices stay valid. `auto` is the new
 * third value. The inline script in the root layout applies the
 * resolved mode pre-paint (no flash). This module wires the theme
 * dropdowns (rendered by `Navbar` and `MobileMenuFooter`) and keeps
 * the `theme-color` meta tag in sync with the background token.
 *
 * The two dropdowns on a page stay in sync through a tiny external
 * store (`useThemePreference`, via `useSyncExternalStore`) — no DOM
 * queries, no double-wiring markers.
 */

import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";
export type ThemePreference = "light" | "dark" | "auto";

export const THEME_LABELS: Record<ThemePreference, string> = {
  dark: "Dark",
  light: "Light",
  auto: "Auto",
};

const STORAGE_KEY = "theme";

/** Tokens consulted for the theme-color meta, in order. */
const THEME_COLOR_VARS = ["--porto-color-bg"];

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

// The external store: the current preference, its listeners, and the
// one-time global wiring (the OS-preference listener and the
// `data-theme` observer both live on `window` / `<html>`, which
// survive client-side navigation).
type ThemeListener = () => void;

let currentPreference: ThemePreference | null = null;
let listeners = new Set<ThemeListener>();
let globalWiringDone = false;

function getSnapshot(): ThemePreference {
  if (currentPreference === null) {
    currentPreference = loadTheme();
  }
  return currentPreference;
}

function getServerSnapshot(): ThemePreference {
  return "dark";
}

function subscribe(listener: ThemeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function ensureGlobalWiring(): void {
  if (globalWiringDone) {
    return;
  }
  globalWiringDone = true;

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

/** Applies a preference, persists it, and re-syncs the theme-color meta. */
export function setTheme(preference: ThemePreference): void {
  const mode = preference === "auto" ? getPreferredColorScheme() : preference;
  document.documentElement.setAttribute("data-theme", mode);
  currentPreference = preference;
  emit();
  try {
    window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage unavailable (private mode, disabled cookies) — the
    // mode still applies for this page load.
  }
  updateThemeColor();
}

/**
 * The current theme preference, live across every ThemeSelect on the
 * page. The server snapshot is `"dark"`. The client corrects it from
 * storage on first read (the pre-paint script already applied the
 * resolved mode, so only the dropdown label/icon can flicker).
 */
export function useThemePreference(): ThemePreference {
  if (typeof window !== "undefined") {
    ensureGlobalWiring();
  }
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
