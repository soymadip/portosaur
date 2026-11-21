/**
 * remarkMermaid
 *
 * Renders ```mermaid fences to inline SVG at build time with Pele
 * (decision 27: Pele renders Mermaid syntax, NOT mermaid.js — zero
 * client JS, the SVG is in the HTML). Each fence becomes a
 * `<Diagram svg="..."/>` element — a real JSX node, since the MDX
 * compiler rejects raw HTML nodes. Gated on `site.markdown.mermaid`
 * via the plugin list in mdx.ts.
 *
 * A fence whose diagram type Pele doesn't know (ZenUML, external
 * plugins) or that fails to parse stays a plain code block, with a
 * build warning — a bad diagram never breaks the build.
 *
 * Icons in labels (`fa:fa-car`) resolve through Portosaur's Iconify
 * packs. Mermaid's FontAwesome names carry the `fa-` prefix
 * (`fa-car`); Iconify's fa7-solid pack uses bare names (`car`), so
 * the prefix is stripped before lookup. Math (`$$...$$`) labels
 * show raw TeX: KaTeX needs a DOM to measure expressions, and
 * there is none at build time.
 */

import { render, supports, PeleError } from "pele";
import { getIconSvg } from "../lib/icon-data.ts";

function visit(
  tree: any,
  type: string,
  visitor: (node: any, index: number, parent: any) => void,
): void {
  function walk(node: any, index: number | null, parent: any): void {
    if (node.type === type) {
      visitor(node, index as number, parent);
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], i, node);
      }
    }
  }
  walk(tree, null, null);
}

/** The site's font stacks, matching `--font-sans` / `--font-mono`
 * in css/global.css. Pele measures labels against these, and the
 * `.pele` rule sets the same stacks in CSS so the labels fit. */
const FONT_FAMILY =
  '"Geist Variable", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
const FONT_FAMILY_MONO =
  '"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

/** Available width in pixels for the layout. Below Pele's 640px
 * breakpoint, wide diagrams switch to a vertical layout instead of
 * shrinking to nothing on a phone — 480px is phone-ish, while
 * diagrams narrower than that stay horizontal. */
const MAX_WIDTH = 480;

const iconCache = new Map<string, string | undefined>();

/** An icon name from a diagram (`fa:fa-car`) as inline SVG markup
 * for Pele, or undefined when the icon isn't in the packs. No
 * width/height on the element: Pele wraps it in its own sized
 * `<svg>`, and a fixed size would stop it scaling to the label. */
function resolveDiagramIcon(name: string): string | undefined {
  if (iconCache.has(name)) {
    return iconCache.get(name);
  }
  let id = name;
  const [prefix, iconName] = name.split(":");
  if (
    (prefix === "fa" || prefix === "fas" || prefix === "fa7-solid") &&
    iconName?.startsWith("fa-")
  ) {
    id = `${prefix}:${iconName.slice(3)}`;
  }
  const svg = getIconSvg(id);
  const markup = svg
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${svg.viewBox}">${svg.body}</svg>`
    : undefined;
  iconCache.set(name, markup);
  return markup;
}

export default function remarkMermaid() {
  return (tree: any, file: any) => {
    // Unique per diagram on the page (Sankey gradients share IDs
    // otherwise). Letters, digits, `-` and `_` only.
    let count = 0;
    visit(tree, "code", (node, index, parent) => {
      if (node.lang?.toLowerCase() !== "mermaid") {
        return;
      }
      const source = node.value ?? "";
      if (!supports(source)) {
        file.message(
          "Portosaur: unsupported mermaid diagram type — the fence is left as a plain code block. " +
            "ZenUML and external Mermaid plugins are not supported.",
          node,
        );
        return;
      }
      count += 1;
      try {
        const { svg } = render(source, {
          idPrefix: `pele-${count}`,
          maxWidth: MAX_WIDTH,
          fontFamily: FONT_FAMILY,
          fontFamilyMono: FONT_FAMILY_MONO,
          icons: resolveDiagramIcon,
        });
        parent.children[index] = {
          type: "mdxJsxFlowElement",
          name: "Diagram",
          attributes: [
            {
              type: "mdxJsxAttribute",
              name: "svg",
              value: svg,
            },
          ],
          children: [],
        };
      } catch (error) {
        if (error instanceof PeleError) {
          file.message(
            `Portosaur: the mermaid diagram could not be rendered (${error.code}: ${error.message}). ` +
              "The fence is left as a plain code block.",
            node,
          );
          return;
        }
        throw error;
      }
    });
  };
}
