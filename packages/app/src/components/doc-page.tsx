import type * as PageTree from "fumadocs-core/page-tree";
import type { TOCItemType } from "fumadocs-core/toc";
import type { MDXComponents, MDXContent } from "mdx/types";
import dynamic from "next/dynamic";
import type { PortosaurOptions } from "../lib/config.ts";
import {
  findBreadcrumbs,
  findCategoryItems,
  findPrevNext,
  tocToHeadings,
  topicListShouldRender,
  type SidebarLink,
} from "../lib/content.ts";
import { PAGE_TITLE_ID, docFileTitle, docPageTitles } from "../lib/docPage.ts";
import { pageHref } from "../lib/pageUrl.ts";
import { isIndexFile, type PortoDocData } from "../lib/source.ts";
import {
  CONTENT_TITLE_KEY,
  type ContentTitle,
} from "../plugins/remarkContentTitle.ts";
import { HAS_MATH_KEY } from "../plugins/remarkHasMath.ts";
import { Breadcrumbs } from "./Breadcrumbs.tsx";
import { ContentPanel } from "./ContentPanel.tsx";
import { DocFooter } from "./DocFooter.tsx";
import { getMDXComponents } from "./mdx.tsx";
import {
  TopicList,
  TopicListProvider,
  topicListCards,
} from "./mdx/TopicList.tsx";
import { PageSidebar } from "./PageSidebar.tsx";
import { PageTitle } from "./PageTitle.tsx";

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
 * - `page.data.toc` — `TOCItemType[]` (H2+ only; the H1 was
 *   hoisted out by `remarkContentTitle`)
 * - `page.data._exports.__portoContentTitle` — the hoisted H1
 *   `{ text, slug }`, or undefined when the page has no content H1
 * - `page.data._exports.__portoHasMath` — `true` when the page
 *   renders math (gates the KaTeX stylesheet), or undefined
 * - `page.data.desc` — the page description (NOT `description`)
 *
 * Structure: the two-column split (TOC aside + main pane) with
 * two content panels — breadcrumbs + the `<h1>`, then the MDX
 * body + the automatic topic list (index pages) + the doc footer.
 * The header panel renders only when it has something in it.
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
  import("./KaTeXStyles.tsx").then((mod) => mod.KaTeXStyles),
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

  // The section crumb comes from the mode/route, not the tree —
  // the tree carries no root category. The home link prepends the
  // pagination order, so the first doc's "Previous" still points
  // at the collection home.
  const section: SidebarLink = {
    title: config.siteMode === "docs" ? "Docs" : "Notes",
    href: pageHref(`/${config.site.notesRoute}`),
  };
  const breadcrumbs = config.theme.breadcrumbs
    ? findBreadcrumbs(tree.children, page.url, section).map((crumb) => ({
        ...crumb,
        href: crumb.href ? pageHref(crumb.href) : null,
      }))
    : [];
  const { prev, next } = findPrevNext(tree.children, page.url, section);
  const prevLink = prev ? { ...prev, href: pageHref(prev.href) } : null;
  const nextLink = next ? { ...next, href: pageHref(next.href) } : null;

  const tocHeadings = tocToHeadings(data.toc);
  const hasToc = tocHeadings.length > 0;

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
  const topicCards = topicListCards(categoryItems);

  const MDXBody = data.body;

  return (
    <>
      {hasMath && <KaTeXStyles />}
      <div className="porto-doc-columns">
        <div className="porto-right-sidebar-container">
          <div className="porto-right-sidebar">
            <PageSidebar headings={tocHeadings} pageTitleId={PAGE_TITLE_ID} />
          </div>
        </div>
        <div className={`main-pane${hasToc ? " main-pane--toc" : ""}`}>
          {(breadcrumbs.length > 0 || heading) && (
            <ContentPanel>
              {breadcrumbs.length > 0 && <Breadcrumbs crumbs={breadcrumbs} />}
              {heading && <PageTitle title={heading.text} id={heading.id} />}
            </ContentPanel>
          )}
          <ContentPanel>
            <div className="porto-markdown-content">
              <TopicListProvider
                value={{
                  items: categoryItems,
                  shouldRender: shouldRenderTopicList,
                }}
              >
                <MDXBody components={getMDXComponents(components)} />
              </TopicListProvider>
            </div>
            {shouldRenderTopicList && topicCards.length > 0 && (
              <TopicList items={topicCards} />
            )}
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
