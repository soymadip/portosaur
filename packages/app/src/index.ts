/**
 * @portosaur/app — the public barrel. The generated root imports
 * most things via deep paths (`@portosaur/app/components/doc-page`,
 * …); this barrel re-exports the same surface for convenience.
 *
 * NOT re-exported here (import via their deep paths):
 * - `lib/icons.ts` — the Iconify JSON packs are megabytes; a
 *   barrel import from any client component would pull them into
 *   the client bundle.
 * - `lib/image-size.ts` — Node-only (`node:fs`); server code only.
 * - `lib/assets.ts` — Node-only (`node:fs`); server code only
 *   (sitemap/robots builders, used by the generated routes).
 * - `lib/source.ts` — Node-only (`node:path`) + loader setup;
 *   server code only, imported by the generated `lib/source.ts`.
 * - `lib/slug-server.ts` — Node-only; server code only.
 */

// Layouts + route components
export { RootLayout } from "./components/root-layout.tsx";
export { DocsLayout } from "./components/docs-layout.tsx";
export { DocPage } from "./components/doc-page.tsx";
export type { PortoDocPage, PortoDocPageData } from "./components/doc-page.tsx";
export { DocsHomePage } from "./components/docs-home-page.tsx";
export { NotesIndexPage } from "./components/notes-index-page.tsx";
export type { NoteCardPage } from "./components/notes-index-page.tsx";
export { BlogIndexPage } from "./components/blog-index-page.tsx";
export type { BlogIndexPost } from "./components/blog-index-page.tsx";
export { BlogPostPage } from "./components/blog-post-page.tsx";
export type { PortoBlogPost } from "./components/blog-post-page.tsx";
export { BlogAuthorsPage } from "./components/blog-authors-page.tsx";
export { TasksPage } from "./components/tasks-page.tsx";
export { SearchPage } from "./components/search-page.tsx";
export { OfflinePage } from "./components/offline-page.tsx";
export { RedirectPage } from "./components/redirect-page.tsx";
export { NotFoundPage } from "./components/not-found-page.tsx";

// Shell + chrome components
export { SiteShell } from "./components/SiteShell.tsx";
export { Navbar } from "./components/Navbar.tsx";
export { Sidebar } from "./components/Sidebar.tsx";
export { MobileMenu } from "./components/MobileMenu.tsx";
export { MobileMenuFooter } from "./components/MobileMenuFooter.tsx";
export {
  TableOfContents,
  TableOfContentsList,
} from "./components/TableOfContents.tsx";
export { MobileTableOfContents } from "./components/MobileTableOfContents.tsx";
export { PageSidebar } from "./components/PageSidebar.tsx";
export { SearchDialog } from "./components/SearchDialog.tsx";
export { ThemeSelect } from "./components/ThemeSelect.tsx";
export { Footer } from "./components/Footer.tsx";
export { Pagination } from "./components/Pagination.tsx";
export { Breadcrumbs } from "./components/Breadcrumbs.tsx";
export { EditLink } from "./components/EditLink.tsx";
export { LastUpdated } from "./components/LastUpdated.tsx";
export { SkipLink } from "./components/SkipLink.tsx";
export { NavProgress } from "./components/NavProgress.tsx";
export { PageTitle } from "./components/PageTitle.tsx";
export { ContentPanel } from "./components/ContentPanel.tsx";
export { DocFooter } from "./components/DocFooter.tsx";
export { SiteTitle } from "./components/SiteTitle.tsx";
export { PortoIcon } from "./components/PortoIcon.tsx";
export { HeroImage } from "./components/HeroImage.tsx";
export { KaTeXStyles } from "./components/KaTeXStyles.tsx";
export { BlogSidebar } from "./components/BlogSidebar.tsx";
export type { BlogSidebarPost } from "./components/BlogSidebar.tsx";
export { TasksTable } from "./components/TasksTable.tsx";
export type {
  TasksTab,
  TasksRow,
  TasksStats,
} from "./components/TasksTable.tsx";
export { SearchPageBody } from "./components/SearchPageBody.tsx";
export { RedirectBody } from "./components/RedirectBody.tsx";
export { ReloadButton } from "./components/ReloadButton.tsx";

// MDX entry (canonical Fumadocs pattern)
export {
  getMDXComponents,
  useMDXComponents,
  Btn,
  Details,
  Dropdown,
  DynamicIcon,
  Hint,
  Icon,
  IconSearch,
  Indent,
  Link,
  Pv,
  TabItem,
  Tabs,
  TopicList,
  TopicListProvider,
  TopicListContext,
} from "./components/mdx.tsx";
export type {
  TopicListContextValue,
  TopicListItem,
} from "./components/mdx.tsx";

// Lib
export type { PortosaurOptions, PortoPkg, PortoPaths } from "./lib/config.ts";
export {
  pageHref,
  normalizePathname,
  isSamePage,
  stripBase,
} from "./lib/pageUrl.ts";
export { cn } from "./lib/cn.ts";
export {
  findBreadcrumbs,
  findPrevNext,
  findCategoryItems,
  topicCardTitle,
  topicListShouldRender,
  tocToHeadings,
  nestHeadings,
  blogSlug,
  nodeName,
} from "./lib/content.ts";
export type {
  SidebarLink,
  Breadcrumb,
  TocHeading,
  TocItem,
} from "./lib/content.ts";
export { buildNavEntries, isDropdown, PORTO_HOMEPAGE } from "./lib/navbar.ts";
export type {
  NavLink,
  NavDropdown,
  NavEntry,
  NavEntries,
} from "./lib/navbar.ts";
export { prepareSidebar } from "./lib/sidebar.ts";
export type { SidebarItem, PreparedSidebar } from "./lib/sidebar.ts";
export { createRelativeLink } from "./lib/mdx-link.tsx";
export {
  resolveAuthor,
  formatPostDate,
  sortPostsByDateDesc,
} from "./lib/blog.ts";
export type { BlogAuthor, AuthorRef, BlogPostSummary } from "./lib/blog.ts";
export { PortoProvider, usePortoConfig } from "./lib/porto-context.tsx";
export {
  getTheme,
  getPreferredColorScheme,
  loadTheme,
  updateThemeColor,
  setTheme,
  useThemePreference,
  THEME_LABELS,
} from "./lib/theme.ts";
export type { ThemeMode, ThemePreference } from "./lib/theme.ts";
export { flattenResults } from "./lib/search-results.ts";
export type { FlatResult } from "./lib/search-results.ts";
export { PortoIcons } from "./lib/porto-icons.ts";
export type { PortoIcon as PortoIconName } from "./lib/porto-icons.ts";
