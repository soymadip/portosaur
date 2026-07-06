const prefixMap = {
  lu: "lucide",
  lucide: "lucide",
  oc: "octicon",
  octicon: "octicon",
  si: "simple-icons",
  "simple-icons": "simple-icons",
  lo: "logos",
  logos: "logos",
  md: "mdi",
  mdi: "mdi",
  ml: "line-md",
  "line-md": "line-md",
  di: "devicon",
  devicon: "devicon",
  sl: "streamline-sharp",
  "streamline-sharp": "streamline-sharp",
};

// Generates the regex group for all available prefixes, e.g., 'lu|lucide|oc|octicon|...'
const prefixRegexString = Object.keys(prefixMap).join("|");

module.exports = {
  prefixMap,
  prefixRegexString,
};
