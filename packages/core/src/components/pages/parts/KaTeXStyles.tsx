"use client";

import "katex/dist/katex.min.css";

/**
 * The KaTeX stylesheet, loaded only on pages that render math.
 * Imported dynamically (via `next/dynamic`) by `DocPage` when the
 * page's `__portoHasMath` export is set — importing it globally
 * would put ~25KB of CSS on every page, while most sites have no
 * math pages at all. Renders nothing itself.
 */
export function KaTeXStyles() {
  return null;
}
