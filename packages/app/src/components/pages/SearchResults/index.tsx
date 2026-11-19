"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  flattenGroups,
  splitMatches,
  type FlatResult,
  type SearchGroup,
} from "../../../lib/search-results.ts";
import { Dropdown } from "../../Dropdown/index.tsx";

/**
 * The search results list, shared by the search dialog and the
 * search page: one Starlight-style card per page — the page itself
 * as the header row (document icon + title), its matching headings
 * and text chunks as rows underneath, tied together with the
 * tree-branch lines. Matches are bold (`<mark>`), not highlighted.
 * Rows from the same table render as one grid — the header once,
 * each row its own link.
 *
 * The dialog passes `listbox` + `activeIndex` for keyboard
 * navigation. The page renders a plain list.
 *
 * The hover fill is one gliding block, like the sidebar's — a
 * single tinted box that slides between rows instead of each row
 * flashing its own background on and off. It follows the hovered
 * row, and the keyboard-active row when the mouse is elsewhere.
 * The rows carry no hover fill of their own. The block sits in
 * front of the rows (they are opaque), pointer-events off, so
 * clicks still land on the link underneath.
 */

/** One run of text, bold when it matches the query. */
function HighlightedText({ text, query }: { text: string; query: string }) {
  const segments = splitMatches(text, query);
  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark key={index}>{segment.text}</mark>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

function ResultLink({
  entry,
  index,
  active,
  query,
  listbox,
  onSelect,
  onHover,
}: {
  entry: FlatResult;
  index: number;
  active: boolean;
  query: string;
  listbox: boolean;
  onSelect?: () => void;
  onHover?: (index: number) => void;
}) {
  const isPage = entry.type === "page";
  const className = [
    "porto-search-result",
    isPage ? "porto-search-result--page" : "porto-search-result--nested",
  ].join(" ");
  return (
    <Link
      href={entry.url}
      id={listbox ? `porto-search-option-${entry.id}` : undefined}
      role={listbox ? "option" : undefined}
      aria-selected={listbox ? active : undefined}
      data-result-index={index}
      className={className}
      onClick={onSelect}
      onMouseEnter={onHover ? () => onHover(index) : undefined}
    >
      {isPage || entry.type === "heading" ? (
        <span className="porto-search-result__title">
          <HighlightedText text={entry.content} query={query} />
        </span>
      ) : (
        <span className="porto-search-result__excerpt">
          <HighlightedText text={entry.content} query={query} />
        </span>
      )}
    </Link>
  );
}

/** One render chunk: a plain entry, or consecutive rows of one table. */
type EntryChunk =
  | { kind: "entry"; entry: FlatResult }
  | { kind: "table"; tableId: string; rows: FlatResult[] };

/** Groups consecutive rows of the same table. Everything else stays single. */
function chunkEntries(entries: FlatResult[]): EntryChunk[] {
  const chunks: EntryChunk[] = [];
  for (const entry of entries) {
    const tableId = entry.type === "table-row" ? entry.tableId : undefined;
    const last = chunks[chunks.length - 1];
    if (tableId && last?.kind === "table" && last.tableId === tableId) {
      last.rows.push(entry);
    } else if (tableId) {
      chunks.push({ kind: "table", tableId, rows: [entry] });
    } else {
      chunks.push({ kind: "entry", entry });
    }
  }
  return chunks;
}

/**
 * One table's rows as a grid: the header once, then each row as its
 * own link, all sharing the grid's columns (subgrid) — Fumadocs'
 * table layout. The block itself is a nested card row, so it
 * carries the tree branch. The rows inside are the keyboard-nav
 * entries, one flat index each.
 */
function TableBlock({
  rows,
  query,
  activeIndex,
  indexOf,
  listbox,
  onSelect,
  onHover,
}: {
  rows: FlatResult[];
  query: string;
  activeIndex: number;
  indexOf: Map<string, number>;
  listbox: boolean;
  onSelect?: () => void;
  onHover?: (index: number) => void;
}) {
  const header = rows[0].headerCells ?? [];
  const columns = Math.max(
    header.length,
    ...rows.map((row) => row.cells?.length ?? 0),
  );
  // Fumadocs' column sizing: every column but the last fits its
  // content (up to 30% of the grid), the last takes the rest.
  const template =
    columns > 1
      ? `${"fit-content(30%) ".repeat(columns - 1)}minmax(30%, 1fr)`
      : "minmax(30%, 1fr)";
  const headerId = `porto-search-table-${rows[0].tableId}`;
  return (
    <div
      className="porto-search-result--nested porto-search-table"
      role={header.length > 0 ? "group" : undefined}
      aria-labelledby={header.length > 0 ? headerId : undefined}
    >
      <div
        className="porto-search-table__grid"
        style={{ gridTemplateColumns: template }}
      >
        {header.length > 0 && (
          <div id={headerId} aria-hidden className="porto-search-table__header">
            {header.map((cell, index) => (
              <span key={index} className="porto-search-table__header-cell">
                <HighlightedText text={cell} query={query} />
              </span>
            ))}
          </div>
        )}
        {rows.map((row) => {
          const index = indexOf.get(row.id) ?? -1;
          const active = index === activeIndex;
          return (
            <Link
              key={row.id}
              href={row.url}
              id={listbox ? `porto-search-option-${row.id}` : undefined}
              role={listbox ? "option" : undefined}
              aria-selected={listbox ? active : undefined}
              data-result-index={index}
              className="porto-search-result porto-search-table__row"
              onClick={onSelect}
              onMouseEnter={onHover ? () => onHover(index) : undefined}
            >
              {(row.cells ?? []).map((cell, index) => (
                <span key={index} className="porto-search-table__cell">
                  <HighlightedText text={cell} query={query} />
                </span>
              ))}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function SearchResults({
  groups,
  query,
  activeIndex = -1,
  onHoverIndex,
  onSelect,
  listbox = false,
  listId,
}: {
  groups: SearchGroup[];
  query: string;
  /** The flat index of the keyboard-active entry (dialog only). */
  activeIndex?: number;
  /** Called with the flat index when the pointer enters an entry. */
  onHoverIndex?: (index: number) => void;
  /** Called when an entry is clicked (the dialog closes). */
  onSelect?: () => void;
  /** Listbox semantics for the dialog. A plain list on the page. */
  listbox?: boolean;
  /** The list's id, for the dialog input's `aria-controls`. */
  listId?: string;
}) {
  const indexOf = useMemo(() => {
    const map = new Map<string, number>();
    flattenGroups(groups).forEach((entry, index) => {
      map.set(entry.id, index);
    });
    return map;
  }, [groups]);

  // The hovered row, tracked here so the block works on the page
  // too (the page passes no hover callback). Hover wins over the
  // keyboard row while the mouse is over the list.
  const [hoverIndex, setHoverIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<Element | null>(null);
  const targetIndex = hoverIndex >= 0 ? hoverIndex : activeIndex;

  const handleHover = (index: number) => {
    setHoverIndex(index);
    if (onHoverIndex) {
      onHoverIndex(index);
    }
  };

  // Glide the block to the target row. It appears in place when
  // coming from outside, glides between rows, and fades out when
  // there is no target. The block copies the row's corner radius,
  // so it hugs the card's rounded first and last rows.
  useEffect(() => {
    const wrap = wrapRef.current;
    const block = blockRef.current;
    if (!wrap || !block) {
      return;
    }
    const row =
      targetIndex >= 0
        ? wrap.querySelector(`[data-result-index="${targetIndex}"]`)
        : null;
    if (row === currentRef.current) {
      return;
    }
    block.style.transitionProperty = currentRef.current ? "" : "opacity";
    currentRef.current = row;
    if (!row) {
      block.style.opacity = "0";
      return;
    }
    const rect = row.getBoundingClientRect();
    const origin = wrap.getBoundingClientRect();
    block.style.translate = `${rect.left - origin.left}px ${rect.top - origin.top}px`;
    block.style.width = `${rect.width}px`;
    block.style.height = `${rect.height}px`;
    block.style.borderRadius = getComputedStyle(row).borderRadius;
    block.style.opacity = "1";
  }, [targetIndex, groups]);

  // A resize (or a phone rotating) reflows the rows — snap the
  // block to the current row's new box instead of leaving it over
  // the old one. The snap sets the transition to opacity-only, so
  // the reposition is instant; the next hover or arrow key
  // restores the glide.
  useEffect(() => {
    const onResize = () => {
      const wrap = wrapRef.current;
      const block = blockRef.current;
      const row = currentRef.current;
      if (!wrap || !block || !row) {
        return;
      }
      const rect = row.getBoundingClientRect();
      const origin = wrap.getBoundingClientRect();
      block.style.transitionProperty = "opacity";
      block.style.translate = `${rect.left - origin.left}px ${rect.top - origin.top}px`;
      block.style.width = `${rect.width}px`;
      block.style.height = `${rect.height}px`;
      block.style.borderRadius = getComputedStyle(row).borderRadius;
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      className="porto-search-results__wrap"
      ref={wrapRef}
      onMouseLeave={() => setHoverIndex(-1)}
    >
      <div
        aria-hidden="true"
        className="porto-search-results__hover-block"
        ref={blockRef}
      />
      <ul
        id={listId}
        className="porto-search-results"
        role={listbox ? "listbox" : undefined}
      >
        {groups.map((group) => (
          <li key={group.pageUrl}>
            <div className="porto-search-group__card">
              <ResultLink
                entry={group.header}
                index={indexOf.get(group.header.id) ?? -1}
                active={indexOf.get(group.header.id) === activeIndex}
                query={query}
                listbox={listbox}
                onSelect={onSelect}
                onHover={handleHover}
              />
              {chunkEntries(group.entries).map((chunk) =>
                chunk.kind === "entry" ? (
                  <ResultLink
                    key={chunk.entry.id}
                    entry={chunk.entry}
                    index={indexOf.get(chunk.entry.id) ?? -1}
                    active={indexOf.get(chunk.entry.id) === activeIndex}
                    query={query}
                    listbox={listbox}
                    onSelect={onSelect}
                    onHover={handleHover}
                  />
                ) : (
                  <TableBlock
                    key={chunk.tableId}
                    rows={chunk.rows}
                    query={query}
                    activeIndex={activeIndex}
                    indexOf={indexOf}
                    listbox={listbox}
                    onSelect={onSelect}
                    onHover={handleHover}
                  />
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The "Filter [All ▾]" row — Fumadocs' tag filter, Portosaur's
 * version narrowing by docs section instead (the index carries no
 * tags. Every result is a docs page). The dialog renders it in its
 * footer. The page renders it under its input.
 */
export function SearchSectionFilter({
  sections,
  value,
  onChange,
  dropUp = false,
}: {
  /** The sections the current results span, in first-seen order. */
  sections: string[];
  /** The selected section, or "All". */
  value: string;
  onChange: (section: string) => void;
  /** Open the menu above the trigger instead of below it. */
  dropUp?: boolean;
}) {
  return (
    <div className="porto-search-filter">
      <span className="porto-search-filter__label">Filter</span>
      <Dropdown
        trigger={value}
        items={[
          {
            label: "All",
            active: value === "All",
            onClick: () => onChange("All"),
          },
          ...sections.map((section) => ({
            label: section,
            active: value === section,
            onClick: () => onChange(section),
          })),
        ]}
        size="sm"
        align="left"
        dropUp={dropUp}
        ariaLabel="Filter results by section"
      />
    </div>
  );
}
