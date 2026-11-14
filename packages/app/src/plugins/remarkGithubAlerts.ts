/**
 * remarkGithubAlerts
 *
 * Turns GitHub-flavoured alerts — a blockquote whose first line is a
 * `[!NOTE]` / `[!TIP]` / `[!IMPORTANT]` / `[!WARNING]` / `[!CAUTION]`
 * marker — into the same callout `<div>`s the Docusaurus admonitions
 * plugin emits, so both syntaxes share the admonition styling:
 *
 *   > [!NOTE] Custom title
 *   > Body text…
 *
 * becomes:
 *
 *   <div class="admonition admonition-info">
 *     <div class="admonition-heading">Custom title</div>
 *     <div class="admonition-content">…body…</div>
 *   </div>
 *
 * Text after the marker on the same line becomes the alert's title
 * (plain text — inline formatting is flattened); with no text after
 * the marker, the type's default title is used ("Note", "Tip",
 * "Important", "Warning", "Caution").
 *
 * The marker maps to the admonition type whose colour matches
 * GitHub's, not the same-named Docusaurus type: GitHub NOTE is blue
 * (Docusaurus `note` is grey), and GitHub CAUTION is red
 * (Docusaurus `caution` is orange). So NOTE → info, TIP → tip,
 * IMPORTANT → important (purple), WARNING → warning, CAUTION →
 * danger. A `:::note` block and a `[!NOTE]` alert therefore look
 * different, exactly as they do on Docusaurus and GitHub.
 *
 * Only an uppercase marker on the blockquote's FIRST line converts
 * (GitHub's rule); a marker anywhere else, or lowercase, stays a
 * plain blockquote.
 *
 * No `: RemarkPlugin` annotation (unlike remarkAdmonitions): the
 * annotation types the factory as returning a unified Plugin, which
 * makes a direct call fail typecheck (`this: Processor` required)
 * — and the tests invoke the plugin directly, as remarkImageSrc's
 * do. mdx.ts takes the plugin into an `any[]` list, so nothing is
 * lost.
 */

/** GitHub alert keyword → [admonition class suffix, default title]. */
const ALERT_TYPES: Record<string, [string, string]> = {
  NOTE: ["info", "Note"],
  TIP: ["tip", "Tip"],
  IMPORTANT: ["important", "Important"],
  WARNING: ["warning", "Warning"],
  CAUTION: ["danger", "Caution"],
};

const MARKER_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/;

/** Minimal recursive AST walker (no external dep, matches remarkIcons pattern). */
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

function divElement(className: string, children: any[]): any {
  return {
    type: "mdxJsxFlowElement",
    name: "div",
    attributes: [
      {
        type: "mdxJsxAttribute",
        name: "className",
        value: className,
      },
    ],
    children,
  };
}

/** Plain text of an inline node (formatting flattened; links give their text). */
function plainText(node: any): string {
  if (node.type === "text" || node.type === "inlineCode") {
    return node.value ?? "";
  }
  if (node.type === "image") {
    return node.alt ?? "";
  }
  if (node.children) {
    return node.children.map(plainText).join("");
  }
  return "";
}

/**
 * Extract the alert type and title from a blockquote's first
 * paragraph, removing the marker line's title text from the
 * paragraph as it goes. Returns null when the paragraph doesn't
 * start with an alert marker.
 *
 * The title is the marker line's remainder: it may span several
 * inline nodes (`> [!WARNING] A **bold** title`), and ends at the
 * first soft line break (`\n` inside a text value) or the end of
 * the paragraph's inline content. Everything after that break stays
 * in the body.
 */
function extractAlert(paragraph: any): { type: string; title: string } | null {
  const first = paragraph.children?.[0];
  if (!first || first.type !== "text") {
    return null;
  }
  const match = MARKER_RE.exec(first.value);
  if (!match) {
    return null;
  }
  const [admonitionType, defaultTitle] = ALERT_TYPES[match[1]];

  // Collect the title from the marker line, consuming nodes as we go.
  let title = "";
  // First text node: everything after the marker, up to the line break.
  let rest = first.value.slice(match[0].length);
  const newline = rest.indexOf("\n");
  if (newline !== -1) {
    title = rest.slice(0, newline);
    // The body starts after the break; keep the rest of this node.
    first.value = rest.slice(newline + 1);
    if (first.value === "") {
      paragraph.children.splice(0, 1);
    }
  } else {
    title = rest;
    // No break in this node: the title continues into later siblings
    // on the same line. Consume them until a line break or the end.
    paragraph.children.splice(0, 1);
    while (paragraph.children.length > 0) {
      const next = paragraph.children[0];
      if (next.type === "text") {
        const breakAt = next.value.indexOf("\n");
        if (breakAt !== -1) {
          title += next.value.slice(0, breakAt);
          next.value = next.value.slice(breakAt + 1);
          if (next.value === "") {
            paragraph.children.splice(0, 1);
          }
          break;
        }
        title += next.value;
        paragraph.children.splice(0, 1);
      } else {
        // Formatted inline node (strong, emphasis, link, …) — its
        // text belongs to the title; it can't hold a line break.
        title += plainText(next);
        paragraph.children.splice(0, 1);
      }
    }
  }

  title = title.trim();
  return {
    type: admonitionType,
    title: title === "" ? defaultTitle : title,
  };
}

export default function remarkGithubAlertsPlugin() {
  return (tree: any) => {
    visit(tree, "blockquote", (node, index, parent) => {
      const firstParagraph = node.children?.[0];
      if (!firstParagraph || firstParagraph.type !== "paragraph") {
        return;
      }
      const alert = extractAlert(firstParagraph);
      if (!alert) {
        return;
      }

      // Drop the first paragraph if the marker line was all it held.
      if (
        firstParagraph.children.length === 0 ||
        firstParagraph.children.every(
          (child: any) => child.type === "text" && child.value === "",
        )
      ) {
        node.children.splice(0, 1);
      }

      const heading = divElement("admonition-heading", [
        { type: "text", value: alert.title },
      ]);
      const content = divElement("admonition-content", node.children || []);

      const admonition = divElement(`admonition admonition-${alert.type}`, [
        heading,
        content,
      ]);

      parent.children.splice(index, 1, admonition);

      return index + 1;
    });
  };
}
