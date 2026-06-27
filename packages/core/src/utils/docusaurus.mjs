import fs from "fs";
import path from "path";
import yaml from "js-yaml";

/**
 * Resolves site URL based on config or environment
 */
export function resolveSiteUrl(configValue, env = process.env) {
  if (configValue === "auto") {
    if (env.CI_PAGES_URL) {
      return new URL(env.CI_PAGES_URL).origin;
    }
    if (env.GITHUB_ACTIONS === "true") {
      return `https://${env.GITHUB_REPOSITORY_OWNER}.github.io`;
    }
    return "http://localhost";
  }
  return configValue;
}

/**
 * Resolves base path based on config or environment.
 * GitHub user/organization Pages repositories are served from root,
 * while project Pages repositories are served from the repository path.
 */
export function resolveBasePath(configValue, env = process.env) {
  if (configValue === "auto") {
    if (env.CI_PAGES_URL) {
      return new URL(env.CI_PAGES_URL).pathname;
    }
    if (env.GITHUB_ACTIONS === "true") {
      const repo = env.GITHUB_REPOSITORY ?? "";
      const [owner, name] = repo.split("/");
      const rootPagesRepo = `${owner}.github.io`;

      if (name === rootPagesRepo) {
        return "/";
      }

      return `/${name}/`;
    }
    return "/";
  }
  return configValue;
}

/**
 * Creates a function to resolve static asset paths.
 * Handles portoRoot-prefixed absolute paths by extracting the bare relative
 * subpath after any "assets/" segment, so they resolve correctly from
 * the registered staticDirectories.
 */
export function createStaticAssetResolver(_projectDir, staticDir, assetsDir) {
  return function (primaryPath, fallbackPath = "") {
    if (!primaryPath) {
      return fallbackPath;
    }
    if (/^https?:\/\//.test(primaryPath)) {
      return primaryPath;
    }

    // Strip known prefix segments that arise from {{portoRoot}}/src/assets/...
    // or {{portoRoot}}/assets/... template paths so we get a bare relative path
    // that Docusaurus can serve from its staticDirectories.
    const match = primaryPath.match(/(?:src\/)?assets\/(.+)$/);
    const normalizedPath = match ? match[1] : primaryPath;

    if (fs.existsSync(path.resolve(staticDir, normalizedPath))) {
      return normalizedPath;
    }
    if (assetsDir && fs.existsSync(path.resolve(assetsDir, normalizedPath))) {
      return normalizedPath;
    }

    // Fallback: try the original path unchanged
    if (fs.existsSync(path.resolve(staticDir, primaryPath))) {
      return primaryPath;
    }
    if (assetsDir && fs.existsSync(path.resolve(assetsDir, primaryPath))) {
      return primaryPath;
    }

    return fallbackPath || normalizedPath || primaryPath;
  };
}

/**
 * Transforms tag objects into Docusaurus head tag format
 */
export function buildHeadTags(tags = []) {
  return tags.map((tag) => {
    if (tag.tagName && tag.attributes) return tag;
    const [tagName, attributes] = Object.entries(tag)[0];
    return { tagName, attributes };
  });
}

const frontmatterCache = new Map();

/**
 * Helper to parse YAML frontmatter from a file, cached for performance.
 */
function parseFileFrontmatter(filePath) {
  if (frontmatterCache.has(filePath)) {
    return frontmatterCache.get(filePath);
  }

  if (!fs.existsSync(filePath)) {
    frontmatterCache.set(filePath, null);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (match) {
      const parsed = yaml.load(match[1]) || {};
      frontmatterCache.set(filePath, parsed);
      return parsed;
    }
  } catch (err) {
    // Ignore parse/read errors
  }

  frontmatterCache.set(filePath, null);
  return null;
}

/**
 * Creates a sidebar items generator that enriches items with custom props (icon, color)
 * from document frontmatter.
 */
export function createSidebarItemsGenerator() {
  return async ({
    defaultSidebarItemsGenerator,
    numberPrefixParser,
    ...args
  }) => {
    const sidebarItems = await defaultSidebarItemsGenerator({
      numberPrefixParser,
      ...args,
    });

    const enrichItems = (items) => {
      return items.map((item) => {
        if (item.type === "doc") {
          const doc = args.docs.find((d) => d.id === item.id);
          if (doc && doc.frontMatter) {
            item.customProps = {
              ...item.customProps,
              icon: doc.frontMatter.icon,
              color: doc.frontMatter.color,
            };
          }
        } else if (item.type === "category") {
          if (item.items) {
            item.items = enrichItems(item.items);
          }
          if (item.link && item.link.type === "doc") {
            const doc = args.docs.find((d) => d.id === item.link.id);
            if (doc && doc.frontMatter) {
              item.customProps = {
                ...item.customProps,
                icon: doc.frontMatter.icon,
                color: doc.frontMatter.color,

                // Inject description: prefer frontmatter, fall back to auto-extracted first paragraph
                description:
                  doc.frontMatter.description ?? doc.description ?? undefined,
              };
            }
          }
        }
        return item;
      });
    };

    return enrichItems(sidebarItems);
  };
}

/**
 * Automatically cleans slugs and strips numeric sorting prefixes from document metadata.
 * Also inherits custom slugs from parent index files to route siblings consistently.
 */
