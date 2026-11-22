// Hoists a doc page's first H1 out of the content and into the page
// title slot, so the heading sits above the panel hairline on every
// page. Docusaurus's `contentTitle` rule (the first heading, when it
// is depth 1): the title is stashed on the vfile and the H1 is removed
// from the content.
//
// Ported from the Astro app (`packages/app/src/plugins/
// remarkContentTitle.ts`). The Astro version stashed the title at
// `file.data.astro.frontmatter` for `remarkPluginFrontmatter`. Here it
// goes to `file.data[CONTENT_TITLE_KEY]` and reaches the page through
// Fumadocs' `mdxOptions.valueToExport` (see `mdx.ts`), which exports
// it from the compiled MDX module — the page reads it from
// `page.data._exports`. Frontmatter comes from
// `file.data.frontmatter`, which fumadocs-mdx sets on the vfile.
//
// Why a remark plugin: the title has to leave the content tree —
// rendering it in the header panel AND leaving it in the content
// would show it twice, and the TOC is exported by rehypeToc, which
// runs after the remark stage, so a rehype removal would also erase
// the title from the TOC.
//
// One consequence of the removal: if a later heading shared the H1's
// text, that heading's slug loses its `-1` suffix (remarkHeading
// never sees the H1), so a hardcoded `#slug-1` link to such a heading
// would break. The TOC is generated from the same headings, so it
// stays consistent.
//
// Thematic breaks: Docusaurus's contentTitle plugin stops at the
// first thematic break, but Portosaur's title rule has always been
// "first heading iff depth 1" (see `lib/docPage.ts`) — a leading rule
// should not change the page's title, so the break is ignored here
// too, deliberately.
//
// The title rule itself (which heading counts, how its text is
// extracted) lives in `lib/content-title.ts`, shared with the
// page-tree transformer so the sidebar and the page header agree.
import {
  contentTitleFromHeading,
  firstContentHeading,
} from "../lib/content-title.ts";

/** The vfile data key the hoisted title is stashed under. */
export const CONTENT_TITLE_KEY = "__portoContentTitle";

/** A hoisted content title: the H1's plain text and its heading slug. */
export type { ContentTitle } from "../lib/content-title.ts";

export default function remarkContentTitle() {
  return (tree: any, file: any) => {
    // Without a file there is nowhere to stash the title, so the
    // tree is left untouched (unified always passes a vfile when
    // processing, so this only guards direct test calls).
    if (!file) {
      return;
    }
    const found = firstContentHeading(tree);
    if (!found) {
      return;
    }
    const frontmatter = file.data?.frontmatter;
    // Portosaur content is MDX-only, so an unknown file is treated
    // as MDX (no `{` escaping in the title text).
    const history = file.history?.[0];
    const isMdx = history ? history.endsWith(".mdx") : true;
    const title = contentTitleFromHeading(found.heading, frontmatter, isMdx);
    // An empty H1 contributes no title: remove it, but stash
    // nothing, so the page falls back to its synthetic title.
    if (title) {
      file.data ??= {};
      file.data[CONTENT_TITLE_KEY] = title;
    }
    tree.children.splice(found.index, 1);
  };
}
