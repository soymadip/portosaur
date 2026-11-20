import Link from "next/link";
import type { PortosaurOptions } from "../../lib/config.ts";
import { renderDynamicIcon, renderIcon, techMap } from "../../lib/icons.ts";
import { pageHref } from "../../lib/pageUrl.ts";
import { SiteShell } from "./frame/SiteShell.tsx";

/**
 * NotesIndexPage — the `/notes` grid (the Astro `notecards.astro`
 * page, which exists in both modes). Its own shell (SiteShell,
 * no sidebar). The h1 is always "My Notes". The metadata title
 * is the capitalized notes route ("Docs"/"Notes") — the route's
 * job, via `pageTitle`.
 *
 * The route maps loader data to `pages` (top-level files +
 * top-level dirs with an index, in filename order —
 * `sidebar_position` was removed in decision 24, so there is no
 * position sort anymore). Drafts hide in production.
 *
 * Hash navigation + the NavArrow scroll button are NOT ported
 * (interactive enhancements — the cards keep their `note-<slug>`
 * ids so hash navigation can land later).
 */

/** One note card, as the generated route passes it. */
export interface NoteCardPage {
  title: string;
  href: string;
  description?: string;
  icon?: string;
  color?: string;
  slug: string;
  draft?: boolean;
}

export function NotesIndexPage({
  config,
  pages,
}: {
  config: PortosaurOptions;
  pages: NoteCardPage[];
}) {
  const base = config.site.baseUrl;
  const notes = pages.filter((note) => {
    if (note.draft && process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  });
  return (
    <SiteShell config={config}>
      <div className="notesContainer porto-notes-page">
        <div className="porto-notes-inner">
          <header className="porto-notes-header">
            <h1 className="porto-notes-title">My Notes</h1>
            <p className="porto-notes-subtitle">
              A collection of my self written notes &amp; reference guides
            </p>
          </header>
          {notes.length > 0 && (
            <div className="porto-note-grid" role="list">
              {notes.map((note, index) => {
                // Resolve color: explicit frontmatter first, then
                // techMap guessing, then default.
                const slugLower = note.slug.toLowerCase();
                const iconStrLower = (note.icon || "").toLowerCase();
                const mappedColor =
                  techMap[iconStrLower]?.color || techMap[slugLower]?.color;
                const color =
                  note.color || mappedColor || "var(--porto-color-accent)";
                return (
                  <Link
                    key={note.slug}
                    id={`note-${note.slug}`}
                    href={pageHref(note.href)}
                    className="noteCard"
                    style={
                      {
                        "--card-index": index,
                        "--note-color": color,
                      } as React.CSSProperties
                    }
                    aria-label={`Read note: ${note.title}`}
                    title={note.description || undefined}
                  >
                    <div className="porto-note-icon-wrap">
                      <span
                        className="noteIcon"
                        dangerouslySetInnerHTML={{
                          __html: renderDynamicIcon(note.icon ?? undefined, {
                            slug: note.slug,
                            fallbackIcon: "md:book",
                            base,
                          }),
                        }}
                      />
                    </div>
                    <div className="porto-note-text">
                      <h3 className="porto-note-title" title={note.title}>
                        {note.title}
                      </h3>
                    </div>
                    <span
                      className="mobileChevron"
                      dangerouslySetInnerHTML={{
                        __html: renderIcon("md:chevron-right"),
                      }}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
