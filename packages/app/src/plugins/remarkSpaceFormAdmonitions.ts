/**
 * remarkSpaceFormAdmonitions
 *
 * Turns the MDX v1-style space-form admonition fence (`:::note Title`
 * … `:::`) into the same callout `<div>`s `remarkAdmonitions` emits
 * for the bracket form. Docusaurus supports this form through a
 * string preprocessor (`admonitionTitleToDirectiveLabel` in
 * `@docusaurus/utils`, run by the mdx-loader when
 * `markdown.mdx1Compat.admonitions` is on — the default): it rewrites
 * the opening line to `:::note[Title]` before parsing, so
 * remark-directive sees a normal directive. Astro's pipeline has no
 * string-preprocessing hook, so this plugin does the equivalent work
 * on the parsed tree instead: after remark-directive runs, a
 * space-form fence is still a plain paragraph (micromark's directive
 * tokenizer requires a line ending after the fence — `openAfter`
 * rejects anything else), and this plugin converts those paragraphs.
 *
 * The conversion mirrors Docusaurus's regex
 * (`/^(?<quote>(> ?)*)(?<indentation>( +|\t+))?(?<directive>:{3,}${
 * keywords}) +(?<title>.*)$/gm`, keywords = Docusaurus's default
 * admonition keywords): only known keywords convert, the fence is
 * three or more colons, the closing fence needs at least as many
 * colons as the opening one, and a fence without a closing line is
 * left alone. Two deliberate divergences from Docusaurus: fences
 * inside code blocks are NOT converted (they are `code` nodes here,
 * not paragraphs — Docusaurus's regex rewrites them too, which its
 * own comment calls "good enough"), and titles containing `]` work
 * (Docusaurus's rewrite breaks the label parsing for those).
 *
 * The closing fence may also sit inside a later block — authors
 * often indent it to match a list (`  :::` after the last item),
 * which parses as part of that item's paragraph. Docusaurus's
 * tokenizer claims the line at the line level, so the list is whole
 * inside the directive; this plugin finds the closer nested in the
 * block and keeps the block whole. When a nested closer has further
 * content after it inside its block (a directive closed mid-list),
 * splitting the block is not attempted — the fence is left alone
 * rather than mis-converted.
 *
 * Output shape is identical to remarkAdmonitions:
 *
 *   <div class="admonition admonition-note">
 *     <div class="admonition-heading">Title</div>
 *     <div class="admonition-content">…body…</div>
 *   </div>
 *
 * No `: RemarkPlugin` annotation — see remarkAdmonitions for why.
 */

/** Docusaurus's default admonition keywords (its preprocessor only rewrites these). */
const KEYWORDS = [
  "secondary",
  "info",
  "success",
  "danger",
  "note",
  "tip",
  "warning",
  "important",
  "caution",
];

const DEFAULT_TITLES: Record<string, string> = {
  secondary: "Secondary",
  note: "Note",
  tip: "Tip",
  info: "Info",
  success: "Success",
  warning: "Warning",
  caution: "Caution",
  danger: "Danger",
  important: "Important",
};

const OPENER_RE = new RegExp(`^[ \\t]*(:{3,})(${KEYWORDS.join("|")})[ \\t]+`);

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

function paragraph(children: any[]): any {
  return { type: "paragraph", children };
}

/**
 * Matches a space-form opening fence at the start of a paragraph.
 * Returns the fence length, the type, and how many characters of the
 * first text node the `:::keyword ` prefix occupies — or null when
 * the paragraph does not open one.
 */
function matchOpener(paragraph: any): {
  colons: number;
  type: string;
  prefixLength: number;
} | null {
  const first = paragraph.children?.[0];
  if (!first || first.type !== "text") {
    return null;
  }
  const match = first.value.match(OPENER_RE);
  if (!match) {
    return null;
  }
  return {
    colons: match[1].length,
    type: match[2],
    prefixLength: match[0].length,
  };
}

/**
 * Splits an opening paragraph into its title (the inline nodes
 * between the fence prefix and the first soft break — formatting
 * survives, as it does for bracketed labels) and the body's first
 * inline nodes (everything after that soft break, or nothing when
 * the fence line is the whole paragraph).
 */
function splitOpener(
  paragraph: any,
  prefixLength: number,
): { title: any[]; firstBody: any[] } {
  const title: any[] = [];
  const firstBody: any[] = [];
  let inTitle = true;
  const children = paragraph.children || [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (!inTitle) {
      firstBody.push(child);
      continue;
    }
    if (child.type !== "text") {
      title.push(child);
      continue;
    }
    const value = i === 0 ? child.value.slice(prefixLength) : child.value;
    const newline = value.indexOf("\n");
    if (newline === -1) {
      if (value !== "") {
        title.push(i === 0 ? { ...child, value } : child);
      }
      continue;
    }
    if (newline > 0) {
      title.push({ ...child, value: value.slice(0, newline) });
    }
    const after = value.slice(newline + 1);
    if (after !== "") {
      firstBody.push({ ...child, value: after });
    }
    inTitle = false;
  }
  return { title, firstBody };
}

/**
 * Strips a closing fence line from the end of an inline-children
 * array: the last child must be a text node ending with a line that
 * is only 3+ colons (at least as many as the opener) plus optional
 * trailing space. Returns the stripped children and whether a
 * fence was found.
 */
