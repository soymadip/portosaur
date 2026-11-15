"use client";

import type * as PageTree from "fumadocs-core/page-tree";
import { createContext, useContext, type ReactNode } from "react";
import { topicCardTitle } from "../../lib/content.ts";
import { pageHref } from "../../lib/pageUrl.ts";

/**
 * TopicList — explicit `<TopicList />` in MDX content.
 *
 * Renders the current sidebar category's child items as h2 cards
 * (the Docusaurus `TopicCard` titles) at the position where the
 * tag appears in the content. The automatic list (rendered after
 * the content on index pages) is the doc page's job, not this
 * component's.
 *
 * The category items + gating come from `TopicListContext`,
 * provided by `DocPage` (a server component can't read the
 * current page itself). With an explicit `items` prop the list
 * renders regardless of context; without context and without
 * `items`, it renders nothing. A manual list on a non-index page
 * needs `forceRender`.
 *
 * Folders without an index page have no link target, so they are
 * skipped (a card linking nowhere is worse than no card).
 */

export interface TopicListItem {
  title: string;
  href: string;
}

export interface TopicListContextValue {
  items: PageTree.Node[];
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

function nodeToCard(node: PageTree.Node): TopicListItem | null {
  if (node.type === "page") {
    return { title: topicCardTitle(node), href: pageHref(node.url) };
  }
  if (node.type === "folder" && node.index) {
    return { title: topicCardTitle(node), href: pageHref(node.index.url) };
  }
  return null;
}

/** Maps tree nodes to topic-list cards (folders without an index page are skipped). */
export function topicListCards(nodes: PageTree.Node[]): TopicListItem[] {
  return nodes
    .map(nodeToCard)
    .filter((card): card is TopicListItem => card !== null);
}

export function TopicList({
  forceRender = false,
  items: propItems,
}: {
  forceRender?: boolean;
  items?: TopicListItem[];
}) {
  const context = useContext(TopicListContext);
  const cards: TopicListItem[] = propItems
    ? propItems
    : topicListCards(context?.items ?? []);
  const shouldRender =
    propItems !== undefined || forceRender || (context?.shouldRender ?? false);
  if (!shouldRender || cards.length === 0) {
    return null;
  }
  return (
    <section className="topic-list">
      {cards.map((card) => (
        <h2 key={card.href}>
          <a href={card.href}>{card.title}</a>
        </h2>
      ))}
    </section>
  );
}
