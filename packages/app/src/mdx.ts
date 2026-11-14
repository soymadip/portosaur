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
 * icon shortcodes are claimed first. remarkGithubAlerts runs beside
 * remarkAdmonitions — both emit the same admonition `<div>`s, from
 * `:::` directives and GitHub `[!NOTE]` blockquotes respectively.
 * remarkImageSrc only touches JSX `<img>` elements, so its position
 * is free — it runs last.
 */

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import type { BuiltinTheme } from "shiki";

import remarkVars from "./plugins/remarkVars.ts";
import remarkIcons from "./plugins/remarkIcons.ts";
import remarkAdmonitions from "./plugins/remarkAdmonitions.ts";
import remarkGithubAlerts from "./plugins/remarkGithubAlerts.ts";
import remarkImageSrc from "./plugins/remarkImageSrc.ts";
import { getShikiThemes } from "./config/shiki.ts";

/**
 * The `@astrojs/mdx` options for a site: the remark/rehype plugins
 * (math, `{vars.*}`, icons, admonitions, GitHub alerts, emoji, JSX
 * `<img>` src unwrapping) and the Shiki themes for the site's color
 * scheme.
 */
export interface PortosaurMdxOptions {
  remarkPlugins: any[];
  rehypePlugins: any[];
  shikiConfig: { themes: Record<string, BuiltinTheme> };
}

export interface PortosaurMdxArgs {
  userVars?: Record<string, unknown>;
  colorScheme?: string;
}

/**
 * Builds the `@astrojs/mdx` options for a site.
 *
 * @param args.userVars - The `vars` map from config.yml (for
 *   `{vars.key}` substitution).
 * @param args.colorScheme - The site's color scheme (for the Shiki
 *   light/dark themes).
 */
export function portosaurMdxOptions({
  userVars = {},
  colorScheme,
}: PortosaurMdxArgs = {}): PortosaurMdxOptions {
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
      remarkGithubAlerts,
      remarkEmoji,
      remarkImageSrc,
    ],
    rehypePlugins: [rehypeKatex],
    shikiConfig: {
      themes: getShikiThemes(colorScheme),
    },
  };
}