function stripCloser(
  inlineChildren: any[],
  minColons: number,
): { stripped: any[]; found: boolean } {
  if (inlineChildren.length === 0) {
    return { stripped: inlineChildren, found: false };
  }
  const last = inlineChildren[inlineChildren.length - 1];
  if (last.type !== "text") {
    return { stripped: inlineChildren, found: false };
  }
  const match = last.value.match(/(?:^|\n)(:{3,})[ \t]*$/);
  if (!match || match[1].length < minColons) {
    return { stripped: inlineChildren, found: false };
  }
  const cutAt = match.index ?? 0;
  const stripped = inlineChildren.slice(0, -1);
  if (cutAt > 0) {
    stripped.push({ ...last, value: last.value.slice(0, cutAt) });
  }
  return { stripped, found: true };
}

/**
 * Finds the first paragraph (document order) inside a block that
 * ends with a closing fence line — e.g. the last item of a list
 * whose author indented the `:::` to match. Returns the paragraph
 * and its stripped children, or null.
 */
function findNestedCloser(
  node: any,
  minColons: number,
): { paragraph: any; stripped: any[] } | null {
  if (node.type === "paragraph") {
    const closer = stripCloser(node.children || [], minColons);
    if (closer.found) {
      return { paragraph: node, stripped: closer.stripped };
    }
    return null;
  }
  if (node.children) {
    for (const child of node.children) {
      const found = findNestedCloser(child, minColons);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** Collects a block's descendant paragraphs in document order. */
function collectParagraphs(node: any, out: any[] = []): any[] {
  if (node.type === "paragraph") {
    out.push(node);
  }
  for (const child of node.children ?? []) {
    collectParagraphs(child, out);
  }
  return out;
}

function buildAdmonition(
  type: string,
  title: any[],
  bodyParagraphs: any[],
): any {
  const headingChildren =
    title.length > 0
      ? title
      : [{ type: "text", value: DEFAULT_TITLES[type] || type }];
  return divElement(`admonition admonition-${type}`, [
    divElement("admonition-heading", headingChildren),
    divElement("admonition-content", bodyParagraphs),
  ]);
}

/**
 * Converts a space-form fence starting at `startIndex` in a
 * parent's children (single-paragraph, or spanning later siblings
 * up to the closing fence). Returns true when a fence was found
 * and spliced in as an admonition div.
 */
function convertFrom(
  parent: any,
  startIndex: number,
  opener: { colons: number; type: string; prefixLength: number },
): boolean {
  const children = parent.children;
  const { title, firstBody } = splitOpener(
    children[startIndex],
    opener.prefixLength,
  );
  if (title.length === 0) {
    return false;
  }

  // Single-paragraph case: the closing fence is in the same paragraph.
  const single = stripCloser(firstBody, opener.colons);
  if (single.found) {
    const body = single.stripped.length > 0 ? [paragraph(single.stripped)] : [];
    children.splice(startIndex, 1, buildAdmonition(opener.type, title, body));
    return true;
  }

  // Multi-paragraph: scan later siblings for the closing fence. Any
  // block between the fences (paragraphs, code blocks, lists) is
  // body content, as in a bracketed directive.
  for (let j = startIndex + 1; j < children.length; j++) {
    const sibling = children[j];
    if (sibling.type === "paragraph") {
      const closer = stripCloser(sibling.children || [], opener.colons);
      if (!closer.found) {
        continue;
      }
      const body: any[] = [];
      if (firstBody.length > 0) {
        body.push(paragraph(firstBody));
      }
      for (let k = startIndex + 1; k < j; k++) {
        body.push(children[k]);
      }
      if (closer.stripped.length > 0) {
        body.push(paragraph(closer.stripped));
      }
      children.splice(
        startIndex,
        j - startIndex + 1,
        buildAdmonition(opener.type, title, body),
      );
      return true;
    }
    // The closer may be nested inside this block (an indented `:::`
    // after the last list item parses into that item's paragraph).
    // Only accept it when it is the block's last paragraph — anything
    // after it would belong outside the directive, and splitting the
    // block is not attempted.
    const nested = findNestedCloser(sibling, opener.colons);
    if (!nested) {
      continue;
    }
    const paragraphs = collectParagraphs(sibling);
    if (paragraphs[paragraphs.length - 1] !== nested.paragraph) {
      return false;
    }
    nested.paragraph.children = nested.stripped;
    const body: any[] = [];
    if (firstBody.length > 0) {
      body.push(paragraph(firstBody));
    }
    for (let k = startIndex + 1; k <= j; k++) {
      body.push(children[k]);
    }
    children.splice(
      startIndex,
      j - startIndex + 1,
      buildAdmonition(opener.type, title, body),
    );
    return true;
  }

  // No closing fence anywhere after the opener: leave it alone,
  // exactly as remark-directive leaves an unclosed directive.
  return false;
}

/** Walks a parent's children, converting space-form fences in place. */
function processParent(parent: any): void {
  const children = parent.children;
  if (!children) {
    return;
  }
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.type === "paragraph") {
      const opener = matchOpener(node);
      if (opener && convertFrom(parent, i, opener)) {
        // Recurse into the new admonition so a fence nested in its
        // body converts too (Docusaurus's preprocessor rewrites
        // nested fences as well).
        processParent(children[i]);
        continue;
      }
      continue;
    }
    if (node.children) {
      processParent(node);
    }
  }
}

export default function remarkSpaceFormAdmonitionsPlugin() {
  return (tree: any) => {
    processParent(tree);
  };
}
