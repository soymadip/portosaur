import fs from "fs";
import path from "path";
import { getIconData, iconToSVG } from "@iconify/utils";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { getPrefixMap, getPrefixRegex } = require("../utils/iconPrefixes.cjs");
const prefixMap = getPrefixMap();
const prefixRegexString = getPrefixRegex();

const collections = {
  lucide: require("@iconify-json/lucide/icons.json"),
  octicon: require("@iconify-json/octicon/icons.json"),
  "simple-icons": require("@iconify-json/simple-icons/icons.json"),
  logos: require("@iconify-json/logos/icons.json"),
  mdi: require("@iconify-json/mdi/icons.json"),
  "line-md": require("@iconify-json/line-md/icons.json"),
  devicon: require("@iconify-json/devicon/icons.json"),
  "streamline-sharp": require("@iconify-json/streamline-sharp/icons.json"),
};

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;

  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

export default function iconsPlugin(context, options) {
  return {
    name: "portosaur-icons-plugin",

    async loadContent() {
      const { siteDir } = context;
      const iconsFound = new Set();

      // Matches icons like md:icon-name, si:icon-name, devicon:icon-name, di:icon-name, etc.
      const regex = new RegExp(`(?:${prefixRegexString}):[a-zA-Z0-9-_]+`, "g");

      // Read config.yml or config.yaml from the site root
      const configPathYml = path.join(siteDir, "config.yml");
      const configPathYaml = path.join(siteDir, "config.yaml");
      const configPath = fs.existsSync(configPathYml)
        ? configPathYml
        : configPathYaml;

      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, "utf8");
        const matches = configContent.match(regex);
        if (matches) matches.forEach((m) => iconsFound.add(m));
      }

      // Read markdown files in all relevant content directories
      const projectDir = options.projectDir || siteDir;
      const contentDirs = ["docs", "blog", "pages", "notes"];
      contentDirs.forEach((dirName) => {
        const fullDir = path.join(projectDir, dirName);
        walkDir(fullDir, (filePath) => {
          if (!filePath.endsWith(".md") && !filePath.endsWith(".mdx")) return;
          const content = fs.readFileSync(filePath, "utf8");
          const matches = content.match(regex);
          if (matches) matches.forEach((m) => iconsFound.add(m));

          // Auto-bundle devicons based on slug/filename
          const basename = path.basename(filePath);
          const nameWithoutExt = basename.replace(/\.mdx?$/, "").toLowerCase();
          const slugMatch = content.match(/^slug:\s*([^\s]+)/m);
          const slugToCheck = slugMatch
            ? slugMatch[1].toLowerCase()
            : nameWithoutExt;

          if (collections.devicon && collections.devicon.icons[slugToCheck]) {
            iconsFound.add(`di:${slugToCheck}`);
          }
        });
      });

      // Scan the theme's React components to catch any hardcoded icons
      const themeSourceDir = path.resolve(
        options.portoRoot || path.join(siteDir, "..", "packages", "theme"),
        "theme",
      );

      if (fs.existsSync(themeSourceDir)) {
        walkDir(themeSourceDir, (filePath) => {
          const ext = path.extname(filePath);
          if (![".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext))
            return;
          const content = fs.readFileSync(filePath, "utf8");
          const matches = content.match(regex);
          if (matches) matches.forEach((m) => iconsFound.add(m));
        });
      }

      // Generate the SVGs
      const generatedIcons = {};

      for (const iconId of iconsFound) {
        const parts = iconId.split(":");

        if (parts.length !== 2) continue;

        const [rawPrefix, name] = parts;

        const prefix = prefixMap[rawPrefix];
        const collection = collections[prefix];

        if (!collection) {
          console.warn(`[Icons] Unknown icon prefix in ID: ${iconId}`);
          continue;
        }

        const iconData = getIconData(collection, name);
        if (!iconData) {
          console.warn(`[Icons] Icon not found: ${iconId}`);
          continue;
        }

        const renderData = iconToSVG(iconData, {
          height: "1em",
          width: "1em",
        });

        if (renderData) {
          generatedIcons[iconId] = {
            attributes: renderData.attributes,
            body: renderData.body,
          };
        }
      }

      // Return the generated icons object so Docusaurus can pass it to contentLoaded
      console.log(
        `[Icons] Scanned and bundled ${Object.keys(generatedIcons).length} unique offline icons.`,
      );
      return generatedIcons;
    },

    async contentLoaded({ content, actions }) {
      // Pass the generated icons to Docusaurus's native global data system!
      // This hides it in the internal `.docusaurus` cache and prevents it from being committed to Git.
      actions.setGlobalData(content);
    },

    getPathsToWatch() {
      const { siteDir } = context;
      const projectDir = options.projectDir || siteDir;
      const themeSourceDir = path.resolve(
        options.portoRoot || path.join(siteDir, "..", "packages", "theme"),
        "theme",
      );

      return [
        path.join(siteDir, "config.yml"),
        path.join(siteDir, "config.yaml"),
        path.join(projectDir, "docs/**/*.{md,mdx}"),
        path.join(projectDir, "blog/**/*.{md,mdx}"),
        path.join(projectDir, "pages/**/*.{md,mdx}"),
        path.join(projectDir, "notes/**/*.{md,mdx}"),
        path.join(themeSourceDir, "**/*.{js,jsx,ts,tsx,mjs,cjs}"),
      ];
    },
  };
}
