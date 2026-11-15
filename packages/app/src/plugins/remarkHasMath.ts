// Detects pages that render math, so BaseLayout loads the KaTeX
// stylesheet only on those pages (it used to be imported globally
// from custom.css — ~25KB on every page, while most sites have no
// math pages at all).
//
// Runs after remark-math in mdx.ts: remark-math turns `$...$` and
// `$$...$$` into `math`/`inlineMath` nodes, and this plugin flags
// the page when it sees one. A frontmatter `math: true` flags the
// page too, for math rendered by a component rather than `$...$`
// syntax (remark-math never sees that). The flag is stashed at
// `file.data.astro.frontmatter[HAS_MATH_KEY]`, following the
// remarkContentTitle pattern — pages read it from
// `remarkPluginFrontmatter` and pass it to BaseLayout as `hasMath`.
//
// The flag only gates the CSS: the math pipeline itself
// (remark-math + rehype-katex) always runs, so a page with math
// still gets its KaTeX markup — and BaseLayout also injects the
// stylesheet when it sees `.katex` markup without a link, so math
// renders correctly even on pages whose flag was never plumbed
// through.

/** The `remarkPluginFrontmatter` key the math flag is stashed under. */
export const HAS_MATH_KEY = "__portoHasMath";

export default function remarkHasMath() {
  return (tree: any, file: any) => {
    // Without a file there is nowhere to stash the flag, so the
    // tree is left untouched (unified always passes a vfile when
    // processing, so this only guards direct test calls).
    if (!file) {
      return;
    }
    const frontmatter = file.data?.astro?.frontmatter;
    if (frontmatter?.math === true) {
      stashFlag(file);
      return;
    }
    let found = false;
    const visit = (node: any) => {
      if (found) {
        return;
      }
      if (node.type === "math" || node.type === "inlineMath") {
        found = true;
        return;
      }
      for (const child of node.children ?? []) {
        visit(child);
      }
    };
    visit(tree);
    if (found) {
      stashFlag(file);
    }
  };
}

function stashFlag(file: any): void {
  file.data ??= {};
  file.data.astro ??= {};
  file.data.astro.frontmatter ??= {};
  file.data.astro.frontmatter[HAS_MATH_KEY] = true;
}
