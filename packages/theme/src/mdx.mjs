/**
 * MDX options for the Portosaur integration.
 *
 * Astro 7 defaults to the Sätteri markdown processor (which runs no
 * remark/rehype plugins), and the `mdx()` plugin options are deprecated
 * and ignored. The supported path is a `unified` processor from
 * `@astrojs/markdown-remark` set as `markdown.processor` — MDX inherits
 * it. The integration builds that processor from this module's plugin
 * list.
 *
 * Plugin order matters: remark-directive runs before remarkAdmonitions
 * (which consumes its nodes); remarkIcons runs before remark-emoji so
 * icon shortcodes are claimed first.
 */

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";

import remarkVars from "./plugins/remarkVars.mjs";
import remarkIcons from "./plugins/remarkIcons.mjs";
import remarkAdmonitions from "./plugins/remarkAdmonitions.mjs";
import { getShikiThemes } from "./config/shiki.mjs";

/**
 * Builds the `@astrojs/mdx` options for a site.
 *
 * @param {object} args
 * @param {Record<string, unknown>} [args.userVars] - The `vars` map from
 *   config.yml (for `{vars.key}` substitution).
 * @param {string} [args.colorScheme] - The site's color scheme (for the
 *   Shiki light/dark themes).
 * @returns {{ remarkPlugins: any[], rehypePlugins: any[], shikiConfig: { themes: object } }}
 */
export function portosaurMdxOptions({ userVars = {}, colorScheme } = {}) {
  // NOTE: unified calls each plugin itself — pass the plugin functions
  // (and `[plugin, options]` tuples where options are needed), never
  // pre-called factories. A pre-called factory is treated as a plugin
  // and invoked with no arguments, so its transformer runs with an
  // undefined tree and crashes (`node.type` of undefined).
  return {
    remarkPlugins: [
      remarkMath,
      [remarkVars, userVars],
      remarkIcons,
      remarkDirective,
      remarkAdmonitions,
      remarkEmoji,
    ],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: getShikiThemes(colorScheme),
    },
  };
}
