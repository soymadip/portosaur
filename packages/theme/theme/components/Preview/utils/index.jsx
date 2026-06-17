const TEXT_EXTS = [
  "md",
  "txt",
  "js",
  "ts",
  "jsx",
  "tsx",
  "py",
  "json",
  "css",
  "yaml",
  "yml",
  "sh",
  "toml",
  "rs",
  "go",
  "java",
  "c",
  "cpp",
  "h",
  "html",
  "xml",
  "sql",
  "diff",
  "patch",
];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
export function getExt(path) {
  return (path || "").split(".").pop().toLowerCase().split("?")[0];
}
export function classify(path) {
  if (!path) return "text";
  const ext = getExt(path);
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXTS.includes(ext)) return "image";
  if (TEXT_EXTS.includes(ext)) return "text";
  if (path.startsWith("http")) return "web";
  return "text";
}
export function resolveUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("//")) return path;
  if (typeof window === "undefined") return path;
  return path.startsWith("/") ? path : `/${path}`;
}
export function generatePvSlug(text) {
  return (text || "preview")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
export function generatePvHash(slug, mode) {
  if (!slug) return "";
  return `${slug}:pv-${mode || "popup"}`;
}
export function parsePvHash(hash) {
  if (!hash) return null;
  const cleanHash = hash.replace("#", "");
  if (!cleanHash.includes(":pv-")) return null;
  const parts = cleanHash.split(":pv-");
  const mode = parts.pop();
  return { slug: parts.join("-"), mode };
}

export function extractTextFromChildren(children) {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join("");
  }
  if (
    children &&
    typeof children === "object" &&
    children.props &&
    children.props.children
  ) {
    return extractTextFromChildren(children.props.children);
  }
  return "";
}
