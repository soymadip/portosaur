/**
 * remarkAdmonitions
 *
 * Turns Docusaurus-style admonition directives (`:::tip[Title]` …
 * `:::`) into callout `<div>`s. Runs after `remark-directive`, which
 * parses the fence into a `containerDirective` node with `name` (the
 * type); the bracketed title is NOT a `label` property — it arrives
 * as a leading paragraph child with `data.directiveLabel: true`.
 * That paragraph becomes the heading (its inline children, so
 * formatting in the title survives) and is removed from the body.
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
 *
 * No `: RemarkPlugin` annotation: the annotation types the factory
 * as returning a unified Plugin, which makes a direct call fail
 * typecheck (`this: Processor` required) — and the tests invoke the
 * plugin directly, as remarkImageSrc's do. mdx.ts takes the plugin
 * into an `any[]` list, so nothing is lost.
 */

const DEFAULT_TITLES: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  info: "Info",
  success: "Success",
  warning: "Warning",
  caution: "Caution",
  danger: "Danger",
};

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

export default function remarkAdmonitionsPlugin() {
  return (tree: any) => {
    visit(tree, "containerDirective", (node, index, parent) => {
      const type = node.name || "note";

      // The bracketed title arrives as a leading paragraph with
      // `data.directiveLabel` (remark-directive has no `node.label`
      // — reading it silently fell back to the default title and
      // left the intended title as the body's first line).
      let bodyChildren = node.children || [];
      const first = bodyChildren[0];
      let headingChildren: any[];
      if (first && first.type === "paragraph" && first.data?.directiveLabel) {
        headingChildren = first.children || [];
        bodyChildren = bodyChildren.slice(1);
      } else {
        const title =
          DEFAULT_TITLES[type] || type.charAt(0).toUpperCase() + type.slice(1);
        headingChildren = [{ type: "text", value: title }];
      }

      const heading = divElement("admonition-heading", headingChildren);
      const content = divElement("admonition-content", bodyChildren);

      const admonition = divElement(`admonition admonition-${type}`, [
        heading,
        content,
      ]);

      parent.children.splice(index, 1, admonition);

      return index + 1;
    });
  };
}
