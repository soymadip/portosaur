/**
 * Icon pack registry shared by the remark icons plugin and the icon scan.
 *
 * Ported from `iconPrefixes.cjs` (Phase 2): same packs, same shorthands,
 * ESM exports instead of `module.exports`.
 */

export const iconPacks = {
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
export function getPrefixMap() {
  const map = {};
  for (const [canonical, data] of Object.entries(iconPacks)) {
    map[canonical] = canonical;
    data.shorthands.forEach((sh) => {
      map[sh] = canonical;
    });
  }
  return map;
}

/** Alternation of every usable prefix, for building the icon regex. */
export function getPrefixRegex() {
  return Object.keys(getPrefixMap()).join("|");
}
