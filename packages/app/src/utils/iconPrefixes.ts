/**
 * Icon pack registry shared by the remark icons plugin and the icon scan.
 *
 * Ported from `iconPrefixes.cjs` (Phase 2): same packs, same shorthands,
 * ESM exports instead of `module.exports`.
 */

export interface IconPack {
  shorthands: string[];
  name: string;
}

export const iconPacks: Record<string, IconPack> = {
  lucide: { shorthands: ["lu"], name: "Lucide" },
  octicon: { shorthands: ["oc"], name: "Octicons" },
  "simple-icons": { shorthands: ["si"], name: "Simple Icons" },
  logos: { shorthands: ["lo"], name: "Logos" },
  mdi: { shorthands: ["md"], name: "Material Design" },
  "line-md": { shorthands: ["ml"], name: "Line MD" },
  devicon: { shorthands: ["di"], name: "Devicon" },
  "streamline-sharp": { shorthands: ["sl"], name: "Streamline" },
  "fa7-solid": { shorthands: ["fa", "fas"], name: "FontAwesome" },
};

/**
 * Flat map of every usable prefix (canonical name + shorthands) to its
 * canonical pack name, e.g. `{ lu: "lucide", lucide: "lucide" }`.
 */
export function getPrefixMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [canonical, data] of Object.entries(iconPacks)) {
    map[canonical] = canonical;
    data.shorthands.forEach((sh) => {
      map[sh] = canonical;
    });
  }
  return map;
}

/** Alternation of every usable prefix, for building the icon regex. */
export function getPrefixRegex(): string {
  return Object.keys(getPrefixMap()).join("|");
}
