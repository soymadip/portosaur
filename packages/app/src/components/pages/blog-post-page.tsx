import Link from "next/link";
import type { MDXComponents } from "mdx/types";
import dynamic from "next/dynamic";
import {
  formatPostDate,
  resolveAuthor,
  type BlogAuthor,
} from "../../lib/blog.ts";
import type { PortosaurOptions } from "../../lib/config.ts";
import { docFileTitle, docPageTitles } from "../../lib/docPage.ts";
import {
  localImageDimensions,
  staticDirsForConfig,
} from "../../lib/image-size.ts";
import { pageHref } from "../../lib/pageUrl.ts";
import {
  CONTENT_TITLE_KEY,
  type ContentTitle,
} from "../../plugins/remarkContentTitle.ts";
import { HAS_MATH_KEY } from "../../plugins/remarkHasMath.ts";
import {
  BlogSidebar,
  type BlogSidebarPost,
} from "./frame/BlogSidebar.tsx";
import type { PortoDocPage } from "./doc-page.tsx";
import { getMDXComponents } from "../mdx.tsx";
import { SiteShell } from "./frame/SiteShell.tsx";

/**
 * BlogPostPage — one blog post (`/${blogRoute}/[...slug]`).
 *
 * Title, date, authors (avatar + name + title, linked to their
 * author page when one exists, else to their URL), the full MDX
 * content, a tags footer, and prev/next post navigation (newest
 * first: "Newer post" is the previous item in date order, "Older
 * post" the next).
 *
 * The heading is the frontmatter title, else the hoisted content
 * H1, else the file base (OG strips the content H1 and titles
 * from frontmatter — `remarkContentTitle` does the stripping
 * here). Async: author avatars go through the local image
 * sizer when they are local files the build can read (remote
 * URLs and unsizable files keep a plain `<img>`).
 *
 * Reads everything directly off `post.data` — the collections
 * are eager, so there is no `load()` to call (see `DocPage`).
 */

/** A blog post, as the generated route passes it. */
export interface PortoBlogPost extends PortoDocPage {
  /** The resolved post date (frontmatter `date` first — the route owns the fallback chain). */
  date?: Date | string | null;
}

const KaTeXStyles = dynamic(() =>
  import("./parts/KaTeXStyles.tsx").then((mod) => mod.KaTeXStyles),
);

/** An author avatar URL: absolute and remote URLs pass through, a
 * relative path resolves against the site base URL (the Docusaurus
 * `image_url` rule). */
function resolveAuthorImage(image: string, baseUrl: string): string {
  if (/^(https?:)?\/\//.test(image) || image.startsWith("/")) {
    return image;
  }
  const base = (baseUrl ?? "/").replace(/\/+$/, "");
  return `${base}/${image}`;
}

export async function BlogPostPage({
  config,
  post,
  sidebarPosts,
  newer,
  older,
  authors,
  components,
}: {
  config: PortosaurOptions;
  post: PortoBlogPost;
  sidebarPosts: BlogSidebarPost[];
  newer?: { title: string; href: string } | null;
  older?: { title: string; href: string } | null;
  authors: BlogAuthor[];
  /** MDX overrides from the generated route (the `a` override). */
  components?: MDXComponents;
}) {
  const blogRoute = config.site.blogRoute;
  const data = post.data;
  const exportsMap = data._exports;
  const contentTitleValue = exportsMap?.[CONTENT_TITLE_KEY];
  const contentTitle =
    typeof contentTitleValue === "object" && contentTitleValue !== null
      ? (contentTitleValue as ContentTitle)
      : null;
  const { metaTitle: heading } = docPageTitles(
    data,
    contentTitle,
    docFileTitle(post.path),
  );
  const hasMath = data.math === true || exportsMap?.[HAS_MATH_KEY] === true;
  const date = post.date ? new Date(post.date) : null;
  const tags = data.tags ?? [];
  const currentUrl = pageHref(post.url);

  const postAuthors = await Promise.all(
    (data.authors ?? []).map(async (ref) => {
      const author = resolveAuthor(ref, authors);
      const dims = author.image_url
        ? await localImageDimensions(
            author.image_url,
            staticDirsForConfig(config),
          )
        : null;
      return { ...author, dims };
    }),
  );

  const MDXBody = data.body;

  return (
    <SiteShell config={config}>
      {hasMath && <KaTeXStyles />}
      <div className="porto-blog-layout">
        <BlogSidebar posts={sidebarPosts} currentUrl={currentUrl} />
        <article className="porto-blog-article">
          <header>
            <h1 className="porto-blog-article-title">{heading}</h1>
            {date && !Number.isNaN(date.getTime()) && (
              <time
                className="porto-blog-article-date"
                dateTime={date.toISOString()}
              >
                {formatPostDate(date)}
              </time>
            )}
            {postAuthors.length > 0 && (
              <div className="porto-blog-article-authors">
                {postAuthors.map((author) => (
                  <div key={author.key} className="porto-blog-article-author">
                    {author.image_url && (
                      <img
                        className="porto-blog-article-avatar"
                        src={resolveAuthorImage(
                          author.image_url,
                          config.site.baseUrl,
                        )}
                        alt=""
                        width={author.dims?.width}
                        height={author.dims?.height}
                      />
                    )}
                    <div className="porto-blog-article-author-info">
                      <span className="porto-blog-article-author-name">
                        {author.hasPage ? (
                          <Link
                            className="porto-blog-article-author-name"
                            href={pageHref(
                              `/${blogRoute}/authors/${author.key}`,
                            )}
                          >
                            {author.name}
                          </Link>
                        ) : author.url ? (
                          <a
                            className="porto-blog-article-author-name"
                            href={author.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {author.name}
                          </a>
                        ) : (
                          author.name
                        )}
                      </span>
                      {author.title && (
                        <span className="porto-blog-article-author-title">
                          {author.title}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </header>

          <div className="porto-markdown-content">
            <MDXBody components={getMDXComponents(components)} />
          </div>

          {tags.length > 0 && (
            <footer className="porto-blog-article-tags">
              <span>Tags:</span>
              <ul className="porto-blog-tag-list">
                {tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      className="porto-blog-tag"
                      href={pageHref(`/${blogRoute}/tags/${tag}`)}
                    >
                      {tag}
                    </Link>
                  </li>
                ))}
              </ul>
            </footer>
          )}

          {(newer || older) && (
            <nav className="porto-blog-article-nav" aria-label="Blog posts">
              {newer ? (
                <Link
                  className="porto-blog-article-nav-link"
                  href={pageHref(newer.href)}
                  rel="prev"
                >
                  <span className="porto-blog-article-nav-label">
                    Newer post
                  </span>
                  <span className="porto-blog-article-nav-title">
                    {newer.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {older ? (
                <Link
                  className="porto-blog-article-nav-link porto-blog-article-nav-link--next"
                  href={pageHref(older.href)}
                  rel="next"
                >
                  <span className="porto-blog-article-nav-label">
                    Older post
                  </span>
                  <span className="porto-blog-article-nav-title">
                    {older.title}
                  </span>
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </article>
      </div>
    </SiteShell>
  );
}
