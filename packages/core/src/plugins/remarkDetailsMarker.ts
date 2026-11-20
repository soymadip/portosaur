/**
 * Injects the chevron marker into `<summary>` elements in prose.
 * A `summary` entry in the MDX components map cannot do this —
 * lowercase JSX tags compile literally, so the map never sees
 * them. The marker is the same span the `<Details>` component
 * renders, so both ways of writing a details block look identical.
 * Build time only (it reads the Iconify packs through `lib/icon-data.ts`).
 */

import { getIconJsx } from "../lib/icon-data.ts";

/** The marker node, built once (the chevron never changes). */
function detailsMarker(): any | null {
  const svg = getIconJsx("md:chevron-right", {
    width: "1em",
    height: "1em",
    fill: "currentColor",
    "aria-hidden": "true",
  });
  if (!svg) {
    return null;
  }
  return {
    type: "mdxJsxTextElement",
    name: "span",
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "className",
        value: "porto-details-marker",
      },
      { type: "mdxJsxAttribute", name: "aria-hidden", value: "true" },
    ],
    children: [svg],
  };
}

export default function remarkDetailsMarkerPlugin() {
  const marker = detailsMarker();
  return (tree: any) => {
    const visit = (node: any): void => {
      if (
        marker &&
        (node.type === "mdxJsxTextElement" ||
          node.type === "mdxJsxFlowElement") &&
        node.name === "summary"
      ) {
        const first = node.children?.[0];
        const hasMarker =
          first?.type === "mdxJsxTextElement" &&
          first.name === "span" &&
          first.attributes?.some(
            (attr: any) =>
              attr.name === "className" &&
              attr.value === "porto-details-marker",
          );
        if (!hasMarker) {
          // A fresh copy per summary — the same node object must
          // never sit in two parents.
          node.children = [structuredClone(marker), ...(node.children ?? [])];
        }
      }
      for (const child of node.children ?? []) {
        visit(child);
      }
    };
    visit(tree);
  };
}
