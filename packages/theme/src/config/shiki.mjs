/**
 * Shiki syntax-highlighting themes per Portosaur color scheme (Phase 2, D1).
 *
 * Replaces the Prism theme map (`prismThemeMap`): Shiki is the only
 * highlighter in the stack now. Each scheme maps to a light/dark pair of
 * Shiki built-in theme names, used both by Astro's build-time highlighting
 * (`markdown.shikiConfig`) and by the Preview code renderer in the browser.
 *
 * Notes on the pairs: Shiki ships no `nord` light theme, so nord/dracula/
 * portosaur light all use `github-light` (the old Prism map used the
 * github/duotone light themes there too). `portosaur` dark uses `night-owl`
 * (closest Shiki equivalent to the old `oceanicNext` dark blue).
 */
export const shikiThemeMap = {
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
 * Falls back to `nord` (the default scheme) for unknown names.
 *
 * @param {string} colorScheme - The `theme.color_scheme` value.
 * @returns {{ light: string, dark: string }} The Shiki theme names.
 */
export function getShikiThemes(colorScheme) {
  return shikiThemeMap[colorScheme] || shikiThemeMap.nord;
}
