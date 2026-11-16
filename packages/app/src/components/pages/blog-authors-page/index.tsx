import Link from "next/link";
import type { BlogAuthor } from "../../../lib/blog.ts";
import type { PortosaurOptions } from "../../../lib/config.ts";
import { pageHref } from "../../../lib/pageUrl.ts";
import { SiteShell } from "../frame/SiteShell/index.tsx";

/**
 * BlogAuthorsPage — the blog authors index
 * (`/${blogRoute}/authors`).
 *
 * One h2 per author, linked to the author page when the author
 * has `page: true`, with title and URL beneath (plain text when
 * there is no page). Renders nothing but the h1 when
 * `authors.yml` is absent.
 */
export function BlogAuthorsPage({
  config,
  authors,
}: {
  config: PortosaurOptions;
  authors: BlogAuthor[];
}) {
  const blogRoute = config.site.blogRoute;
  return (
    <SiteShell config={config}>
      <div className="porto-blog-list-page porto-blog-list-page--tight">
        <h1 className="porto-blog-list-title porto-blog-list-title--tight">
          Authors
        </h1>
        {authors.length === 0 ? (
          <p className="porto-blog-empty-text">No authors yet.</p>
        ) : (
          authors.map((author) => (
            <section key={author.key}>
              <h2 className="porto-blog-author-entry-title">
                {author.hasPage ? (
                  <Link href={pageHref(`/${blogRoute}/authors/${author.key}`)}>
                    {author.name}
                  </Link>
                ) : (
                  author.name
                )}
              </h2>
              {author.title && (
                <p className="porto-blog-author-title">{author.title}</p>
              )}
              {author.url && (
                <p className="porto-blog-author-url">
                  <a
                    href={author.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {author.url}
                  </a>
                </p>
              )}
            </section>
          ))
        )}
      </div>
    </SiteShell>
  );
}
