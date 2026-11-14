import fs from "fs";
import path from "path";

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
