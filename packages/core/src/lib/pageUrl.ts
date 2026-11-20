/**
 * Page-URL helpers shared by the navbar, the sidebar, and the mobile
 * menu — dependency-free, so importing this from a client component
 * stays cheap (unlike `icons.ts`, which drags the Iconify packs in).
 *
 * Ported from the Astro tree (`utils/pageUrl.ts` + the `pageHref`
 * half of `utils/icons.ts`): `pageHref` lives here now, next to the
 * other URL helpers, instead of in the icon module.
 */

/**
 * A pathname with any query/hash stripped and trailing slashes
 * collapsed — `"/docs/guide?tab=1"` and `"/docs/guide/"` both become
 * `"/docs/guide"`, and `"/"` stays `"/"`.
 */
export function normalizePathname(path: string): string {
  const pathname = path.split(/[?#]/)[0] ?? "";
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * Whether a link points at the current page — an exact pathname
 * comparison (VitePress's `preFetch.js` check: `pathname !==
 * location.pathname`). Unlike `active`, which is section-wide (any
 * docs page makes the Docs link active), this is only true for the
 * page itself, so it is the right skip for prefetching: the current
 * page is already open, but a section-active link still needs its
 * destination prefetched. Absolute and protocol-relative URLs never
 * match.
 */
export function isSamePage(href: string, pathname: string): boolean {
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) {
    return false;
  }
  return normalizePathname(href) === normalizePathname(pathname);
}

/**
 * Strips the site base prefix from a browser pathname, so paths can
 * be compared against the base-less hrefs the navbar and sidebar
 * build (Next.js adds `basePath` back for `<Link>` itself). A root
 * base (`"/"`) leaves the path untouched.
 */
export function stripBase(pathname: string, baseUrl = "/"): string {
  const base = baseUrl === "/" ? "" : baseUrl.replace(/\/+$/, "");
  if (!base) {
    return pathname;
  }
  if (pathname === base) {
    return "/";
  }
  if (pathname.startsWith(`${base}/`)) {
    return pathname.slice(base.length);
  }
  return pathname;
}

/** File extensions that mark a URL as an asset, not a page. */
const PAGE_EXCLUDED_EXTENSIONS = new Set([
  "atom",
  "avif",
  "css",
  "eot",
  "gif",
  "gz",
  "html",
  "ico",
  "jpeg",
  "jpg",
  "js",
  "json",
  "md",
  "mjs",
  "mp3",
  "mp4",
  "otf",
  "pdf",
  "png",
  "rss",
  "svg",
  "tar",
  "ttf",
  "txt",
  "webm",
  "webp",
  "woff",
  "woff2",
  "xml",
  "zip",
]);

/**
 * A trailing-slash page URL. Pages are built as `path/index.html`, so
 * the canonical URL ends in `/` — a slash-less link makes the host
 * answer with a 301 redirect to the slashed URL (an extra round-trip
 * on every navigation. Netlify does this, and the sitemap already
 * emits the slashed form). Apply to internal page links only, after
 * `withBase` — never to assets.
 *
 * Absolute URLs, hash links, already-slashed paths, and asset URLs
 * (a known file extension on the last segment) pass through
 * unchanged. A `?query`/`#hash` suffix is preserved after the slash.
 */
export function pageHref(path: string): string {
  if (!path) {
    return path;
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(path)) {
    return path;
  }
  const hashIndex = path.indexOf("#");
  const queryIndex = path.indexOf("?");
  let end = path.length;
  if (hashIndex !== -1) {
    end = Math.min(end, hashIndex);
  }
  if (queryIndex !== -1) {
    end = Math.min(end, queryIndex);
  }
  const pathname = path.slice(0, end);
  const suffix = path.slice(end);
  if (pathname.endsWith("/")) {
    return path;
  }
  const lastSegment = pathname.slice(pathname.lastIndexOf("/") + 1);
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = lastSegment.slice(dotIndex + 1).toLowerCase();
    if (PAGE_EXCLUDED_EXTENSIONS.has(ext)) {
      return path;
    }
  }
  return `${pathname}/${suffix}`;
}
