/**
 * MDX options for a Portosaur site, as Fumadocs global preset options.
 *
 * The CLI-generated `source.config.ts` passes these to `defineConfig`
 * as `mdxOptions`. Fumadocs' preset merges Portosaur's plugins into
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
 * created them. remarkFileLinks runs right after remarkVars, so a
 * `{vars.key}` in a link URL is substituted before file-link
 * matching sees it. remark-directive runs before remarkAdmonitions (which
 * consumes its nodes). RemarkIcons runs before remark-emoji so icon
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
import { parseCodeBlockAttributes } from "fumadocs-core/mdx-plugins/codeblock-utils";

import remarkContentTitle, {
  CONTENT_TITLE_KEY,
} from "./plugins/remarkContentTitle.ts";
import remarkHasMath, { HAS_MATH_KEY } from "./plugins/remarkHasMath.ts";
import remarkVars from "./plugins/remarkVars.ts";
import remarkFileLinks, { type ContentDir } from "./plugins/remarkFileLinks.ts";
import remarkInstall from "./plugins/remarkInstall.ts";
import remarkMermaid from "./plugins/remarkMermaid.ts";
import remarkIcons from "./plugins/remarkIcons.ts";
import remarkAdmonitions from "./plugins/remarkAdmonitions.ts";
import remarkDetailsMarker from "./plugins/remarkDetailsMarker.ts";
import remarkSpaceFormAdmonitions from "./plugins/remarkSpaceFormAdmonitions.ts";
import remarkGithubAlerts from "./plugins/remarkGithubAlerts.ts";
import remarkImageSrc from "./plugins/remarkImageSrc.ts";
import { getShikiThemes } from "./config/shiki.ts";

export interface PortosaurMdxArgs {
  userVars?: Record<string, unknown>;
  colorScheme?: string;
  /** Render `:smile:`-style emoji shortcodes (default true). */
  renderEmojiShortcodes?: boolean;
  /** Render ```mermaid fences as diagrams (default true). */
  mermaid?: boolean;
  /**
   * Content directories and their URL sections, for relative
   * file links (`./sibling.mdx` → the page URL). The same
   * directories the docs and blog collections read, as absolute
   * paths. Empty (or unset) means file links are left alone.
   */
  contentDirs?: ContentDir[];
}

/**
 * Parse a code fence's meta string into `pre` props, as Fumadocs'
 * `rehypeCode` `parseMetaString` option. This mirrors Fumadocs'
 * default parser (`title`, `tab`, `noCopy`, `lineNumbers` —
 * `noCopy` becomes `allowCopy: "false"`, `lineNumbers` becomes
 * `data-line-numbers`) and adds Portosaur's `noWrap`, which
 * becomes `allowWrap: "false"` for the CodeBlock's wrap button.
 * Keep the shared half in sync with Fumadocs' `parseMeta`
 * (fumadocs-core `rehype-code.core.ts`) on upgrades — this
 * replaces their default wholesale, it does not extend it.
 */
export function parseCodeBlockMeta(meta: string): Record<string, unknown> {
  const parsed = parseCodeBlockAttributes(meta, [
    "title",
    "tab",
    "noCopy",
    "noWrap",
    "lineNumbers",
  ]);
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.attributes)) {
    if (k === "noCopy") {
      data.allowCopy = "false";
      continue;
    }
    if (k === "noWrap") {
      data.allowWrap = "false";
      continue;
    }
    if (k === "lineNumbers") {
      data["data-line-numbers"] = true;
      if (typeof v === "number") {
        data["data-line-numbers-start"] = v;
      }
      continue;
    }
    data[k] = v;
  }
  data.__raw = parsed.rest;
  return data;
}

/**
 * Builds the Fumadocs global MDX preset options for a site.
 *
 * @param args.userVars - The `vars` map from porto.yml (for
 *   `{vars.key}` substitution).
 * @param args.colorScheme - The site's color scheme (for the Shiki
 *   light/dark themes).
 * @param args.renderEmojiShortcodes - Whether `:smile:`-style emoji
 *   shortcodes render (`site.content.render_emoji_shortcodes`,
 *   default true).
 * @param args.mermaid - Whether ```mermaid fences render as diagrams
 *   (`site.content.mermaid`, default true).
 * @param args.contentDirs - Content directories and their URL
 *   sections, for relative file links. Empty means file links are
 *   left alone.
 */
export function portosaurMdxOptions({
  userVars = {},
  colorScheme,
  renderEmojiShortcodes = true,
  mermaid = true,
  contentDirs = [],
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
      // Relative file links (`./sibling.mdx`) resolve to page URLs.
      // After remarkVars so `{vars.key}` substitution applies inside
      // link URLs first.
      [remarkFileLinks, contentDirs],
      remarkInstall,
      // Mermaid fences render as diagrams when the site enables them
      // (`site.content.mermaid`, default true). After remarkVars so
      // `{vars.key}` substitution applies inside diagram fences too.
      ...(mermaid ? [remarkMermaid] : []),
      remarkIcons,
      remarkDirective,
      remarkAdmonitions,
      remarkSpaceFormAdmonitions,
      remarkGithubAlerts,
      remarkDetailsMarker,
      // Emoji shortcodes render only when the site enables them
      // (`site.content.render_emoji_shortcodes`, default true).
      ...(renderEmojiShortcodes ? [remarkEmoji] : []),
      remarkImageSrc,
    ],
    rehypePlugins: [rehypeKatex],
    // Fumadocs' remarkNpm is replaced by Portosaur's remarkInstall
    // (above) — same JS tabs, plus other languages via lang="...".
    remarkNpmOptions: false,
    rehypeCodeOptions: {
      themes: getShikiThemes(colorScheme),
      // Portosaur's meta parser: Fumadocs' default plus `noWrap`
      // (see parseCodeBlockMeta above).
      parseMetaString: parseCodeBlockMeta,
    },
    valueToExport: [CONTENT_TITLE_KEY, HAS_MATH_KEY],
  };
}
