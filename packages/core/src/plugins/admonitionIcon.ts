/**
 * The callout icon for an admonition type, injected into the
 * `.admonition-heading` by the three admonition plugins. Build
 * time only (it reads the Iconify packs through `lib/icon-data.ts`).
 */

import { getIconJsx } from "../lib/icon-data.ts";

/** The Iconify id for each admonition type (note is the default). */
const ADMONITION_ICONS: Record<string, string> = {
  note: "mdi:pencil",
  info: "mdi:information",
  tip: "mdi:lightbulb",
  important: "mdi:lightbulb",
  success: "mdi:check-circle",
  warning: "mdi:alert",
  caution: "mdi:alert",
  danger: "mdi:alert-octagon",
};

/** The heading icon for an admonition type, as an inline `<svg>`
 * (1.25em). Null when the icon is missing. */
export function admonitionIcon(type: string): any | null {
  return getIconJsx(ADMONITION_ICONS[type] ?? ADMONITION_ICONS.note, {
    className: "admonition-icon",
    width: "1.25em",
    height: "1.25em",
    fill: "currentColor",
    "aria-hidden": "true",
  });
}
