/**
 * Types for the internal MDX options module (see `mdx.mjs`). Not a
 * package export — the integration imports it relatively.
 */

/**
 * Builds the `@astrojs/mdx` options for a site: the remark/rehype
 * plugins (math, `{vars.*}`, icons, admonitions, emoji) and the Shiki
 * themes for the site's color scheme.
 */
export function portosaurMdxOptions(args?: {
  userVars?: Record<string, unknown>;
  colorScheme?: string;
}): {
  remarkPlugins: any[];
  rehypePlugins: any[];
  shikiConfig: { themes: Record<string, string> };
};
