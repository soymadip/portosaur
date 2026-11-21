import fs from "node:fs";

/**
 * Asset helpers for the generated root — reading CSS custom
 * properties (the theme color) out of the scheme CSS files.
 *
 * Server-only (reads files from disk). The generated root layout
 * and manifest read the theme color through `getCssVar` at build
 * time. (The old `getAssetHeadTags` is gone: the root layout
 * metadata links the icons and manifest now.)
 */

/**
 * Reads a CSS custom property's value out of a list of CSS files —
 * the theme-color meta needs the resolved `--porto-color-bg`, which
 * lives in the scheme CSS. Returns `null` when no file defines it.
 */
export function getCssVar(varName: string, cssFiles: string[]): string | null {
  const pattern = new RegExp(
    `${varName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*([^;]+);`,
  );
  for (const file of cssFiles) {
    try {
      const contents = fs.readFileSync(file, "utf-8");
      const match = pattern.exec(contents);
      if (match) {
        return match[1].trim();
      }
    } catch {
      // Missing or unreadable file — try the next one.
    }
  }
  return null;
}
