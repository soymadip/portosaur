/**
 * @portosaur/app — the public barrel. The generated root imports
 * most things via deep paths (`@portosaur/app/components/pages/doc-page`,
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
export { RootLayout } from "./components/layouts/root-layout.tsx";
export { DocsLayout } from "./components/layouts/docs-layout.tsx";
export { DocPage } from "./components/pages/doc-page.tsx";
export type {
  PortoDocPage,
  PortoDocPageData,
} from "./components/pages/doc-page.tsx";
export { DocsHomePage } from "./components/pages/docs-home-page.tsx";
export { NotesIndexPage } from "./components/pages/notes-index-page.tsx";
export type { NoteCardPage } from "./components/pages/notes-index-page.tsx";
export { BlogIndexPage } from "./components/pages/blog-index-page.tsx";
export type { BlogIndexPost } from "./components/pages/blog-index-page.tsx";
export { BlogPostPage } from "./components/pages/blog-post-page.tsx";
export type { PortoBlogPost } from "./components/pages/blog-post-page.tsx";
export { BlogAuthorsPage } from "./components/pages/blog-authors-page.tsx";
export { TasksPage } from "./components/pages/tasks-page.tsx";
export { SearchPage } from "./components/pages/search-page.tsx";
export { OfflinePage } from "./components/pages/offline-page.tsx";
export { RedirectPage } from "./components/pages/redirect-page.tsx";
export { NotFoundPage } from "./components/pages/not-found-page.tsx";

// Page frame + parts
export { SiteShell } from "./components/pages/frame/SiteShell.tsx";
export { Navbar } from "./components/pages/frame/Navbar.tsx";
export { Sidebar } from "./components/pages/frame/Sidebar.tsx";
export { MobileMenu } from "./components/pages/frame/MobileMenu.tsx";
export { MobileMenuFooter } from "./components/pages/frame/MobileMenuFooter.tsx";
export {
  TableOfContents,
  TableOfContentsList,
} from "./components/pages/frame/TableOfContents.tsx";
export { MobileTableOfContents } from "./components/pages/frame/MobileTableOfContents.tsx";
export { PageSidebar } from "./components/pages/frame/PageSidebar.tsx";
export { SearchDialog } from "./components/pages/frame/SearchDialog.tsx";
export { ThemeSelect } from "./components/pages/frame/ThemeSelect.tsx";
export { Footer } from "./components/pages/parts/Footer.tsx";
export { Pagination } from "./components/pages/parts/Pagination.tsx";
export { EditLink } from "./components/pages/parts/EditLink.tsx";
export { LastUpdated } from "./components/pages/parts/LastUpdated.tsx";
export { SkipLink } from "./components/pages/frame/SkipLink.tsx";
export { NavProgress } from "./components/pages/frame/NavProgress.tsx";
export { PageTitle } from "./components/pages/parts/PageTitle.tsx";
export { ContentPanel } from "./components/pages/parts/ContentPanel.tsx";
export { DocFooter } from "./components/pages/parts/DocFooter.tsx";
export { SiteTitle } from "./components/pages/frame/SiteTitle.tsx";
export { PortoIcon } from "./components/PortoIcon.tsx";
export { HeroImage } from "./components/pages/HeroImage.tsx";
export { KaTeXStyles } from "./components/pages/parts/KaTeXStyles.tsx";
export { BlogSidebar } from "./components/pages/frame/BlogSidebar.tsx";
export type { BlogSidebarPost } from "./components/pages/frame/BlogSidebar.tsx";
export { TasksTable } from "./components/pages/TasksTable.tsx";
export type {
  TasksTab,
  TasksRow,
  TasksStats,
} from "./components/pages/TasksTable.tsx";
export { SearchPageBody } from "./components/pages/SearchPageBody.tsx";
export { RedirectBody } from "./components/pages/RedirectBody.tsx";
export { ReloadButton } from "./components/pages/ReloadButton.tsx";

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
  AutoTopicList,
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
  findPrevNext,
  findCategoryItems,
  isEmojiIcon,
  topicListShouldRender,
  tocToHeadings,
  nestHeadings,
  blogSlug,
  nodeName,
} from "./lib/content.ts";
export type { SidebarLink, TocHeading, TocItem } from "./lib/content.ts";
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
