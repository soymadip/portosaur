import fs from "node:fs";
import path from "node:path";

/**
 * Shared route-dump logic for the golden URL snapshots (§7).
 *
 * Walks a built site directory and returns every HTML page as a route with
 * its <title> and headings. Used by tests/capture-golden.ts to record the
 * Docusaurus goldens and by tests/url-snapshot.ts to diff the Astro build
 * against them.
 */

export interface GoldenRoute {
  url: string;
  title: string | null;
  headings: string[];
}

/**
 * Derive the published URL for a built HTML file.
 */
export function htmlFileToUrl(buildDir: string, filePath: string): string {
  let rel = path.relative(buildDir, filePath).split(path.sep).join("/");

  if (rel === "index.html") {
    return "/";
  }
  if (rel.endsWith("/index.html")) {
    return `/${rel.slice(0, -"index.html".length)}`;
  }
  return `/${rel}`;
}

/**
 * Decode the HTML entities renderers emit in titles and headings, and strip
 * zero-width characters (Docusaurus appends a zero-width space inside
 * heading anchor links; Astro does not). The snapshot compares *content*,
 * not renderer artifacts — both sides are normalized the same way.
 */
function decodeText(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&#X27;/g, "'")
    .replace(/[\u200b\u200c\u200d\ufeff]/g, "");
}

/**
 * Extract the <title> and h1/h2 headings from an HTML file.
 */
export function extractPageMeta(filePath: string): {
  title: string | null;
  headings: string[];
} {
  const html = fs.readFileSync(filePath, "utf8");

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? decodeText(titleMatch[1].replace(/<[^>]+>/g, "").trim())
    : null;

  const headings: string[] = [];
  for (const match of html.matchAll(/<h([12])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const text = decodeText(match[2].replace(/<[^>]+>/g, "").trim());
    if (text) {
      headings.push(text);
    }
  }

  return { title, headings };
}

/**
 * Dump every HTML route in a build directory, sorted by URL.
 */
export function dumpRoutes(buildDir: string): GoldenRoute[] {
  const routes: GoldenRoute[] = [];

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".html")) {
        const url = htmlFileToUrl(buildDir, full);
        const { title, headings } = extractPageMeta(full);
        routes.push({ url, title, headings });
      }
    }
  }

  walk(buildDir);
  routes.sort((a, b) => a.url.localeCompare(b.url));
  return routes;
}
