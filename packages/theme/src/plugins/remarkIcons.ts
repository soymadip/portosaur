/**
 * remarkIconsPlugin
 *
 * Turns `:prefix:name:` icon shortcodes in text nodes into `<Icon>` MDX
 * elements, e.g. `:si:github:` → `<Icon id="si:github" />`. A space after
 * the shortcode becomes an `addSpace` attribute (the space itself is
 * consumed so it does not double up with the icon's own spacing).
 *
 * Ported from `remarkIcons.cjs` (Phase 2): logic verbatim, ESM imports.
 */

import type { RemarkPlugin } from "@astrojs/markdown-remark";
import { getPrefixRegex } from "../utils/iconPrefixes.ts";

function visit(
  tree: any,
  type: string,
  visitor: (node: any, index: number, parent: any) => number | void,
): void {
  function walk(node: any, index: number | null, parent: any): number | void {
    if (node.type === type) {
      const result = visitor(node, index as number, parent);
      if (typeof result === "number") {
        return result;
      }
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        const result = walk(node.children[i], i, node);
        if (typeof result === "number") {
          i = result - 1; // Adjust index based on what visitor returns
        }
      }
    }
  }
  walk(tree, null, null);
}

const prefixRegexString = getPrefixRegex();

export default function remarkIconsPlugin(): RemarkPlugin {
  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      const regex = new RegExp(
        `:(${prefixRegexString}):([a-zA-Z0-9-_]+):`,
        "g",
      );

      const matches = [...node.value.matchAll(regex)];
      if (matches.length === 0) {
        return;
      }

      const newNodes: any[] = [];
      let lastIndex = 0;

      for (const match of matches) {
        // `matchAll` always sets `index`; the `?? 0` is only for the type.
        const matchIndex = match.index ?? 0;
        if (matchIndex > lastIndex) {
          let betweenText = node.value.slice(lastIndex, matchIndex);
          newNodes.push({
            type: "text",
            value: betweenText,
          });
        }

        const prefix = match[1];
        const iconName = match[2];
        const fullId = `${prefix}:${iconName}`;

        let hasTrailingSpace = false;
        const nextIndex = matchIndex + match[0].length;
        if (node.value[nextIndex] === " ") {
          hasTrailingSpace = true;
        }

        const attributes = [
          {
            type: "mdxJsxAttribute",
            name: "id",
            value: fullId,
          },
        ];

        if (hasTrailingSpace) {
          attributes.push({
            type: "mdxJsxAttribute",
            name: "addSpace",
            value: "true",
          });
        }

        newNodes.push({
          type: "mdxJsxTextElement",
          name: "Icon",
          attributes,
          children: [],
        });

        lastIndex = nextIndex;

        if (hasTrailingSpace) {
          lastIndex++; // skip the space!
        }
      }

      if (lastIndex < node.value.length) {
        newNodes.push({
          type: "text",
          value: node.value.slice(lastIndex),
        });
      }

      parent.children.splice(index, 1, ...newNodes);

      return index + newNodes.length;
    });
  };
}
