// Hoists a doc page's first H1 out of the content and into the page
// title slot, so the heading sits above the panel hairline on every
// page. Docusaurus's `contentTitle` rule (the first heading, when it
// is depth 1): the title is stashed on the vfile and the H1 is removed
// from the content.
//
// Ported from the Astro app (`packages/app/src/plugins/
// remarkContentTitle.ts`). The Astro version stashed the title at
// `file.data.astro.frontmatter` for `remarkPluginFrontmatter`. Here it
// goes to `file.data[CONTENT_TITLE_KEY]` and reaches the page through
// Fumadocs' `mdxOptions.valueToExport` (see `mdx.ts`), which exports
// it from the compiled MDX module — the page reads it from
// `page.data._exports`. Frontmatter comes from
// `file.data.frontmatter`, which fumadocs-mdx sets on the vfile.
//
// Why a remark plugin: the title has to leave the content tree —
// rendering it in the header panel AND leaving it in the content
// would show it twice, and the TOC is exported by rehypeToc, which
// runs after the remark stage, so a rehype removal would also erase
// the title from the TOC.
//
// The stashed slug is computed with `github-slugger`, the same
// package Fumadocs' remarkHeading uses, on a fresh instance: the
// title H1 is the first heading, so its slug has no dedupe suffix and
// matches what remarkHeading would have assigned it. One consequence
// of the removal: if a later heading shared the H1's text, that
// heading's slug loses its `-1` suffix (remarkHeading never sees the
// H1), so a hardcoded `#slug-1` link to such a heading would break.
// The TOC is generated from the same headings, so it stays consistent.
//
// Thematic breaks: Docusaurus's contentTitle plugin stops at the
// first thematic break, but Portosaur's title rule has always been
// "first heading iff depth 1" (see `lib/docPage.ts`) — a leading rule
// should not change the page's title, so the break is ignored here
// too, deliberately.
//
// The text extraction mirrors the heading collector's rules: text and
// inline-code values are concatenated, `{frontmatter.x}` expressions
// resolve against the file's frontmatter, other expressions
// contribute their source, and raw HTML, images and other nodes
// contribute nothing.
import Slugger from "github-slugger";

/** The vfile data key the hoisted title is stashed under. */
export const CONTENT_TITLE_KEY = "__portoContentTitle";

/** A hoisted content title: the H1's plain text and its heading slug. */
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
 * The plain text of a heading node (see the module header).
 */
function headingText(
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

export default function remarkContentTitle() {
  return (tree: any, file: any) => {
    // Without a file there is nowhere to stash the title, so the
    // tree is left untouched (unified always passes a vfile when
    // processing, so this only guards direct test calls).
    if (!file) {
      return;
    }
    const children = tree.children ?? [];
    // The first heading in document order — top-level only, like
    // Docusaurus (a heading nested in a blockquote or list is
    // content, not the page title).
    const index = children.findIndex((node: any) => node.type === "heading");
    if (index === -1) {
      return;
    }
    const heading = children[index];
    if (heading.depth !== 1) {
      return;
    }
    const frontmatter = file.data?.frontmatter;
    // Portosaur content is MDX-only, so an unknown file is treated
    // as MDX (no `{` escaping in the title text).
    const history = file.history?.[0];
    const isMdx = history ? history.endsWith(".mdx") : true;
    const text = headingText(heading, frontmatter, isMdx);
    // An empty H1 contributes no title: remove it, but stash
    // nothing, so the page falls back to its synthetic title.
    if (text.trim() !== "") {
      const slug = new Slugger().slug(text);
      file.data ??= {};
      file.data[CONTENT_TITLE_KEY] = { text, slug };
    }
    children.splice(index, 1);
  };
}
