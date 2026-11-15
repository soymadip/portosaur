"use client";

import { createContext, useContext, type ReactNode } from "react";
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
 * - **Automatic**: the doc page renders `<TopicList items={cards} />`
 *   after the content on index pages, with cards resolved server-side
 *   (`topicListCards` + icon HTML). The description line above the
 *   cards comes from the context (resolved by the doc page).
 * - **Manual**: an explicit `<TopicList />` tag in MDX content
 *   renders the current category's cards from the context at the
 *   position where the tag appears. A manual list on a non-index
 *   page needs `forceRender`.
 *
 * The description line resolves like the original: children, then
 * the `desc` prop, then the context (frontmatter `topic_list.desc`,
 * else the page `desc`), then the default — `null` disables it.
 * Categories prefix their description with the child count
 * ("3 items • ..."); plain pages show the description as-is.
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
}

export const TopicListContext = createContext<TopicListContextValue | null>(
  null,
);

export function TopicListProvider({
  value,
  children,
}: {
  value: TopicListContextValue;
  children: ReactNode;
}) {
  return (
    <TopicListContext.Provider value={value}>
      {children}
    </TopicListContext.Provider>
  );
}

/* "1 item" / "N items" — the category count prefix. */
function itemsCountLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

function TopicCard({ card }: { card: TopicListItem }) {
  const count =
    card.isCategory && card.itemsCount !== undefined
      ? itemsCountLabel(card.itemsCount)
      : null;
  const fullDescription =
    count && card.description
      ? `${count} • ${card.description}`
      : (count ?? card.description);
  return (
    <a
      href={card.href}
      className="porto-topic-list__card"
      title={fullDescription || undefined}
    >
      <h2 className="porto-topic-list__title" title={card.title}>
        {card.iconHtml ? (
          <span
            className="porto-topic-list__icon"
            dangerouslySetInnerHTML={{ __html: card.iconHtml }}
          />
        ) : null}
        <span className="porto-topic-list__title-text">{card.title}</span>
      </h2>
      {fullDescription ? (
        <p className="porto-topic-list__description">
          {count ? <strong>{count}</strong> : null}
          {count && card.description ? (
            <>
              {" "}
              <span className="porto-topic-list__separator">•</span>{" "}
              {card.description}
            </>
          ) : null}
          {!count && card.description ? card.description : null}
        </p>
      ) : null}
    </a>
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
  /* The automatic list sits in the body panel, whose padding is
     already the separation from the title panel above — its
     description needs no top margin. A manual tag follows MDX
     content, so it keeps the original top margin. */
  const isAutoList = propItems !== undefined;
  return (
    <div className="porto-topic-list-wrapper">
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
