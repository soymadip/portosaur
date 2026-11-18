"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
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
 * navigation; the page renders a plain list.
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
    active ? "porto-search-result--active" : "",
  ]
    .filter(Boolean)
    .join(" ");
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

/** Groups consecutive rows of the same table; everything else stays single. */
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
 * carries the tree branch; the rows inside are the keyboard-nav
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
              className={[
                "porto-search-result",
                "porto-search-table__row",
                active ? "porto-search-result--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
  /** Listbox semantics for the dialog; a plain list on the page. */
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

  return (
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
              onHover={onHoverIndex}
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
                  onHover={onHoverIndex}
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
                  onHover={onHoverIndex}
                />
              ),
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * The "Filter [All ▾]" row — Fumadocs' tag filter, Portosaur's
 * version narrowing by docs section instead (the index carries no
 * tags; every result is a docs page). The dialog renders it in its
 * footer, opening upward; the page renders it under its input.
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
