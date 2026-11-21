/**
 * remarkVarsPlugin
 *
 * Replaces {vars.key} and {vars.nested.key} references from porto.yml's `vars` section,
 * and {env.VAR} references from the build environment.
 *
 * Ported from the Astro app (`packages/app/src/plugins/remarkVars.ts`):
 * logic verbatim. The `{{vars.key}}` escape is kept — the docs
 * themselves document it in code blocks (`{{{vars.project.repo}}}`)
 * and in text (`{{vars.project.title}}`, which MDX leaves as a text
 * node because the inner `{vars.project.title}` is not valid JS), so
 * dropping it would change rendered content versus Docusaurus.
 *
 * Supported locations (both forms):
 *   - Text nodes:         "Visit {vars.github} for more."
 *   - Inline code:        `{vars.twitter}`
 *   - Code blocks:        ```\ngit clone {vars.repo}\n```
 *   - Link URLs:          [GitHub]({vars.github})  or  [GitHub]({vars.github}/page)
 *   - Image URLs:         ![logo]({vars.logo})
 *   - MDX expressions:    {vars.project.title}  or  {vars.tools.bun}
 *
 * Env names match [a-zA-Z_][a-zA-Z0-9_]* (no dots, unlike vars paths).
 * An unset env var resolves to an empty string, matching {{env.VAR}}
 * in porto.yml, while an unknown vars key fails the build.
 *
 * Escape (render the literal token without replacement):
 *   - In text / code:     use double braces: {{vars.key}} → {vars.key}, {{env.VAR}} → {env.VAR}
 */

/** Minimal recursive AST walker (no external dep, matches remarkIcons pattern). */
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
 * Resolve a dot-notation path inside the vars object.
 * e.g. resolveVarPath("project.title", { project: { title: "Portosaur" } }) → "Portosaur"
 * @param path - Dot-separated key path.
 * @param vars - The vars object from porto.yml.
 * @returns The resolved value, or undefined if not found.
 */
function resolveVarPath(
  path: string,
  vars: Record<string, unknown>,
): string | undefined {
  const keys = path.split(".");
  let current: unknown = vars;

  for (const key of keys) {
    if (
      current !== null &&
      typeof current === "object" &&
      Object.prototype.hasOwnProperty.call(current, key)
    ) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return typeof current === "string" || typeof current === "number"
    ? String(current)
    : undefined;
}

/**
 * @param vars - The resolved vars map from porto.yml.
 * @param env - Environment variables to resolve {env.VAR} from,
 *   defaults to the build process environment. A separate parameter
 *   so tests can pass a fixed map.
 * @returns The transformer. Vars replacement only runs when vars are
 *   defined, so a project without a vars section keeps the old
 *   behavior of leaving {vars.key} untouched. Env replacement always
 *   runs.
 */
export default function remarkVarsPlugin(
  vars: Record<string, unknown> = {},
  env: Record<string, string | undefined> = process.env,
) {
  const hasVars = !!vars && Object.keys(vars).length > 0;

  // Matches {vars.key} or {vars.nested.key} in plain text / URLs
  const bracePattern = /\{vars\.([a-zA-Z_][a-zA-Z0-9_.]*)\}/g;

  // Matches {{vars.key}} — escape form (renders as literal {vars.key})
  const escapePattern = /\{\{vars\.([a-zA-Z_][a-zA-Z0-9_.]*)\}\}/g;

  // Matches {env.VAR} in plain text / URLs (env names have no dots)
  const envBracePattern = /\{env\.([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

  // Matches {{env.VAR}} — escape form (renders as literal {env.VAR})
  const envEscapePattern = /\{\{env\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

  /**
   * Throw a descriptive build error so the build fails on the offending file.
   * @param path - The full path that was not found, e.g. "project.title".
   * @param filePath - Source file path for error context.
   */
  function unknownKeyError(path: string, filePath: string): Error {
    return new Error(
      `[Portosaur] Unknown vars key "{vars.${path}}" in "${filePath || "unknown file"}".\n` +
        `  Make sure "${path}" is defined under 'vars:' in your porto.yml.`,
    );
  }

  /**
   * Replace {vars.key} occurrences in a string, throwing on unknown keys.
   * Double-brace form {{vars.key}} is an escape — it renders as {vars.key} literally.
   * @param str
   * @param filePath - Source file path for error context.
   */
  function replaceVarsBraces(str: string, filePath: string): string {
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

  /**
   * Replace {env.VAR} occurrences in a string. An unset variable
   * resolves to an empty string, matching {{env.VAR}} in porto.yml.
   * Double-brace form {{env.VAR}} is an escape — it renders as {env.VAR} literally.
   */
  function replaceEnvBraces(str: string): string {
    // Protect escaped {{env.VAR}} with a null-byte placeholder
    // so the single-brace replacer never sees them.
    const ESCAPE_PLACEHOLDER = "\x00ENV_LITERAL\x00";
    const escaped = str.replace(
      envEscapePattern,
      (_, name) => `${ESCAPE_PLACEHOLDER}${name}${ESCAPE_PLACEHOLDER}`,
    );

    // Replace {env.VAR} — any remaining single-brace form is a real reference.
    const replaced = escaped.replace(
      envBracePattern,
      (_, name) => env[name] ?? "",
    );

    // Restore escaped tokens as literal {env.VAR}
    return replaced.replace(
      new RegExp(
        `${ESCAPE_PLACEHOLDER}([a-zA-Z_][a-zA-Z0-9_]*)${ESCAPE_PLACEHOLDER}`,
        "g",
      ),
      (_, name) => `{env.${name}}`,
    );
  }

  function replaceBraces(str: string, filePath: string): string {
    const afterVars = hasVars ? replaceVarsBraces(str, filePath) : str;
    return replaceEnvBraces(afterVars);
  }

  // The transformer receives (tree, file) — `file.path` is the source file path
  return (tree: any, file: any) => {
    const filePath = file?.path || file?.history?.[0] || "";

    // Text nodes: replace {vars.key} in plain text
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

    // --- .mdx expression nodes: {vars.key} and {env.VAR} are parsed as JSX expressions ---
    // We intercept these and replace them with plain text nodes so the MDX
    // runtime never tries to evaluate `vars` or `env` as JavaScript variables.

    function handleMdxExpression(node: any, index: number, parent: any): void {
      const expr = node.value?.trim();
      if (!expr) {
        return;
      }

      let resolved: string | undefined;
      if (expr.startsWith("env.")) {
        const name = expr.replace(/^env\./, "");
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          return;
        }
        resolved = env[name] ?? "";
      } else if (hasVars && expr.startsWith("vars.")) {
        const varPath = expr.replace(/^vars\./, "");
        resolved = resolveVarPath(varPath, vars);
        if (resolved === undefined) {
          throw unknownKeyError(varPath, filePath);
        }
      } else {
        return;
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
}
