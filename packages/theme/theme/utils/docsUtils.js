/**
 * Accurately mimics Docusaurus' internal routing and URL slug generation logic
 *
 * @param {string} filePath - The relative file path to the markdown document (e.g. "python/4 - loops/4.1 - while-loops/index.mdx")
 * @param {object} [frontMatter] - The parsed frontmatter of the markdown file (e.g. { slug: "custom" })
 * @returns {{ slug: string, fileSlug: string }} The computed docSlug exactly as Docusaurus generates it (e.g. { slug: "python/loops/4.1 - while-loops/custom", fileSlug: "python" })
 */
export function guessDocPermalink(filePath, frontMatter) {
  const ignoredPrefixPattern = /^\d+[-_.]\d+/;
  const numberPrefixPattern =
    /^(?<numberPrefix>\d+)\s*[-_.]+\s*(?<suffix>[^-_.\s].*)$/;

  const stripNumberPrefix = (segment) => {
    if (ignoredPrefixPattern.test(segment)) return segment;
    const match = numberPrefixPattern.exec(segment);
    return match ? match.groups.suffix : segment;
  };

  // Initial source parsing
  const cleanPath = filePath.replace(/^\.\//, "");
  const rawPathParts = cleanPath.split("/");

  const fileNameWithExt = rawPathParts[rawPathParts.length - 1];
  const sourceFileNameWithoutExtension = fileNameWithExt.replace(/\.mdx?$/, "");
  const sourceDirNameParts = rawPathParts.slice(0, -1);
  const sourceDirName =
    sourceDirNameParts.length > 0 ? sourceDirNameParts.join("/") : ".";

  // Parse Number Prefix on File Name
  const unprefixedFileName = stripNumberPrefix(sourceFileNameWithoutExtension);

  // Compute baseID
  const baseID = frontMatter?.id ?? unprefixedFileName;

  // Compute dirNameSlug
  const dirNameSlugParts = sourceDirNameParts.map(stripNumberPrefix);
  const resolveDirname =
    sourceDirName === "." ? "/" : "/" + dirNameSlugParts.join("/") + "/";

  // Check if isCategoryIndex (Docusaurus behavior for index docs)
  const directories = [...sourceDirNameParts].reverse();
  const fileNameLower = sourceFileNameWithoutExtension.toLowerCase();
  const isIndex =
    fileNameLower === "index" ||
    fileNameLower === "readme" ||
    (directories.length > 0 && fileNameLower === directories[0].toLowerCase());

  // Compute Slug
  let docSlug = "";

  if (frontMatter?.slug && frontMatter.slug.startsWith("/")) {
    docSlug = frontMatter.slug;
  } else {
    if (!frontMatter?.slug && isIndex) {
      docSlug = resolveDirname;
    } else {
      const baseSlug = frontMatter?.slug ?? baseID;
      docSlug = resolveDirname + baseSlug;
    }
  }

  // Clean up slashes
  docSlug = docSlug.replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");

  // fileSlug for language fallback
  const fileSlug =
    sourceDirNameParts.length > 0 ? dirNameSlugParts[0] : unprefixedFileName;

  return { slug: docSlug, fileSlug };
}
