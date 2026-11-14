// Hoists a doc page's first H1 out of the content and into the page
// title slot, so the heading sits above the panel hairline on every
// page. Docusaurus's `contentTitle` rule (the first heading, when it
// is depth 1): the title is stashed for the page via
// `remarkPluginFrontmatter` and the H1 is removed from the content.
//
// Why a remark plugin: the title has to leave the content tree —
// rendering it in the header panel AND leaving it in the content
// would show it twice, and Astro's `render()` headings are computed
// by `rehypeHeadingIds`, which runs after every user rehype plugin,
// so a rehype removal would also erase the title from the headings
// array. The frontmatter stash is the only channel back to the page.
//
// The stashed slug is computed with `github-slugger`, the same
// package Astro's collector uses, on a fresh instance: the title H1
// is the first heading, so its slug has no dedupe suffix and matches
// what the collector would have assigned it. One consequence of the
// removal: if a later heading shared the H1's text, that heading's
// slug loses its `-1` suffix (the collector never sees the H1), so a
// hardcoded `#slug-1` link to such a heading would break. The TOC is
// generated from the same headings, so it stays consistent.
//
// Thematic breaks: Docusaurus's contentTitle plugin stops at the
// first thematic break, but Portosaur's title rule has always been
// "first heading iff depth 1" (see `docPageTitles`) — a leading rule
// should not change the page's title, so the break is ignored here
// too, deliberately.
//
// The text extraction mirrors Astro's `rehypeHeadingIds` collector
// (`@astrojs/markdown-remark`): text and inline-code values are
// concatenated, `{frontmatter.x}` expressions resolve against the
// file's frontmatter, other expressions contribute their source, and
// raw HTML, images and other nodes contribute nothing.
import Slugger from "github-slugger";

/** The `remarkPluginFrontmatter` key the hoisted title is stashed under. */
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
 * `frontmatter` prefix — a port of Astro's
 * `getMdxFrontmatterVariablePath` in `rehype-collect-headings`.
 * Returns null for anything that is not a plain `frontmatter.*`
 * member chain.
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
 * `frontmatter.*` path resolves against the frontmatter (Astro's
 * collector does the same for its heading text); anything else
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
 * The plain text of a heading node, mirroring Astro's
 * `rehypeHeadingIds` collector (see the module header).
 */
function headingText(
  heading: any,
  frontmatter: unknown,
  isMdx: boolean,
): string {
  let text = "";
  const visit = (node: any) => {
    if (node.type === "text" || node.type === "inlineCode") {
      // Non-MDX files escape `{` as `${` in heading text (Astro's
      // collector does the same); code spans are never escaped.
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
    const frontmatter = file.data?.astro?.frontmatter;
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
      file.data.astro ??= {};
      file.data.astro.frontmatter ??= {};
      file.data.astro.frontmatter[CONTENT_TITLE_KEY] = { text, slug };
    }
    children.splice(index, 1);
  };
}
