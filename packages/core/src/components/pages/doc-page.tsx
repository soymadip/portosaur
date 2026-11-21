import type * as PageTree from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import type { MDXComponents, MDXContent } from "mdx/types";
import dynamic from "next/dynamic";
import type { PortosaurOptions } from "../../lib/config.ts";
import {
  findCategoryItems,
  findPrevNext,
  resolveTocSettings,
  tocToHeadings,
  topicListCards,
  topicListShouldRender,
  type SidebarLink,
  type TopicListItem,
} from "../../lib/content.ts";
import {
  PAGE_TITLE_ID,
  docFileTitle,
  docPageDesc,
  docPageTitles,
} from "../../lib/docPage.ts";
import { pageHref } from "../../lib/pageUrl.ts";
import { isIndexFile, type PortoDocData } from "../../lib/source.ts";
import {
  CONTENT_TITLE_KEY,
  type ContentTitle,
} from "../../plugins/remarkContentTitle.ts";
import { HAS_MATH_KEY } from "../../plugins/remarkHasMath.ts";
import { ContentPanel } from "./parts/ContentPanel.tsx";
import { DocFooter } from "./parts/DocFooter.tsx";
import { getMDXComponents } from "../mdx.tsx";
import { AutoTopicList, TopicListProvider } from "../mdx/TopicList.tsx";
import { PageSidebar } from "./frame/PageSidebar.tsx";
import { PageTitle } from "./parts/PageTitle.tsx";

/**
 * DocPage — one docs/notes page. Rendered by the generated
 * `app/docs/[[...slug]]/page.tsx` inside `DocsLayout`.
 *
 * Reads everything directly off `page.data` — the fumadocs-mdx
 * collections are eager (no `async: true`), so there is no
 * `load()` to call (calling it would crash: `load` exists only
 * on lazy/async entries).
 *
 * - `page.data.body` — the MDX component
 * - `page.data.toc` — `TOCItemType[]` (H2+ only. The H1 was
 *   hoisted out by `remarkContentTitle`)
 * - `page.data._exports.__portoContentTitle` — the hoisted H1
 *   `{ text, slug }`, or undefined when the page has no content H1
 * - `page.data._exports.__portoHasMath` — `true` when the page
 *   renders math (gates the KaTeX stylesheet), or undefined
 * - `page.data.desc` — the page description (NOT `description`)
 *
 * Structure: the two-column split (TOC aside + main pane) with
 * two content panels — the `<h1>`, then the MDX body + the
 * automatic topic list (index pages) + the doc footer. The
 * header panel renders only when the page has a heading.
 *
 * The KaTeX stylesheet loads only on math pages: `KaTeXStyles`
 * is a dynamic import, so its CSS chunk is emitted only when
 * this page renders it.
 */

/** A doc page's data, as the generated route passes it. */
export interface PortoDocPageData extends PortoDocData {
  toc: TOCItemType[];
  body: MDXContent;
  _exports?: Record<string, unknown>;
}

/** A doc page, as the generated route passes it. */
export interface PortoDocPage {
  url: string;
  path: string;
  slugs: string[];
  data: PortoDocPageData;
}

const KaTeXStyles = dynamic(() =>
  import("./parts/KaTeXStyles.tsx").then((mod) => mod.KaTeXStyles),
);

function readContentTitle(
  exportsMap: Record<string, unknown> | undefined,
): ContentTitle | null {
  const value = exportsMap?.[CONTENT_TITLE_KEY];
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { text?: unknown }).text === "string" &&
    typeof (value as { slug?: unknown }).slug === "string"
  ) {
    return value as ContentTitle;
  }
  return null;
}

