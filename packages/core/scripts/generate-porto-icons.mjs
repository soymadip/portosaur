// Generates src/lib/porto-icons.ts from the installed Iconify packs.
// The chrome icons (theme select, sidebar carets, copy buttons, ...)
// are a fixed set, so their SVG bodies are extracted once and committed
// instead of importing the megabyte-sized packs from client components.
// Run from packages/core: bun run generate:icons
import { getIconData, iconToSVG } from "@iconify/utils";
import lucide from "@iconify-json/lucide/icons.json" with { type: "json" };
import mdi from "@iconify-json/mdi/icons.json" with { type: "json" };
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PACKS = { lucide, mdi };

// PortoIcon name -> Iconify id. The MDI picks are the closest filled
// matches for the old Starlight glyphs (compared side by side); the
// Lucide picks reproduce the old hand-copied paths exactly.
const ICONS = {
  "chevron-down": "lucide:chevron-down",
  sidebar: "lucide:panel-left",
  copy: "lucide:copy",
  check: "lucide:check",
  "wrap-text": "lucide:wrap-text",
  link: "lucide:link",
  sun: "lucide:sun",
  "right-caret": "mdi:chevron-right",
  pencil: "mdi:pencil-outline",
  moon: "mdi:moon-waning-crescent",
  laptop: "mdi:laptop",
  search: "lucide:search",
  x: "lucide:x",
  "chevron-right": "lucide:chevron-right",
  hash: "lucide:hash",
};

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "src/lib/porto-icons.ts");

const entries = [];
for (const [name, id] of Object.entries(ICONS)) {
  const [packName, iconName] = id.split(":");
  const data = getIconData(PACKS[packName], iconName);
  const rendered = data ? iconToSVG(data) : null;
  if (!rendered) {
    throw new Error(`Icon not found in pack: ${id}`);
  }
  if (rendered.attributes.viewBox !== "0 0 24 24") {
    throw new Error(
      `${id} has viewBox ${rendered.attributes.viewBox}, expected 0 0 24 24 (PortoIcon hardcodes it)`,
    );
  }
  entries.push(`  ${JSON.stringify(name)}: ${JSON.stringify(rendered.body)}, // ${id}`);
}

const header = `/**
 * Portosaur's built-in icon set — the small icons the chrome itself
 * needs (theme select, sidebar carets, edit link). Generated from
 * the installed Iconify packs by scripts/generate-porto-icons.mjs —
 * do not edit by hand.
 *
 * Lucide icons: ISC License, Copyright (c) 2020 Lucide Contributors.
 * Material Design Icons: Apache License 2.0.
 *
 * Content icons (frontmatter \`icon\`, note cards, feature icons) do
 * NOT come from here — those resolve through the generated site
 * icon map (\`lib/site-icons.ts\`) at build time.
 */
`;

writeFileSync(
  outPath,
  `${header}
export const PortoIcons = {
${entries.join("\n")}
} as const;

export type PortoIcon = keyof typeof PortoIcons;
`,
);
console.log(`Wrote ${outPath} (${entries.length} icons)`);
