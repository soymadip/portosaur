import type { BuiltinTheme } from "shiki";

/**
 * Shiki syntax-highlighting themes per Portosaur color scheme.
 *
 * Ported from the Astro app (`packages/app/src/config/shiki.ts`).
 * Each scheme maps to a light/dark pair of Shiki built-in theme
 * names, passed to Fumadocs' `rehypeCode` via
 * `mdxOptions.rehypeCodeOptions.themes` (see `mdx.ts`).
 *
 * Notes on the pairs: Shiki ships no `nord` light theme, so nord/dracula/
 * portosaur light all use `github-light` (the old Prism map used the
 * github/duotone light themes there too). `portosaur` dark uses `night-owl`
 * (closest Shiki equivalent to the old `oceanicNext` dark blue).
 */
export type ShikiThemePair = {
  light: BuiltinTheme;
  dark: BuiltinTheme;
};

export const shikiThemeMap: Record<string, ShikiThemePair> = {
  catppuccin: {
    light: "catppuccin-latte",
    dark: "catppuccin-mocha",
  },
  github: {
    light: "github-light",
    dark: "github-dark",
  },
  nord: {
    light: "github-light",
    dark: "nord",
  },
  dracula: {
    light: "github-light",
    dark: "dracula",
  },
  gruvbox: {
    light: "gruvbox-light-medium",
    dark: "gruvbox-dark-medium",
  },
  portosaur: {
    light: "github-light",
    dark: "night-owl",
  },
};

/**
 * Returns the Shiki light/dark theme pair for a Portosaur color scheme.
 * Falls back to `nord` for unknown names.
 *
 * @param colorScheme - The `theme.color_scheme` value.
 * @returns The Shiki theme names.
 */
export function getShikiThemes(colorScheme?: string): ShikiThemePair {
  return shikiThemeMap[colorScheme ?? ""] ?? shikiThemeMap.nord;
}
