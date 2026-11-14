/**
 * remarkAdmonitions.mjs
 *
 * Turns Docusaurus-style admonition directives (`:::tip[Title]` …
 * `:::`) into callout `<div>`s. Runs after `remark-directive`, which
 * parses the fence into a `containerDirective` node with `name` (the
 * type) and `label` (the bracketed title, if any).
 *
 * Output shape (no heading elements — the title is a plain div, so the
 * URL snapshot's h1/h2 extraction is unaffected):
 *
 *   <div class="admonition admonition-tip">
 *     <div class="admonition-heading">Title</div>
 *     <div class="admonition-content">…body…</div>
 *   </div>
 *
 * Any container directive is converted, not just the known types —
 * unknown names keep their name as the class suffix.
 */

const DEFAULT_TITLES = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  success: "Success",
  warning: "Warning",
  caution: "Caution",
  danger: "Danger",
};

/** Minimal recursive AST walker (no external dep, matches remarkIcons pattern). */
function visit(tree, type, visitor) {
  function walk(node, index, parent) {
    if (node.type === type) {
      const result = visitor(node, index, parent);
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

function divElement(className, children) {
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

export default function remarkAdmonitionsPlugin() {
  return (tree) => {
    visit(tree, "containerDirective", (node, index, parent) => {
      const type = node.name || "note";
      const title =
        node.label ||
        DEFAULT_TITLES[type] ||
        type.charAt(0).toUpperCase() + type.slice(1);

      const heading = divElement("admonition-heading", [
        { type: "text", value: title },
      ]);
      const content = divElement("admonition-content", node.children || []);

      const admonition = divElement(`admonition admonition-${type}`, [
        heading,
        content,
      ]);

      parent.children.splice(index, 1, admonition);

      return index + 1;
    });
  };
}
