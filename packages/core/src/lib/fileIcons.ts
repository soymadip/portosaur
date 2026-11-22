/**
 * A file or folder's auto icon, from the one name-to-icon
 * database in techmap.ts. The lookup order is what lives here —
 * the data lives there.
 *
 * File lookup tries the full name first (`package.json`), then
 * the stem without its extension — but only stems marked
 * `stem: true` in the map (`vite.config.ts` matches
 * `vite.config`, `.env.local` matches `.env`). An unmarked
 * stem never matches: without that, `app.tsx` would match the
 * folder name `app` before its extension. Then the extension.
 * A leading dot is not an extension, so dotfiles only match by
 * name. Unknown names get no icon — the tree falls back to the
 * plain file or the folder glyph.
 */

import { techMap } from "./techmap.ts";

/** A file's auto icon id, or undefined when nothing matches. */
export function getFileIcon(name: string): string | undefined {
  const lower = name.toLowerCase();
  const byName = techMap[lower]?.icon;
  if (byName) {
    return byName;
  }
  const dot = lower.lastIndexOf(".");
  if (dot > 0) {
    const stemEntry = techMap[lower.slice(0, dot)];
    if (stemEntry?.stem) {
      return stemEntry.icon;
    }
    return techMap[lower.slice(dot + 1)]?.icon;
  }
  return undefined;
}

/** A folder's auto icon id, or undefined when nothing matches. */
export function getFolderIcon(name: string): string | undefined {
  return techMap[name.toLowerCase()]?.icon;
}
