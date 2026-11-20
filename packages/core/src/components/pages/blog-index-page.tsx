import Link from "next/link";
import {
  formatPostDate,
  resolveAuthor,
  sortPostsByDateDesc,
  type BlogAuthor,
  type BlogPostSummary,
} from "../../lib/blog.ts";
import type { PortosaurOptions } from "../../lib/config.ts";
import { pageHref } from "../../lib/pageUrl.ts";
import { SiteIcon } from "../SiteIcon.tsx";
import { BlogSidebar, type BlogSidebarPost } from "./frame/BlogSidebar.tsx";
import { SiteShell } from "./frame/SiteShell.tsx";

/**
 * BlogIndexPage — the blog list (`/${blogRoute}`).
 *
 * Post list, newest first, each item showing title, date,
 * excerpt (the frontmatter description), authors, and tags.
 * When the blog has no posts, the empty state renders instead —
 * the h2 "No posts yet" is verbatim (the docs site's blog has no
 * posts — only `authors.yml`).
 *
 * Phase 1 minimal: all posts on one page (no pagination — the
 * Docusaurus 10/page split is Phase 2), and excerpts are the
 * plain description (rendering truncated MDX excerpts through
 * the markdown processor is Phase 2. A post with
 * `truncated: true` still gets its "Read more" link).
 */

export interface BlogIndexPost extends BlogPostSummary {
  truncated?: boolean;
}

export function BlogIndexPage({
  config,
  posts,
  authors,
}: {
  config: PortosaurOptions;
  posts: BlogIndexPost[];
  authors: BlogAuthor[];
}) {
  const blogRoute = config.site.blogRoute;
  const sorted = sortPostsByDateDesc(posts);
  const sidebarPosts: BlogSidebarPost[] = sorted.map((post) => ({
    url: post.href,
    title: post.title,
    date: post.date ?? null,
  }));
  return (
    <SiteShell config={config}>
      {sorted.length === 0 ? (
        <div className="porto-empty-state">
          <div className="porto-empty-state__icon porto-empty-state__icon--sm">
            <span>
              <SiteIcon icon="md:fountain-pen-tip" size="3rem" />
            </span>
          </div>
          <h2 className="porto-empty-state__title">No posts yet</h2>
          <p className="porto-empty-state__text">
            Check back later — new posts are on the way!
          </p>
        </div>
      ) : (
        <div className="porto-blog-layout">
          <BlogSidebar posts={sidebarPosts} />
          <div className="porto-blog-main">
            {sorted.map((post) => {
              const postAuthors = (post.authors ?? []).map((ref) =>
                resolveAuthor(ref, authors),
              );
              const tags = post.tags ?? [];
              return (
                <article key={post.id}>
                  <h2 className="porto-blog-post-title">
                    <Link href={pageHref(post.href)}>{post.title}</Link>
                  </h2>
                  <div className="porto-blog-post-meta">
                    {post.date && (
                      <time
                        className="porto-blog-post-date"
                        dateTime={new Date(post.date).toISOString()}
                      >
                        {formatPostDate(post.date)}
                      </time>
                    )}
                    {postAuthors.length > 0 && (
                      <div className="porto-blog-post-authors">
                        {postAuthors.map((author) => (
                          <div
                            key={author.key}
                            className="porto-blog-post-author"
                          >
                            {author.hasPage ? (
                              <Link
                                className="porto-blog-post-author-name"
                                href={pageHref(
                                  `/${blogRoute}/authors/${author.key}`,
                                )}
                              >
                                {author.name}
                              </Link>
                            ) : author.url ? (
                              <a
                                className="porto-blog-post-author-name"
                                href={author.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {author.name}
                              </a>
                            ) : (
                              <span className="porto-blog-post-author-name">
                                {author.name}
                              </span>
                            )}
                            {author.title && (
                              <div className="porto-blog-post-author-title">
                                {author.title}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {post.description && (
                    <p className="porto-blog-post-desc">{post.description}</p>
                  )}
                  {(tags.length > 0 || post.truncated) && (
                    <div className="porto-blog-post-foot">
                      {tags.length > 0 && (
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
                      )}
                      {post.truncated && (
                        <Link
                          className="porto-blog-read-more"
                          href={pageHref(post.href)}
                        >
                          Read more
                        </Link>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}
    </SiteShell>
  );
}
