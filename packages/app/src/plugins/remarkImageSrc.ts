/**
 * remarkImageSrc
 *
 * Rewrites `<img src={ImportedImage} />` in MDX to
 * `<img src={ImportedImage.src} />`.
 *
 * Docusaurus-era content imports an image and passes the import
 * straight to `<img src>` — under webpack the import IS a URL string,
 * so that worked. Under Astro an image import is an `ImageMetadata`
 * object (`{ src, width, height, format }`), which stringifies to
 * `"[object Object]"` as a src — the browser then requests it as a
 * relative URL and the page 404s. The MDX `components` map cannot fix
 * this: literal JSX elements bypass it (only Markdown-generated
 * elements route through mapped components), and mapping `img` also
 * opts Markdown images out of Astro's optimization. So the rewrite
 * happens here, at the mdast level, before compilation.
 *
 * Only bare identifiers that resolve to a default image import in the
 * same file are rewritten. String srcs, `?url` imports (already
 * strings), non-image imports, and arbitrary expressions are left
 * alone — as is a src that already ends in `.src`.
 */

/** Image extensions Astro treats as image imports. */
const IMAGE_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".webp",
]);

/** Minimal recursive AST walker (no external dep, matches remarkVars pattern). */
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

/**
 * Default-import identifiers whose source is a plain image path:
 * `import Logo from "./logo.png"` → `Logo`. Imports with a query
 * string (`?url`, `?raw`) are already strings, not metadata objects,
 * so they are skipped.
 */
function collectImageImportNames(tree: any): Set<string> {
  const names = new Set<string>();
  const importPattern =
    /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\}\s*)?from\s*['"]([^'"]+)['"]/g;
  visit(tree, "mdxjsEsm", (node) => {
    const value = node.value ?? "";
    for (const match of value.matchAll(importPattern)) {
      const localName = match[1];
      const source = match[2];
      if (source.includes("?")) {
        continue;
      }
      const lower = source.toLowerCase();
      const dot = lower.lastIndexOf(".");
      if (dot !== -1 && IMAGE_EXTENSIONS.has(lower.slice(dot))) {
        names.add(localName);
      }
    }
  });
  return names;
}

/**
 * Rewrites a parsed `Ident` expression to `Ident.src` in place: the
 * MDX compiler compiles the attached estree, not the value string —
 * deleting the estree leaves an empty expression (`src: ,`) and the
 * build fails, so the estree must be rewritten to match. Returns
 * false when the estree is not the expected bare-identifier shape.
 */
function rewriteEstreeToSrc(estree: any, identifier: string): boolean {
  const statement = estree?.body?.[0];
  const expression = statement?.expression;
  if (
    estree?.type !== "Program" ||
    statement?.type !== "ExpressionStatement" ||
    expression?.type !== "Identifier" ||
    expression.name !== identifier
  ) {
    return false;
  }
  statement.expression = {
    type: "MemberExpression",
    object: expression,
    property: { type: "Identifier", name: "src" },
    computed: false,
    optional: false,
  };
  return true;
}

export default function remarkImageSrc() {
  return (tree: any) => {
    const imageImports = collectImageImportNames(tree);
    if (imageImports.size === 0) {
      return;
    }

    function handleImgElement(node: any): void {
      if (node.name !== "img") {
        return;
      }
      for (const attr of node.attributes ?? []) {
        // `src={Ident}` parses as an `mdxJsxAttribute` whose value
        // is an `mdxJsxAttributeValueExpression` object carrying the
        // expression source as a string (plus a parsed estree) — a
        // plain string value is a literal src, not an expression.
        if (
          attr.type !== "mdxJsxAttribute" ||
          attr.name !== "src" ||
          attr.value?.type !== "mdxJsxAttributeValueExpression" ||
          typeof attr.value.value !== "string"
        ) {
          continue;
        }
        const identifier = attr.value.value.trim();
        if (!imageImports.has(identifier)) {
          continue;
        }
        attr.value.value = `${identifier}.src`;
        // The compiler compiles the attached estree, not the value
        // string — rewrite it to match (deleting it leaves an empty
        // expression and breaks the build).
        if (attr.value.data?.estree) {
          rewriteEstreeToSrc(attr.value.data.estree, identifier);
        }
      }
    }

    visit(tree, "mdxJsxFlowElement", handleImgElement);
    visit(tree, "mdxJsxTextElement", handleImgElement);
  };
}
