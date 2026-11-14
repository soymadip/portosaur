import fs from "fs";
import path from "path";
import { text } from "../app.mjs";

/**
 * Gets the standardized path to the hidden Portosaur data directory.
 * @param {string} siteDir - The project root directory.
 * @returns {string} The resolved path.
 */
export function getPortoDotDir(siteDir) {
  return path.join(siteDir, ".portosaur");
}

/**
 * Loads a package.json file from a directory.
 * @param {string} dir - The directory to look in.
 * @returns {Object} The parsed package.json or an empty object if not found or invalid.
 */
export function loadPkg(dir) {
  try {
    const pkgPath = path.resolve(dir, "package.json");

    if (!fs.existsSync(pkgPath)) {
      return {};
    }

    return JSON.parse(fs.readFileSync(pkgPath, "utf8")) || {};
  } catch {
    return {};
  }
}

/**
 * Recursively copies a directory while performing variable replacements in text files.
 * @param {string} src - Source directory path.
 * @param {string} dest - Destination directory path.
 * @param {Record<string, string>} [replacements={}] - Map of {{key}} to replacement values.
 * @param {string[]} [ignores=[]] - List of file names or relative paths to skip.
 * @param {string} [_baseSrc=src] - Internal tracking of the root source path.
 */
export function mirrorSync(
  src,
  dest,
  replacements = {},
  ignores = [],
  _baseSrc = src,
) {
  const ignoreSet = new Set(ignores);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);

    // Rename gitignore to .gitignore on copy
    const targetName = entry.name === "gitignore" ? ".gitignore" : entry.name;
    const destPath = path.join(dest, targetName);
    const relativePath = path.relative(_baseSrc, srcPath);

    if (ignoreSet.has(entry.name) || ignoreSet.has(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      mirrorSync(srcPath, destPath, replacements, ignores, _baseSrc);
    } else {
      const ext = path.extname(entry.name).toLowerCase();

      if (Object.keys(replacements).length > 0 && text.extensions.has(ext)) {
        let content = fs.readFileSync(srcPath, "utf8");

        for (const [key, value] of Object.entries(replacements)) {
          content = content.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, "g"),
            value,
          );
        }

        fs.writeFileSync(destPath, content);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}
