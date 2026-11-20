/**
 * Build-time icon data — the installed `@iconify-json` packs,
 * rendered with `@iconify/utils`. Build time only: the packs are
 * megabytes of JSON, so only the icon scan and the remark plugins
 * import this. Components render from the generated per-site map.
 */

import { getIconData, iconToSVG } from "@iconify/utils";
import type { IconifyJSON } from "@iconify/types";
// The `with { type: "json" }` attributes are load-bearing: the scan
// script runs under plain node, which refuses JSON imports without them.
import lucideIcons from "@iconify-json/lucide/icons.json" with { type: "json" };
import octiconIcons from "@iconify-json/octicon/icons.json" with { type: "json" };
import simpleIcons from "@iconify-json/simple-icons/icons.json" with { type: "json" };
import logosIcons from "@iconify-json/logos/icons.json" with { type: "json" };
import mdiIcons from "@iconify-json/mdi/icons.json" with { type: "json" };
import lineMdIcons from "@iconify-json/line-md/icons.json" with { type: "json" };
import deviconIcons from "@iconify-json/devicon/icons.json" with { type: "json" };
import streamlineIcons from "@iconify-json/streamline-sharp/icons.json" with { type: "json" };
import fa7SolidIcons from "@iconify-json/fa7-solid/icons.json" with { type: "json" };

import { getPrefixMap } from "./iconPrefixes.ts";
import { normalizeIconId, type SiteIconData } from "./site-icons.ts";

const prefixMap = getPrefixMap();

const collections: Record<string, IconifyJSON> = {
  lucide: lucideIcons,
  octicon: octiconIcons,
  "simple-icons": simpleIcons,
  logos: logosIcons,
  mdi: mdiIcons,
  "line-md": lineMdIcons,
  devicon: deviconIcons,
  "streamline-sharp": streamlineIcons,
  "fa7-solid": fa7SolidIcons,
};

/** An icon's SVG for the site module: its own viewBox (they vary:
 * 24x24, 128x128, wide logos) and its body, verbatim. Null when
 * the id is malformed, unknown, or not in the pack. */
export function getIconSvg(iconId: string): SiteIconData | null {
  const normalized = normalizeIconId(iconId);
  if (!normalized) {
    return null;
  }
  const [prefix, name] = normalized.split(":");
  const collection = collections[prefix];
  if (!collection) {
    return null;
  }
  const iconData = getIconData(collection, name);
  const rendered = iconData ? iconToSVG(iconData) : null;
  const viewBox = rendered?.attributes?.viewBox;
  if (!rendered || !viewBox) {
    return null;
  }
  return { viewBox: String(viewBox), body: rendered.body };
}

/** Whether an icon id exists in its pack (a guess, not an error). */
export function iconExists(iconId: string): boolean {
  const normalized = normalizeIconId(iconId);
  if (!normalized) {
    return false;
  }
  const [prefix, name] = normalized.split(":");
  const collection = collections[prefix];
  return collection ? getIconData(collection, name) !== null : false;
}

/** Whether an icon id's prefix is a known pack (shorthand or canonical). */
export function hasKnownPrefix(iconId: string): boolean {
  const prefix = iconId.split(":")[0];
  return prefix !== undefined && prefixMap[prefix] !== undefined;
}

/** An SVG attribute name as JSX wants it: kebab-case becomes
 * camelCase, except `aria-*` and `data-*`, which stay hyphenated. */
function jsxAttributeName(name: string): string {
  if (name.startsWith("aria-") || name.startsWith("data-")) {
    return name;
  }
  if (name === "xlink:href") {
    return "xlinkHref";
  }
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/** Parses an SVG fragment (`<path .../>`, `<g>…</g>`) into MDX JSX nodes. */
function parseSvgFragment(fragment: string): any[] {
  const nodes: any[] = [];
  const stack: any[] = [];
  const tagPattern = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;
  const pushText = (text: string) => {
    const value = text.trim();
    if (!value) {
      return;
    }
    const node = { type: "text", value };
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      nodes.push(node);
    }
  };
  while ((match = tagPattern.exec(fragment)) !== null) {
    pushText(fragment.slice(lastIndex, match.index));
    lastIndex = match.index + match[0].length;
    const [, name, attrsPart] = match;
    const closing = match[0].startsWith("</");
    const selfClosing = match[0].endsWith("/>");
    if (closing) {
      stack.pop();
      continue;
    }
    const attributes: any[] = [];
    const attrPattern = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)=(?:"([^"]*)"|'([^']*)')/g;
    let attrMatch: RegExpExecArray | null;
    while ((attrMatch = attrPattern.exec(attrsPart)) !== null) {
      attributes.push({
        type: "mdxJsxAttribute",
        name: jsxAttributeName(attrMatch[1]),
        value: attrMatch[2] ?? attrMatch[3] ?? "",
      });
    }
    const node = {
      type: "mdxJsxTextElement",
      name,
      attributes,
      children: [],
    };
    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    } else {
      nodes.push(node);
    }
    if (!selfClosing) {
      stack.push(node);
    }
  }
  pushText(fragment.slice(lastIndex));
  return nodes;
}

/**
 * An icon as an inline `<svg>` JSX node — a real node, not a raw
 * HTML string (the MDX compiler rejects `raw` nodes inside a JSX
 * element). Null when the icon is missing. The caller supplies
 * the attributes; the viewBox and body come from the pack.
 */
export function getIconJsx(
  iconId: string,
  attributes: Record<string, string>,
): any | null {
  const svg = getIconSvg(iconId);
  if (!svg) {
    return null;
  }
  return {
    type: "mdxJsxTextElement",
    name: "svg",
    attributes: [
      ...Object.entries(attributes).map(([name, value]) => ({
        type: "mdxJsxAttribute",
        name,
        value,
      })),
      { type: "mdxJsxAttribute", name: "viewBox", value: svg.viewBox },
    ],
    children: parseSvgFragment(svg.body),
  };
}