export function cleanFrontMatterSlug({
  filePath,
  frontMatter,
  projectDir,
  contentDirName = "notes",
}) {
  const contentDir = path.resolve(projectDir, contentDirName);

  if (filePath.startsWith(contentDir)) {
    const relativePath = path.relative(contentDir, filePath);
    const pathParts = relativePath.split(path.sep);

    const filename = pathParts[pathParts.length - 1];
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    const isIndexFile =
      base.toLowerCase() === "index" || base.toLowerCase() === "readme";

    let currentRoutePath = "/";
    let currentPhysicalPath = contentDir;

    // Resolve directories up to grandparent for index files, otherwise parent
    const dirLimit = isIndexFile ? pathParts.length - 2 : pathParts.length - 1;

    for (let i = 0; i < dirLimit; i++) {
      const segment = pathParts[i];
      currentPhysicalPath = path.join(currentPhysicalPath, segment);

      let resolvedSlug = null;
      const indexNames = ["index.mdx", "index.md", "README.mdx", "README.md"];
      for (const name of indexNames) {
        const indexPath = path.join(currentPhysicalPath, name);
        const fm = parseFileFrontmatter(indexPath);
        if (fm && fm.slug) {
          resolvedSlug = fm.slug;
          break;
        }
      }

      if (resolvedSlug) {
        if (resolvedSlug.startsWith("/")) {
          currentRoutePath = resolvedSlug;
        } else {
          currentRoutePath = path.posix.resolve(currentRoutePath, resolvedSlug);
        }
      } else {
        let cleaned = segment.replace(/^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)/, "");
        cleaned = cleaned
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        currentRoutePath = path.posix.resolve(currentRoutePath, cleaned);
      }
    }

    let finalSlug = "";
    const userSlug = frontMatter.slug;

    if (isIndexFile) {
      if (userSlug) {
        if (userSlug.startsWith("/")) {
          finalSlug = userSlug;
        } else {
          finalSlug = path.posix.resolve(currentRoutePath, userSlug);
        }
      } else {
        const lastDirSegment = pathParts[pathParts.length - 2];
        let cleaned = lastDirSegment.replace(
          /^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)/,
          "",
        );

        cleaned = cleaned
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        finalSlug = path.posix.resolve(currentRoutePath, cleaned);
      }
    } else {
      if (userSlug) {
        if (userSlug.startsWith("/")) {
          finalSlug = userSlug;
        } else {
          finalSlug = path.posix.resolve(currentRoutePath, userSlug);
        }
      } else {
        let cleaned = base.replace(/^\d+(?:\.\d+)*\s*(?:-\s*|\.\s*)/, "");
        cleaned = cleaned
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");
        finalSlug = path.posix.resolve(currentRoutePath, cleaned);
      }
    }

    frontMatter.slug = finalSlug;
  }

  return frontMatter;
}

/**
 * Returns the client-side script for syncing the theme color meta tag
 * with the active theme variables.
 */
export function getThemeColorSyncScript() {
  return `
(function() {
  function updateThemeColor() {
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    
    // Read the variable globally from the HTML element
    var style = window.getComputedStyle(document.documentElement);

    // Docusaurus/Infima defines the navbar color globally
    var bgColor = style.getPropertyValue('--ifm-navbar-background-color');
    
    if (bgColor) {
      themeColorMeta.content = bgColor.trim();
    }
  }

  var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.attributeName === 'data-theme' || mutation.attributeName === 'class') {
        setTimeout(updateThemeColor, 10);
      }
    });
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'class']
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateThemeColor);
  } else {
    updateThemeColor();
  }
  
  // Also run on window load to ensure all CSS stylesheets have been fully parsed
  window.addEventListener('load', updateThemeColor);
})();
`;
}

/**
 * The default color scheme to use when no color scheme is specified.
 */
export const DEFAULT_COLOR_SCHEME = "nord";

/**
 * Resolves the absolute paths of all CSS files required for the site
 * (color schemes, global overrides, and custom user stylesheets).
 *
 * @param {string} projectDir - The user's project directory.
 * @param {Object} userConfig - The parsed Portosaur user config.
 * @param {string} themeDir - Absolute path to the theme directory.
 * @returns {string[]} Resolved paths to CSS files.
 */
export function resolveSiteCssFiles(projectDir, userConfig, themeDir) {
  const colorScheme = userConfig.theme?.color_scheme || DEFAULT_COLOR_SCHEME;
  const presetCss =
    colorScheme.endsWith(".css") ||
    colorScheme.includes("/") ||
    colorScheme.includes("\\")
      ? path.resolve(projectDir, colorScheme)
      : path.resolve(themeDir, `css/colors/${colorScheme}.css`);

  const files = [
    presetCss,
    path.resolve(themeDir, "css/infima.css"),
    path.resolve(themeDir, "css/custom.css"),
  ];

  const customCss = userConfig.theme?.custom_css;
  if (customCss) {
    const customPaths = Array.isArray(customCss) ? customCss : [customCss];
    for (const p of customPaths) {
      files.push(path.resolve(projectDir, p));
    }
  }

  return files.filter((f) => fs.existsSync(f));
}
