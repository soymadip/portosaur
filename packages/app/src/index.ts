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
export { DocsLayout } from "./components/layouts/docs-layout/index.tsx";
export { DocPage } from "./components/pages/doc-page/index.tsx";
export type {
  PortoDocPage,
  PortoDocPageData,
} from "./components/pages/doc-page/index.tsx";
export { DocsHomePage } from "./components/pages/docs-home-page/index.tsx";
export { NotesIndexPage } from "./components/pages/notes-index-page/index.tsx";
export type { NoteCardPage } from "./components/pages/notes-index-page/index.tsx";
export { BlogIndexPage } from "./components/pages/blog-index-page/index.tsx";
export type { BlogIndexPost } from "./components/pages/blog-index-page/index.tsx";
export { BlogPostPage } from "./components/pages/blog-post-page/index.tsx";
export type { PortoBlogPost } from "./components/pages/blog-post-page/index.tsx";
export { BlogAuthorsPage } from "./components/pages/blog-authors-page/index.tsx";
export { TasksPage } from "./components/pages/tasks-page/index.tsx";
export { SearchPage } from "./components/pages/search-page.tsx";
export { OfflinePage } from "./components/pages/offline-page.tsx";
export { RedirectPage } from "./components/pages/redirect-page.tsx";
export { NotFoundPage } from "./components/pages/not-found-page.tsx";

// Page frame + parts
export { SiteShell } from "./components/pages/frame/SiteShell/index.tsx";
export { Navbar } from "./components/pages/frame/Navbar/index.tsx";
export { Sidebar } from "./components/pages/frame/Sidebar/index.tsx";
export { MobileMenu } from "./components/pages/frame/MobileMenu/index.tsx";
export { MobileMenuFooter } from "./components/pages/frame/MobileMenuFooter/index.tsx";
export {
  TableOfContents,
  TableOfContentsList,
} from "./components/pages/frame/TableOfContents/index.tsx";
export { MobileTableOfContents } from "./components/pages/frame/MobileTableOfContents/index.tsx";
export { PageSidebar } from "./components/pages/frame/PageSidebar.tsx";
export { SearchDialog } from "./components/pages/frame/SearchDialog/index.tsx";
export { ThemeSelect } from "./components/pages/frame/ThemeSelect/index.tsx";
export { Footer } from "./components/pages/parts/Footer/index.tsx";
export { Pagination } from "./components/pages/parts/Pagination/index.tsx";
export { EditLink } from "./components/pages/parts/EditLink/index.tsx";
export { LastUpdated } from "./components/pages/parts/LastUpdated.tsx";
export { SkipLink } from "./components/pages/frame/SkipLink/index.tsx";
export { NavProgress } from "./components/pages/frame/NavProgress/index.tsx";
export { PageTitle } from "./components/pages/parts/PageTitle/index.tsx";
export { ContentPanel } from "./components/pages/parts/ContentPanel/index.tsx";
export { DocFooter } from "./components/pages/parts/DocFooter/index.tsx";
export { SiteTitle } from "./components/pages/frame/SiteTitle/index.tsx";
export { PortoIcon } from "./components/PortoIcon.tsx";
export { HeroImage } from "./components/pages/HeroImage.tsx";
export { KaTeXStyles } from "./components/pages/parts/KaTeXStyles.tsx";
export { BlogSidebar } from "./components/pages/frame/BlogSidebar/index.tsx";
export type { BlogSidebarPost } from "./components/pages/frame/BlogSidebar/index.tsx";
export { TasksTable } from "./components/pages/TasksTable/index.tsx";
export type {
  TasksTab,
  TasksRow,
  TasksStats,
} from "./components/pages/TasksTable/index.tsx";
export { SearchPageBody } from "./components/pages/SearchPageBody/index.tsx";
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
export {
  flattenGroups,
  flattenResults,
  groupResults,
  parseTableRow,
  sectionOf,
  splitMatches,
} from "./lib/search-results.ts";
export type {
  FlatResult,
  MatchSegment,
  ParsedTableRow,
  SearchGroup,
} from "./lib/search-results.ts";
export { PortoIcons } from "./lib/porto-icons.ts";
export type { PortoIcon as PortoIconName } from "./lib/porto-icons.ts";
