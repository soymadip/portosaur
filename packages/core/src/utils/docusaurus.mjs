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
 * Creates a function to validate and normalize static asset paths.
 * Returns the resolved Docusaurus-friendly relative path or throws an error
 * if the asset is missing or is located outside the project boundaries.
 */
export function createAssetValidator(projectDir, staticDir, portoStaticDir) {
  const isPathInside = (child, parent) => {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return !relative.startsWith("..") && !path.isAbsolute(relative);
  };

  return function (primaryPath, fallbackPath = "") {
    if (!primaryPath) return fallbackPath;
    if (/^https?:\/\//.test(primaryPath)) return primaryPath;

    // Strip known prefix segments that arise from {{portoRoot}}/src/assets/...
    // or {{portoRoot}}/assets/... template paths so we get a bare relative path
    const match = primaryPath.match(/(?:src\/)?assets\/(.+)$/);
    const normalizedPath = match ? match[1] : primaryPath;

    // Possible absolute paths where the file might exist
    const candidatePaths = [
      path.resolve(projectDir, normalizedPath),
      path.resolve(projectDir, primaryPath),
      path.resolve(staticDir, normalizedPath),
      path.resolve(staticDir, primaryPath),
      portoStaticDir ? path.resolve(portoStaticDir, normalizedPath) : null,
      portoStaticDir ? path.resolve(portoStaticDir, primaryPath) : null,
    ].filter(Boolean);

    const resolvedAbsPath = candidatePaths.find((p) => fs.existsSync(p));

    if (resolvedAbsPath) {
      const insideStatic = isPathInside(resolvedAbsPath, staticDir);
      const insidePortoStatic = portoStaticDir
        ? isPathInside(resolvedAbsPath, portoStaticDir)
        : false;

      if (!insideStatic && !insidePortoStatic) {
        throw new Error(
          `Asset path "${primaryPath}" is outside valid directories. Custom assets must be placed inside the "static" directory.`,
        );
      }

      // If valid, return the Docusaurus-friendly relative path segment
      // (Docusaurus static directories serve contents directly)
      // So if the file is inside staticDir or portoStaticDir, its URL path is just the relative path from that dir
      let finalRelative = primaryPath;
      if (insideStatic) {
        finalRelative = path.relative(staticDir, resolvedAbsPath);
      } else if (insidePortoStatic) {
        finalRelative = path.relative(portoStaticDir, resolvedAbsPath);
      }
      return finalRelative.replace(/\\/g, "/"); // Convert Windows backslashes to forward slashes for URLs
    }

    // File not found at all
    throw new Error(
      `Asset file not found on disk: "${primaryPath}". Please ensure the file exists inside your "static" directory.`,
    );
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

    const enrichItems = (items, depth = 0) => {
      return items.map((item) => {
        if (item.type === "category") {
          // Find index/README in this category's children to use as the category landing page
          const rootIndexPos = item.items
            ? item.items.findIndex((subItem) => {
                if (subItem.type !== "doc") return false;
                const id = subItem.id.toLowerCase();
                return (
                  id.endsWith("/readme") ||
                  id.endsWith("/index") ||
                  id === "readme" ||
                  id === "index"
                );
              })
            : -1;

          if (rootIndexPos !== -1 && !item.link) {
            // Turn this category into a link to its index doc and remove the redundant doc item!
            const rootDoc = item.items.splice(rootIndexPos, 1)[0];
            item.link = { type: "doc", id: rootDoc.id };
          } else if (!item.link && depth === 0 && item.label === "Docs") {
            // Fallback for root Docs category if no index is present
            item.link = { type: "generated-index", slug: "/" };
          }

          if (item.items) {
            item.items = enrichItems(item.items, depth + 1);
          }
          if (item.link && item.link.type === "doc") {
            const doc = args.docs.find((d) => d.id === item.link.id);
            if (doc && doc.frontMatter) {
              item.customProps = {
                ...item.customProps,
                icon: doc.frontMatter.icon,
                color: doc.frontMatter.color,
                description:
                  doc.frontMatter.description ?? doc.description ?? undefined,
              };
            }
          }
        } else if (item.type === "doc") {
          const doc = args.docs.find((d) => d.id === item.id);

          if (doc && doc.frontMatter) {
            item.customProps = {
              ...item.customProps,
              icon: doc.frontMatter.icon,
              color: doc.frontMatter.color,
            };

            // Force hide the root index/README from the sidebar list (since it acts as the category link)
            const lowerId = item.id.toLowerCase();
            if (depth === 0 && (lowerId === "index" || lowerId === "readme")) {
              item.className = item.className
                ? item.className + " sidebar-item-hidden"
                : "sidebar-item-hidden";
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
      const indexNames = [
        "index.mdx",
        "index.md",
        "Index.mdx",
        "Index.md",
        "README.mdx",
        "README.md",
        "Readme.mdx",
        "Readme.md",
        "readme.mdx",
        "readme.md",
      ];
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
        if (pathParts.length === 1) {
          finalSlug = currentRoutePath;
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
