// The content-title rule, shared by the hoisting plugin and the
// page-tree transformer: the first top-level heading in document
// order, when it is depth 1, is the page's content title. A heading
// nested in a blockquote or list is content, not the title, and an
// empty H1 contributes no title. Both callers must agree on what
// the title is, so the rule lives here once instead of twice.
//
// Pure mdast logic — no Node imports, so the plugin (which runs
// inside the MDX pipeline) and server code can both use it. The
// disk-reading side lives in `content-title-server.ts`.
import Slugger from "github-slugger";

/** A content title: the H1's plain text and its heading slug. */
export interface ContentTitle {
  text: string;
  slug: string;
}

// Keys that must never be walked when resolving a frontmatter path
// (mirrors `@astrojs/internal-helpers` FORBIDDEN_PATH_KEYS).
const FORBIDDEN_PATH_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The variable path of a `frontmatter.*` expression, minus the
 * `frontmatter` prefix. Returns null for anything that is not a plain
 * `frontmatter.*` member chain.
 */
function frontmatterVariablePath(node: any): string[] | null {
  const estree = node.data?.estree;
  if (!estree || estree.body.length !== 1) {
    return null;
  }
  const statement = estree.body[0];
  if (
    statement?.type !== "ExpressionStatement" ||
    statement.expression.type !== "MemberExpression"
  ) {
    return null;
  }
  let expression = statement.expression;
  const path: string[] = [];
  while (
    expression.type === "MemberExpression" &&
    expression.property.type ===
      (expression.computed ? "Literal" : "Identifier")
  ) {
    path.push(
      expression.property.type === "Literal"
        ? String(expression.property.value)
        : expression.property.name,
    );
    expression = expression.object;
  }
  if (expression.type !== "Identifier" || expression.name !== "frontmatter") {
    return null;
  }
  return path.reverse();
}

/**
 * The text an `{expression}` in a heading contributes: a
 * `frontmatter.*` path resolves against the frontmatter. Anything else
 * contributes its source, exactly as the collector does.
 */
function expressionText(node: any, frontmatter: unknown): string {
  const path = frontmatterVariablePath(node);
  if (path && isPlainObject(frontmatter)) {
    let value: unknown = frontmatter;
    for (const key of path) {
      if (
        FORBIDDEN_PATH_KEYS.has(key) ||
        !isPlainObject(value) ||
        !Object.hasOwn(value, key)
      ) {
        value = undefined;
        break;
      }
      value = value[key];
    }
    if (typeof value === "string") {
      return value;
    }
  }
  return node.value ?? "";
}

/**
 * The plain text of a heading node: text and inline-code values are
 * concatenated, `{frontmatter.x}` expressions resolve against the
 * file's frontmatter, other expressions contribute their source, and
 * raw HTML, images and other nodes contribute nothing.
 */
export function headingText(
  heading: any,
  frontmatter: unknown,
  isMdx: boolean,
): string {
  let text = "";
  const visit = (node: any) => {
    if (node.type === "text" || node.type === "inlineCode") {
      // Non-MDX files escape `{` as `${` in heading text. Code spans
      // are never escaped.
      if (!isMdx && node.type === "text") {
        text += node.value.replace(/\{/g, "${");
      } else {
        text += node.value;
      }
      return;
    }
    if (node.type === "mdxTextExpression") {
      text += expressionText(node, frontmatter);
      return;
    }
    for (const child of node.children ?? []) {
      visit(child);
    }
  };
  for (const child of heading.children ?? []) {
    visit(child);
  }
  return text;
}

/**
 * The first top-level heading in document order, when it is depth 1
 * — the heading the title rule hoists. Returns null when the tree
 * has no headings, or when the first heading is H2 or deeper.
 */
export function firstContentHeading(tree: any): {
  index: number;
  heading: any;
} | null {
  const children = tree.children ?? [];
  const index = children.findIndex((node: any) => node.type === "heading");
  if (index === -1) {
    return null;
  }
  const heading = children[index];
  if (heading.depth !== 1) {
    return null;
  }
  return { index, heading };
}

/**
 * The content title a heading carries: its plain text plus the
 * slug remarkHeading would assign it (a fresh slugger, since the
 * title H1 is the first heading and never carries a dedupe suffix).
 * Returns null when the heading's text is empty.
 */
export function contentTitleFromHeading(
  heading: any,
  frontmatter: unknown,
  isMdx: boolean,
): ContentTitle | null {
  const text = headingText(heading, frontmatter, isMdx);
  if (text.trim() === "") {
    return null;
  }
  return { text, slug: new Slugger().slug(text) };
}

/**
 * The content title of a parsed MDX tree, or null when the tree has
 * no title H1. Convenience wrapper over `firstContentHeading` +
 * `contentTitleFromHeading` for callers that do not need the node.
 */
export function extractContentTitle(
  tree: any,
  frontmatter: unknown,
  isMdx: boolean,
): ContentTitle | null {
  const found = firstContentHeading(tree);
  if (!found) {
    return null;
  }
  return contentTitleFromHeading(found.heading, frontmatter, isMdx);
}
