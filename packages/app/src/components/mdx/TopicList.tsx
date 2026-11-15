"use client";

import Link from "next/link";
import { createContext, useContext, useRef, type ReactNode } from "react";
import {
  TOPIC_LIST_DEFAULT_DESC,
  type TopicListItem,
} from "../../lib/content.ts";

export type { TopicListItem } from "../../lib/content.ts";

/**
 * TopicList — the Docusaurus `TopicCard` list, as cards with an icon,
 * a title, and a description, in a two-column grid.
 *
 * Two modes, like the original:
 *
 * - **Automatic**: the doc page renders `<AutoTopicList />` after
 *   the content on index pages, with cards resolved server-side
 *   (`topicListCards` + icon HTML). The description line above the
 *   cards comes from the context (resolved by the doc page).
 * - **Manual**: an explicit `<TopicList />` tag in MDX content
 *   renders the current category's cards from the context at the
 *   position where the tag appears. A manual list on a non-index
 *   page needs `forceRender`.
 *
 * A manual tag suppresses the automatic list: the author's placement
 * wins, and the page never shows the list twice. The provider holds
 * a shared flag the manual list sets when it renders; the automatic
 * list reads it after the content has rendered.
 *
 * The description line resolves like the original: children, then
 * the `desc` prop, then the context (frontmatter `topic_list.desc`,
 * else the page `desc`), then the default — `null` disables it.
 * Categories show their child count as a badge beside the title;
 * the card description is the page text alone (OG prefixed the
 * count into it — "3 items • ...").
 *
 * The cards' icon HTML is resolved server-side by the doc page —
 * the icon packs are megabytes of JSON and must never load
 * client-side, so this component only injects the given HTML.
 * Items passed manually carry no icon HTML and render without an
 * icon. An emoji icon renders as part of the title text instead
 * (`topicCardTitle` prepends it), never as a separate icon.
 */

export interface TopicListContextValue {
  cards: TopicListItem[];
  desc: string | null;
  shouldRender: boolean;
  /* Set by a manual `<TopicList />` tag when it renders, so the
     automatic list below the content can stand down. The provider
     owns the flag — it must live client-side, where both lists
     render, so it is not part of the server-provided value. */
  manualRendered: { current: boolean };
}

export const TopicListContext = createContext<TopicListContextValue | null>(
  null,
);

export function TopicListProvider({
  value,
  children,
}: {
  value: Omit<TopicListContextValue, "manualRendered">;
  children: ReactNode;
}) {
  const manualRendered = useRef(false);
  return (
    <TopicListContext.Provider value={{ ...value, manualRendered }}>
      {children}
    </TopicListContext.Provider>
  );
}

/* "1 item" / "N items" — the category count prefix. */
function itemsCountLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

function TopicCard({ card }: { card: TopicListItem }) {
  /* Categories show their child count as a badge beside the
     title — a bare number in a pill, with the full "N items"
     label as its tooltip. The badge sits OUTSIDE the `h2`, so
     the URL snapshot (which tracks h1/h2 text) keeps reading
     the plain title. */
  const count =
    card.isCategory && card.itemsCount !== undefined && card.itemsCount > 0
      ? card.itemsCount
      : null;
  /* A card is an internal page link — Next.js `<Link>` navigates
     client-side, so the sidebar and shell stay mounted. A plain
     `<a>` reloaded the whole document on every card click, and
     the sidebar visibly re-mounted (fold animations replaying). */
  /* OG's card: the icon sits inline in the title row beside a
     big accent title, and the description is one truncated
     line. The title stays an `h2`: the URL snapshot only tracks
     h1/h2 headings, and OG renders card titles as h2 too. */
  return (
    <Link
      href={card.href}
      className="porto-topic-list__card"
      title={card.description || undefined}
    >
      <div className="porto-topic-list__header">
        <h2 className="porto-topic-list__title" title={card.title}>
          {card.iconHtml ? (
            <span
              className="porto-topic-list__icon"
              style={card.color ? { color: card.color } : undefined}
              dangerouslySetInnerHTML={{ __html: card.iconHtml }}
            />
          ) : null}
          <span className="porto-topic-list__title-text">{card.title}</span>
        </h2>
        {count !== null ? (
          <span
            className="porto-topic-list__count"
            title={itemsCountLabel(count)}
          >
            {count}
          </span>
        ) : null}
      </div>
      {card.description ? (
        <p className="porto-topic-list__description">{card.description}</p>
      ) : null}
    </Link>
  );
}

export function TopicList({
  forceRender = false,
  items: propItems,
  desc,
  children,
}: {
  forceRender?: boolean;
  items?: TopicListItem[];
  desc?: ReactNode | null;
  children?: ReactNode;
}) {
  const context = useContext(TopicListContext);
  const cards: TopicListItem[] = propItems ?? context?.cards ?? [];
  const shouldRender =
    propItems !== undefined || forceRender || (context?.shouldRender ?? false);
  /* `null` disables the line, so the checks must tell "not
     provided" (undefined) from "disabled" (null) — `??` alone
     would treat null as missing and fall through to the default. */
  const resolvedDesc =
    children !== undefined
      ? children
      : desc !== undefined
        ? desc
        : (context?.desc ?? TOPIC_LIST_DEFAULT_DESC);
  if (!shouldRender || cards.length === 0) {
    return null;
  }
  /* A manual list claims the page: the automatic list below the
     content stands down. This runs during render, which is safe
     here — React renders the content before the automatic list
     below it, so the flag is always set before it is read. */
  const isAutoList = propItems !== undefined;
  if (!isAutoList && context) {
    context.manualRendered.current = true;
  }
  /* The automatic list sits in the body panel, whose padding is
     already the separation from the title panel above — its
     description needs no top margin. A manual tag follows MDX
     content, so it keeps the original top margin. */
  /* `not-content` opts the whole list out of the markdown prose
     rules (content.css): a manual list renders INSIDE the
     markdown content, where the link rule recolored the cards
     accent (the description inherits it) and wiped the hover
     transitions — the automatic list sits outside the content
     and never saw any of that. With the opt-out both lists
     render from the card rules alone, identically. */
  return (
    <div className="porto-topic-list-wrapper not-content">
      {resolvedDesc !== null && (
        <div
          className={
            isAutoList
              ? "porto-topic-list__desc porto-topic-list__desc--auto"
              : "porto-topic-list__desc"
          }
        >
          {resolvedDesc}
        </div>
      )}
      <section className="porto-topic-list">
        {cards.map((card) => (
          <TopicCard key={card.href} card={card} />
        ))}
      </section>
    </div>
  );
}

/**
 * The automatic list, rendered by the doc page after the content.
 * Stands down when the content already placed a manual list — the
 * author's placement wins.
 */
export function AutoTopicList({
  items,
  desc,
}: {
  items: TopicListItem[];
  desc: string | null;
}) {
  const context = useContext(TopicListContext);
  const shouldRender = context?.shouldRender ?? false;
  if (!shouldRender || items.length === 0) {
    return null;
  }
  if (context?.manualRendered.current) {
    return null;
  }
  return <TopicList items={items} desc={desc} />;
}
