const iconPacks = {
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

// Helper for plugins that need a flat resolution map
const getPrefixMap = () => {
  const map = {};
  for (const [canonical, data] of Object.entries(iconPacks)) {
    map[canonical] = canonical;
    data.shorthands.forEach((sh) => {
      map[sh] = canonical;
    });
  }
  return map;
};

// Helper for regex matching
const getPrefixRegex = () => Object.keys(getPrefixMap()).join("|");

module.exports = {
  iconPacks,
  getPrefixMap,
  getPrefixRegex,
};
