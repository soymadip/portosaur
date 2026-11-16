import Link from "next/link";
import { pageHref } from "../../../../lib/pageUrl.ts";

/**
 * Blog sidebar ("Recent posts") — the Docusaurus `BlogSidebar`:
 * posts grouped by year (newest year first), each post a link
 * under its year. Used on the blog list pages and on post pages
 * (left column). The current post (on post pages) is marked
 * `aria-current`. Undated posts gather under "Undated" at the
 * end; posts keep their input order within a year (routes pass
 * them newest first).
 */

export interface BlogSidebarPost {
  url: string;
  title: string;
  date: Date | string | null;
}

export function BlogSidebar({
  posts,
  currentUrl,
}: {
  posts: BlogSidebarPost[];
  currentUrl?: string;
}) {
  const byYear = new Map<number, BlogSidebarPost[]>();
  const undated: BlogSidebarPost[] = [];
  for (const post of posts) {
    const parsed = post.date ? new Date(post.date) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const group = byYear.get(year) ?? [];
      group.push(post);
      byYear.set(year, group);
    } else {
      undated.push(post);
    }
  }
  const groups = [...byYear.keys()]
    .sort((a, b) => b - a)
    .map((year) => ({ label: String(year), posts: byYear.get(year) ?? [] }));
  if (undated.length > 0) {
    groups.push({ label: "Undated", posts: undated });
  }
  return (
    <aside className="porto-blog-sidebar">
      <nav aria-label="Recent posts">
        <h3 className="porto-blog-sidebar-title">Recent posts</h3>
        {groups.map((group) => (
          <div key={group.label} className="porto-blog-sidebar-group">
            <h4 className="porto-blog-sidebar-year">{group.label}</h4>
            <ul className="porto-blog-sidebar-list">
              {group.posts.map((post) => (
                <li key={post.url}>
                  <Link
                    className="porto-blog-sidebar-link"
                    href={pageHref(post.url)}
                    aria-current={currentUrl === post.url ? "page" : undefined}
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
