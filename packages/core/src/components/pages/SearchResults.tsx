"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { markSearchNavigation } from "../../lib/search-highlight.ts";
import {
  flattenGroups,
  splitMatches,
  type FlatResult,
  type SearchGroup,
} from "../../lib/search-results.ts";
import { Dropdown } from "../Dropdown.tsx";
import { SiteIcon } from "../SiteIcon.tsx";

/**
 * The search results list, shared by the search dialog and the
 * search page: Fumadocs' flat list — one row per match, no cards.
 * A page row shows its title first, then its path below it; a
 * heading row shows a `#` with its heading; a text row shows the
 * excerpt. The rows under a page are tied together with a
 * vertical line at the left. Matches are bold, in the accent
 * color, and underlined (`<mark>`). Rows from the same table
 * render as one grid — the header once, each row its own link.
 *
 * The dialog passes `listbox` + `activeIndex` for keyboard
 * navigation. The page renders a plain list.
 *
 * The hover fill is one gliding block, like the sidebar's — a
 * single tinted box that slides between rows instead of each row
 * flashing its own background on and off. It follows the hovered
 * row, and the keyboard-active row when the mouse is elsewhere.
 * The rows carry no hover fill of their own. The block sits in
 * front of the rows, pointer-events off, so clicks still land on
 * the link underneath.
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

/** A result click: mark the target for the landing flash, then
 * run the caller's select handler (the dialog closes). */
function handleSelect(entry: FlatResult, onSelect?: () => void) {
  markSearchNavigation(entry);
  onSelect?.();
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
  const isHeading = entry.type === "heading";
  const className = [
    "porto-search-result",
    isPage
      ? "porto-search-result--page"
      : isHeading
        ? "porto-search-result--heading"
        : "porto-search-result--text",
  ].join(" ");
  const breadcrumbs = isPage ? (entry.breadcrumbs ?? []) : [];
  return (
    <Link
      href={entry.url}
      id={listbox ? `porto-search-option-${entry.id}` : undefined}
      role={listbox ? "option" : undefined}
      aria-selected={listbox ? active : undefined}
      data-result-index={index}
      className={className}
      onClick={() => handleSelect(entry, onSelect)}
      onMouseEnter={onHover ? () => onHover(index) : undefined}
    >
      {isHeading && (
        <span className="porto-search-result__hash">
          <SiteIcon icon="lu:hash" size="16px" />
        </span>
      )}
      {isPage || isHeading ? (
        <span className="porto-search-result__title">
          <HighlightedText text={entry.content} query={query} />
        </span>
      ) : (
        <span className="porto-search-result__excerpt">
          <HighlightedText text={entry.content} query={query} />
        </span>
      )}
      {breadcrumbs.length > 0 && (
        <span className="porto-search-result__breadcrumbs">
          {breadcrumbs.map((crumb, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <SiteIcon
                  icon="lu:chevron-right"
                  size="16px"
                  className="porto-search-result__chevron"
                />
              )}
              {crumb}
            </Fragment>
          ))}
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
 * table layout. The block sits under its page with a left border,
 * like Fumadocs'. The rows inside are the keyboard-nav entries,
 * one flat index each.
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
      className="porto-search-table"
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
              onClick={() => handleSelect(row, onSelect)}
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
  // Whether the last active-index change came from a hover: the
  // dialog syncs hover into activeIndex too, so a bare
  // activeIndex change can't tell hover from keyboard. The flag
  // marks hover-driven changes; anything else is keyboard nav.
  const hoveredRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<Element | null>(null);
  const targetIndex = hoverIndex >= 0 ? hoverIndex : activeIndex;

  const handleHover = (index: number) => {
    hoveredRef.current = true;
    setHoverIndex(index);
    if (onHoverIndex) {
      onHoverIndex(index);
    }
  };

  // Keyboard nav releases the hover override: without this, a
  // mouse resting on a row pins the block there and Ctrl+P /
  // Ctrl+J (and the arrows) change the active row invisibly.
  // The next hover takes over again.
  useEffect(() => {
    if (hoveredRef.current) {
      hoveredRef.current = false;
      return;
    }
    setHoverIndex(-1);
  }, [activeIndex]);

  // Glide the block to the target row. It appears in place when
  // coming from outside, glides between rows, and fades out when
  // there is no target. The block copies the row's corner radius,
  // so it hugs the row's rounded corners.
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
          <Fragment key={group.pageUrl}>
            <li>
              <ResultLink
                entry={group.header}
                index={indexOf.get(group.header.id) ?? -1}
                active={indexOf.get(group.header.id) === activeIndex}
                query={query}
                listbox={listbox}
                onSelect={onSelect}
                onHover={handleHover}
              />
            </li>
            {chunkEntries(group.entries).map((chunk) =>
              chunk.kind === "entry" ? (
                <li key={chunk.entry.id}>
                  <ResultLink
                    entry={chunk.entry}
                    index={indexOf.get(chunk.entry.id) ?? -1}
                    active={indexOf.get(chunk.entry.id) === activeIndex}
                    query={query}
                    listbox={listbox}
                    onSelect={onSelect}
                    onHover={handleHover}
                  />
                </li>
              ) : (
                <li key={chunk.tableId}>
                  <TableBlock
                    rows={chunk.rows}
                    query={query}
                    activeIndex={activeIndex}
                    indexOf={indexOf}
                    listbox={listbox}
                    onSelect={onSelect}
                    onHover={handleHover}
                  />
                </li>
              ),
            )}
          </Fragment>
        ))}
      </ul>
    </div>
  );
}

/** The section filter's "This page" choice — the page-scope
 * filter, limiting results to the page the dialog opened from.
 * It is the display text as well as the value, like the section
 * names. The dialog owns the scope; the filter only offers the
 * choice when the dialog says so. */
export const PAGE_SCOPE = "This page";

/**
 * The "Filter [All ▾]" row — Fumadocs' tag filter, Portosaur's
 * version narrowing by docs section instead (the index carries no
 * tags. Every result is a docs page). The dialog renders it in its
 * bar, next to the close icon, without the label. The page
 * renders it under its input, with the label.
 */
export function SearchSectionFilter({
  sections,
  value,
  onChange,
  dropUp = false,
  showLabel = true,
  showPageOption = false,
}: {
  /** The sections the current results span, in first-seen order. */
  sections: string[];
  /** The selected section, or "All". */
  value: string;
  onChange: (section: string) => void;
  /** Open the menu above the trigger instead of below it. */
  dropUp?: boolean;
  /** Show the "Filter" label before the dropdown. The dialog's
   * bar shows the dropdown alone. */
  showLabel?: boolean;
  /** Offer the "This page" choice under "All". The dialog
   * passes it whenever a page scope is set — every open sets
   * one, to the page the dialog opened from. */
  showPageOption?: boolean;
}) {
  return (
    <div className="porto-search-filter">
      {showLabel && <span className="porto-search-filter__label">Filter</span>}
      <Dropdown
        trigger={value}
        items={[
          {
            label: "All",
            active: value === "All",
            onClick: () => onChange("All"),
          },
          ...(showPageOption
            ? [
                {
                  label: PAGE_SCOPE,
                  active: value === PAGE_SCOPE,
                  onClick: () => onChange(PAGE_SCOPE),
                },
              ]
            : []),
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
