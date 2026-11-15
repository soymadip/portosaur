/**
 * remarkVarsPlugin.cjs
 *
 * Replaces {vars.key} and {vars.nested.key} references from config.yml's `vars` section.
 *
 * Works in both .md and .mdx files:
 *   - .md:  visits text nodes (plain markdown, {vars.key} is just text)
 *   - .mdx: visits mdxTextExpression / mdxFlowExpression nodes ({vars.key} is a JSX expression)
 *
 * Supported locations:
 *   - Text nodes:         "Visit {vars.github} for more."
 *   - Inline code:        `{vars.twitter}`
 *   - Code blocks:        ```\ngit clone {vars.repo}\n```
 *   - Link URLs:          [GitHub]({vars.github})  or  [GitHub]({vars.github}/page)
 *   - Image URLs:         ![logo]({vars.logo})
 *   - MDX expressions:    {vars.project.title}  or  {vars.tools.bun}
 *
 * Escape (render the literal token without replacement):
 *   - In .md:   use double braces: {{vars.key}} → {vars.key}
 *   - In .mdx:  not applicable (JSX parses {{ as object literal — use a text file instead)
 */

/** Minimal recursive AST walker (no external dep, matches remarkIcons pattern). */
function visit(tree, type, visitor) {
  function walk(node, index, parent) {
    if (node.type === type) {
      visitor(node, index, parent);
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
 * Resolve a dot-notation path inside the vars object.
 * e.g. resolveVarPath("project.title", { project: { title: "Portosaur" } }) → "Portosaur"
 * @param {string} path - Dot-separated key path.
 * @param {Record<string, unknown>} vars - The vars object from config.yml.
 * @returns {string | undefined} The resolved value, or undefined if not found.
 */
function resolveVarPath(path, vars) {
  const keys = path.split(".");
  let current = vars;

  for (const key of keys) {
    if (
      current !== null &&
      typeof current === "object" &&
      Object.prototype.hasOwnProperty.call(current, key)
    ) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" || typeof current === "number"
    ? String(current)
    : undefined;
}

/**
 * @param {Record<string, unknown>} vars - The resolved vars map from config.yml.
 * @returns {import('unified').Plugin}
 */
module.exports = function remarkVarsPlugin(vars = {}) {
  if (!vars || Object.keys(vars).length === 0) {
    return () => (tree) => tree;
  }

  // Matches {vars.key} or {vars.nested.key} in plain text / URLs
  const bracePattern = /\{vars\.([a-zA-Z_][a-zA-Z0-9_.]*)\}/g;

  // Matches {{vars.key}} — escape form (only meaningful in .md, not .mdx)
  const escapePattern = /\{\{vars\.([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

  /**
   * Throw a descriptive build error so Docusaurus crashes the page for this file.
   * @param {string} path - The full path that was not found, e.g. "project.title".
   * @param {string} filePath - Source file path for error context.
   */
  function unknownKeyError(path, filePath) {
    return new Error(
      `[Portosaur] Unknown vars key "{vars.${path}}" in "${filePath || "unknown file"}".\n` +
        `  Make sure "${path}" is defined under 'vars:' in your config.yml.`,
    );
  }

  /**
   * Replace {vars.key} occurrences in a string, throwing on unknown keys.
   * Double-brace form {{vars.key}} is an escape — it renders as {vars.key} literally.
   * @param {string} str
   * @param {string} filePath - Source file path for error context.
   */
  function replaceBraces(str, filePath) {
    // Step 1: protect escaped {{vars.key}} with a null-byte placeholder
    //         so the single-brace replacer never sees them.
    const ESCAPE_PLACEHOLDER = "\x00VARS_LITERAL\x00";
    const escaped = str.replace(
      escapePattern,
      (_, path) => `${ESCAPE_PLACEHOLDER}${path}${ESCAPE_PLACEHOLDER}`,
    );

    // Step 2: replace {vars.key} — any remaining single-brace form is a real reference.
    const replaced = escaped.replace(bracePattern, (_, path) => {
      const resolved = resolveVarPath(path, vars);
      if (resolved === undefined) {
        throw unknownKeyError(path, filePath);
      }
      return resolved;
    });

    // Step 3: restore escaped tokens as literal {vars.key}
    return replaced.replace(
      new RegExp(
        `${ESCAPE_PLACEHOLDER}([a-zA-Z_][a-zA-Z0-9_.]*)${ESCAPE_PLACEHOLDER}`,
        "g",
      ),
      (_, path) => `{vars.${path}}`,
    );
  }

  // The transformer receives (tree, file) — `file.path` is the source file path
  return (tree, file) => {
    const filePath = file?.path || file?.history?.[0] || "";

    // --- .md text nodes: replace {vars.key} in plain text ---

    visit(tree, "text", (node) => {
      node.value = replaceBraces(node.value, filePath);
    });

    // Inline code: `{vars.key}`
    visit(tree, "inlineCode", (node) => {
      node.value = replaceBraces(node.value, filePath);
    });

    // Fenced code blocks
    visit(tree, "code", (node) => {
      node.value = replaceBraces(node.value, filePath);
    });

    // Links: [text]({vars.key}) or [text]({vars.key}/subpath)
    visit(tree, "link", (node) => {
      node.url = replaceBraces(node.url, filePath);
    });

    // Images: ![alt]({vars.key})
    visit(tree, "image", (node) => {
      node.url = replaceBraces(node.url, filePath);
    });

    // --- .mdx expression nodes: {vars.key} is parsed as a JSX expression ---
    // We intercept these and replace them with plain text nodes so the MDX
    // runtime never tries to evaluate `vars` as a JavaScript variable.

    function handleMdxExpression(node, index, parent) {
      const path = node.value?.trim();
      if (!path || !path.startsWith("vars.")) return;

      const varPath = path.replace(/^vars\./, "");
      const resolved = resolveVarPath(varPath, vars);

      if (resolved === undefined) {
        throw unknownKeyError(varPath, filePath);
      }

      // Replace the expression node with a plain text node in its parent
      if (parent && index !== null) {
        parent.children.splice(index, 1, { type: "text", value: resolved });
      }
    }

    // Inline: {vars.key} inside a paragraph / list item / table cell
    visit(tree, "mdxTextExpression", handleMdxExpression);

    // Block-level: {vars.key} on its own line
    visit(tree, "mdxFlowExpression", handleMdxExpression);
  };
};
