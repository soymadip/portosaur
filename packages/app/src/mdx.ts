/**
 * MDX options for a Portosaur site, as Fumadocs global preset options.
 *
 * The CLI-generated `source.config.ts` passes these to `defineConfig`
 * as `mdxOptions`; Fumadocs' preset merges Portosaur's plugins into
 * the middle of its own pipeline (verified in fumadocs-mdx
 * `preset.ts`):
 *
 *   remark: remarkShow, remarkGfm, remarkHeading (generateToc: false),
 *     remarkImage, remarkCodeTab, …Portosaur remarkPlugins…,
 *     remarkStructure, valueToExport exporter
 *   rehype: rehypeCode, …Portosaur rehypePlugins…, rehypeToc,
 *     rehypeHeading
 *
 * Fumadocs' remarkNpm is OFF (`remarkNpmOptions: false` below):
 * it only knows the JS managers, and Portosaur's remarkInstall
 * replaces it — same JS behavior, plus other languages via the
 * fence's `lang="..."` meta (python, ruby). remarkInstall runs
 * after remarkVars, so `{vars.key}` substitution applies inside
 * install fences too.
 *
 * Plugin order matters: remarkContentTitle runs first among
 * Portosaur's plugins — it hoists the page's first H1 into the title
 * slot (after remarkHeading assigned its id) before any content
 * transform sees it. remarkHasMath runs right after remarkMath — it
 * flags pages with math nodes, which only exist once remarkMath has
 * created them. remark-directive runs before remarkAdmonitions (which
 * consumes its nodes); remarkIcons runs before remark-emoji so icon
 * shortcodes are claimed first. remarkGithubAlerts runs beside
 * remarkAdmonitions — both emit the same admonition `<div>`s, from
 * `:::` directives and GitHub `[!NOTE]` blockquotes respectively.
 * remarkSpaceFormAdmonitions runs with them: it converts the MDX
 * v1-style `:::note Title` fences Docusaurus rewrites in its
 * preprocessor (which Fumadocs has no equivalent of), so the space
 * form renders exactly as on OG. remarkImageSrc only touches JSX
 * `<img>` elements, so its position is free — it runs last.
 *
 * `valueToExport` exports the two vfile stashes as named exports of
 * the compiled MDX module, so the page reads them from
 * `page.data._exports`: the hoisted content title and the math flag.
 * The Shiki light/dark theme pair for the site's color scheme goes
 * to Fumadocs' `rehypeCode` via `rehypeCodeOptions.themes`.
 */

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkDirective from "remark-directive";
import remarkEmoji from "remark-emoji";
import type { MDXPresetOptions } from "fumadocs-mdx/config";

import remarkContentTitle, {
  CONTENT_TITLE_KEY,
} from "./plugins/remarkContentTitle.ts";
import remarkHasMath, { HAS_MATH_KEY } from "./plugins/remarkHasMath.ts";
import remarkVars from "./plugins/remarkVars.ts";
import remarkInstall from "./plugins/remarkInstall.ts";
import remarkIcons from "./plugins/remarkIcons.ts";
import remarkAdmonitions from "./plugins/remarkAdmonitions.ts";
import remarkSpaceFormAdmonitions from "./plugins/remarkSpaceFormAdmonitions.ts";
import remarkGithubAlerts from "./plugins/remarkGithubAlerts.ts";
import remarkImageSrc from "./plugins/remarkImageSrc.ts";
import { getShikiThemes } from "./config/shiki.ts";

export interface PortosaurMdxArgs {
  userVars?: Record<string, unknown>;
  colorScheme?: string;
}

/**
 * Builds the Fumadocs global MDX preset options for a site.
 *
 * @param args.userVars - The `vars` map from config.yml (for
 *   `{vars.key}` substitution).
 * @param args.colorScheme - The site's color scheme (for the Shiki
 *   light/dark themes).
 */
export function portosaurMdxOptions({
  userVars = {},
  colorScheme,
}: PortosaurMdxArgs = {}): MDXPresetOptions {
  // NOTE: unified calls each plugin itself — pass the plugin functions
  // (and `[plugin, options]` tuples where options are needed), never
  // pre-called factories. A pre-called factory is treated as a plugin
  // and invoked with no arguments, so its transformer runs with an
  // undefined tree and crashes (`node.type` of undefined).
  return {
    remarkPlugins: [
      remarkContentTitle,
      remarkMath,
      remarkHasMath,
      [remarkVars, userVars],
      remarkInstall,
      remarkIcons,
      remarkDirective,
      remarkAdmonitions,
      remarkSpaceFormAdmonitions,
      remarkGithubAlerts,
      remarkEmoji,
      remarkImageSrc,
    ],
    rehypePlugins: [rehypeKatex],
    // Fumadocs' remarkNpm is replaced by Portosaur's remarkInstall
    // (above) — same JS tabs, plus other languages via lang="...".
    remarkNpmOptions: false,
    rehypeCodeOptions: {
      themes: getShikiThemes(colorScheme),
    },
    valueToExport: [CONTENT_TITLE_KEY, HAS_MATH_KEY],
  };
}
