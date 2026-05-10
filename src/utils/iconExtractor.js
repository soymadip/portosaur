const fs = require("fs");
const path = require("path");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const { iconMap } = require("../config/iconMappings");

/// AI Generated

/**
 * Dynamically requires a React Icon
 * @param {string} iconPath - Path in format "package/IconName" (e.g., "ai/AiFillAlert")
 * @returns {Object|null} The icon component or null if not found
 */
function requireDynamicIcon(iconPath) {
  try {
    const [packageName, iconName] = iconPath.split("/");

    if (packageName && iconName) {
      const iconPackage = require(`react-icons/${packageName}`);
      return iconPackage[iconName];
    }
    return null;
  } catch (error) {
    console.error(`Failed to import icon ${iconPath}:`, error.message);
    return null;
  }
}

/**
 * Cleans SVG string to create a properly formatted standalone SVG file
 * @param {string} svgString - The SVG string from ReactDOMServer
 * @param {string} color - The color to apply to the SVG
 * @returns {string} Clean SVG content
 */
function cleanSvgString(svgString, color) {
  // Remove React-specific attributes and add proper XML declaration
  let cleanedSvg = svgString
    .replace(/<!--.*?-->/g, "") // Remove comments
    .replace(/stroke="currentColor"/g, `stroke="${color}"`)
    .replace(/fill="currentColor"/g, `fill="${color}"`);

  // Add XML declaration if not present
  if (!cleanedSvg.includes("<?xml")) {
    cleanedSvg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n${cleanedSvg}`;
  }

  // Add viewBox if not present
  if (!cleanedSvg.includes("viewBox")) {
    cleanedSvg = cleanedSvg.replace("<svg", '<svg viewBox="0 0 24 24"');
  }

  return cleanedSvg;
}

/**
 * Extracts SVG content from a React Icon component and saves it to a file
 *
 * @param {React.ComponentType|string} icon - Icon component, name from iconMap, or path like "ai/AiFillAlert"
 * @param {string} outputPath - Path to save the SVG file, defaults to static/img/svg if not provided
 * @param {object} options - Additional options
 * @param {string} options.color - Icon color (default: 'white')
 * @param {number} options.size - Icon size (default: 24)
 * @param {string} options.filename - Override filename (default: icon-<name>.svg)
 * @param {string} options.iconName - Specify icon name instead of using component name
 * @returns {string} The path to the saved SVG file
 */
function extractSvg(icon, outputPath = null, options = {}) {
  // Default output path
  if (!outputPath) {
    outputPath = path.join(
      path.resolve(__dirname, "../.."),
      "static",
      "img",
      "svg",
    );
  }

  // Ensure the base output directory exists
  const baseOutputDir =
    typeof outputPath === "string" && !path.extname(outputPath)
      ? outputPath
      : path.dirname(outputPath);

  if (!fs.existsSync(baseOutputDir)) {
    fs.mkdirSync(baseOutputDir, { recursive: true });
    console.log(`[INFO] Created directory: ${baseOutputDir}`);
  }

  // Resolve icon component
  let IconComponent = icon;
  let iconIdentifier = null;

  if (typeof icon === "string") {
    if (icon.includes("/")) {
      // ("ai/AiFillAlert")
      IconComponent = requireDynamicIcon(icon);
      iconIdentifier = icon.split("/")[1];
    } else {
      // Icon from the iconMap
      IconComponent = iconMap[icon.toLowerCase()]?.icon;
      iconIdentifier = icon;
    }

    if (!IconComponent) {
      throw new Error(`Icon "${icon}" could not be resolved`);
    }

    // Use identifier if iconName not specified
    if (!options.iconName && iconIdentifier) {
      options.iconName = iconIdentifier;
    }
  }

  const {
    color = "white",
    size = 24,
    filename = null,
    iconName = null,
  } = options;

  // Determine final output path
  const pathStats = fs.existsSync(outputPath) ? fs.statSync(outputPath) : null;
  const isDirectory = pathStats ? pathStats.isDirectory() : false;

  if (isDirectory || filename) {
    const baseDir = isDirectory ? outputPath : path.dirname(outputPath);

    // Create directory if needed
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }

    // Generate filename if not provided
    const componentName = iconName || IconComponent.name;
    const finalFilename = filename || `icon-${componentName}.svg`;
    outputPath = path.join(baseDir, finalFilename);
  }

  // Create and render the icon
  const element = React.createElement(IconComponent, {
    color,
    size,
    style: { color },
  });

  // Render the React element to an HTML string and clean it
  const svgString = ReactDOMServer.renderToStaticMarkup(element);
  const cleanedSvg = cleanSvgString(svgString, color);

  // Ensure final output path exists
  const finalDir = path.dirname(outputPath);

  if (!fs.existsSync(finalDir)) {
    fs.mkdirSync(finalDir, { recursive: true });
  }

  // Write to file
  fs.writeFileSync(outputPath, cleanedSvg);
  console.log(`[INFO] Generated SVG icon: ${outputPath}`);

  return outputPath;
}

module.exports = { extractSvg, iconMap };
