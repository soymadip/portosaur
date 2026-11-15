/**
 * Page-URL helpers shared by the navbar (build time) and the mobile
 * menu's client script — dependency-free, so importing this from a
 * client script stays cheap (unlike `icons.ts`, which drags the
 * Iconify packs in).
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