export function DocPage({
  config,
  page,
  tree,
  editUrl,
  lastUpdated,
  components,
}: {
  config: PortosaurOptions;
  page: PortoDocPage;
  tree: PageTree.Root;
  editUrl?: string;
  lastUpdated?: string;
  /** MDX overrides from the generated route (the `a` override). */
  components?: MDXComponents;
}) {
  const data = page.data;
  const contentTitle = readContentTitle(data._exports);
  const { heading } = docPageTitles(
    data,
    contentTitle,
    docFileTitle(page.path),
  );
  const hasMath = data.math === true || data._exports?.[HAS_MATH_KEY] === true;

  // The collection home link prepends the pagination order, so
  // the first doc's "Previous" still points at the collection
  // home. The tree carries no root category, so the home comes
  // from the mode/route instead.
  const section: SidebarLink = {
    title: config.siteMode === "docs" ? "Docs" : "Notes",
    href: pageHref(`/${config.site.notesRoute}`),
  };
  const { prev, next } = findPrevNext(tree.children, page.url, section);
  const prevLink = prev ? { ...prev, href: pageHref(prev.href) } : null;
  const nextLink = next ? { ...next, href: pageHref(next.href) } : null;

  // The table of contents for this page: the global
  // `site.content.toc` levels, overridden field by field by the
  // page's `table_of_contents` frontmatter. Disabled pages show no
  // TOC column at all (and no mobile TOC bar — it lives in the
  // same column), and neither do pages with no headings left
  // after the level filter.
  const tocSettings = resolveTocSettings(
    config.site.content.toc,
    data.table_of_contents,
  );
  const tocHeadings = tocToHeadings(data.toc, {
    minLevel: tocSettings.minLevel,
    maxLevel: tocSettings.maxLevel,
  });
  const hasToc = tocSettings.enabled && tocHeadings.length > 0;

  // The topic list: the automatic cards after the content on
  // index pages, and the context an explicit `<TopicList />` tag
  // in the content reads. The home href matches no category
  // (there is no root category) — `findCategoryItems` returns the
  // top-level items for it.
  const shouldRenderTopicList = topicListShouldRender(
    data.topic_list,
    isIndexFile(page.path),
    config.topicList.enableByDefaults,
  );
  const categoryItems = shouldRenderTopicList
    ? findCategoryItems(tree.children, page.url, `/${config.site.notesRoute}`)
    : [];
  /* The topic-list cards — their icons render in the list itself. */
  const topicCards: TopicListItem[] = topicListCards(categoryItems);
  const MDXBody = data.body;

  return (
    <>
      {hasMath && <KaTeXStyles />}
      {/* The sidebar default marker: `sidebar_collapsed`
        frontmatter starts this page with the sidebar closed
        (`false` forces it open, overriding the global
        `theme.navigation.sidebar_collapsed`). The marker is an
        attribute on the columns div — it's how the layout learns
        the page's default (the layout renders above the page and
        can't read its frontmatter) — and the CSS `:has()` rules
        hold the collapsed geometry from the first paint, before
        any JS runs. MobileMenu reads the attribute into state
        once the client takes over and removes it. An attribute,
        not a marker element: removing a React-rendered node
        imperatively corrupts the fiber tree and crashes the next
        client navigation, while removing an attribute is safe
        (React only touches attributes when props change, and this
        server component never re-renders). */}
      <div
        className="porto-doc-columns"
        data-porto-sidebar-default={
          data.sidebar_collapsed === true
            ? "collapsed"
            : data.sidebar_collapsed === false
              ? "expanded"
              : undefined
        }
      >
        {/* The TOC column only exists on pages with a TOC: without
          headings there is nothing to show, so the column is not
          rendered at all and the main pane fills the whole row —
          the content re-centers under its cap instead of sitting
          beside an empty 265px strip. */}
        {hasToc && (
          <div className="porto-right-sidebar-container">
            <div className="porto-right-sidebar">
              <PageSidebar headings={tocHeadings} pageTitleId={PAGE_TITLE_ID} />
            </div>
          </div>
        )}
        <div className={`main-pane${hasToc ? " main-pane--toc" : ""}`}>
          {heading && (
            <ContentPanel className="content-panel--header">
              <PageTitle
                title={heading.text}
                id={heading.id}
                desc={docPageDesc(data, config.site.content.addMdxDesc)}
              />
            </ContentPanel>
          )}
          <ContentPanel className="content-panel--body">
            <TopicListProvider
              value={{
                cards: topicCards,
                shouldRender: shouldRenderTopicList,
              }}
            >
              <div className="porto-markdown-content">
                <MDXBody components={getMDXComponents(components)} />
              </div>
              <AutoTopicList items={topicCards} />
            </TopicListProvider>
            <DocFooter
              editUrl={editUrl}
              lastUpdated={lastUpdated}
              prev={prevLink}
              next={nextLink}
            />
          </ContentPanel>
        </div>
      </div>
    </>
  );
}
