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
export function generatePvHash(slug, mode, activeIndex = 0) {
  if (!slug) return "";
  let hash = `${slug}-pv`;
  const params = [];
  if (activeIndex > 0) {
    params.push(`t=${activeIndex + 1}`);
  }
  if (mode && mode !== "popup") {
    params.push(`m=${mode}`);
  }
  if (params.length > 0) {
    hash += `?${params.join("&")}`;
  }
  return hash;
}

export function parsePvHash(hash) {
  if (!hash) return null;
  const cleanHash = hash.replace("#", "");

  const match = cleanHash.match(/^(.+)-pv(?:$|\?(.*))$/);
  if (!match) return null;

  const baseSlug = match[1];
  const queryString = match[2];

  let tabNum = 1;
  let mode = "popup";

  if (queryString) {
    const searchParams = new URLSearchParams(queryString);
    const tVal = searchParams.get("t");
    if (tVal) {
      const parsedTab = parseInt(tVal, 10);
      if (!isNaN(parsedTab)) tabNum = parsedTab;
    }
    const mVal = searchParams.get("m");
    if (mVal === "popup" || mVal === "dock" || mVal === "pip") {
      mode = mVal;
    }
  }

  return { slug: baseSlug, tabNum, mode };
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
