"use client";

import {
  useHighlightQuery,
  useStaticSearch,
} from "fumadocs-core/search/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import {
  flattenResults,
  type FlatResult,
} from "../../../lib/search-results.ts";

/**
 * Portosaur's own search dialog — a navbar magnifier button opens a
 * native `<dialog>` floating panel (at every width), with ZBSearch
 * (Fumadocs' static search) results inside.
 *
 * - Cmd/Ctrl+K toggles, Escape / outside-click / link-click closes,
 *   body scroll locks while open (`data-search-modal-open`).
 * - Arrow keys move the active result, Enter navigates to it.
 * - Matches highlight via the CSS Custom Highlight API
 *   (`useHighlightQuery` + `::highlight(fd-search)`).
 * - The search index downloads on the first keystroke (the hook
 *   only searches a non-empty query), never on page load.
 * - `from` is basePath-aware (contracts §6): the generated
 *   `/api/search` route serves the exported index under the base.
 */

/**
 * One result entry. A separate component so each entry can call
 * `useHighlightQuery` itself — the hook returns a ref callback for
 * a single element, and every result's excerpt needs highlighting.
 */
function SearchResultEntry({
  result,
  index,
  active,
  query,
  onSelect,
  onHover,
}: {
  result: FlatResult;
  index: number;
  active: boolean;
  query: string;
  onSelect: () => void;
  onHover: () => void;
}) {
  const highlightRef = useHighlightQuery(query);
  return (
    <li role="option" aria-selected={active}>
      <Link
        href={result.url}
        id={`porto-search-option-${result.id}`}
        data-result-index={index}
        className={
          active
            ? "porto-search-result porto-search-result--active"
            : "porto-search-result"
        }
        onClick={onSelect}
        onMouseEnter={onHover}
      >
        {result.breadcrumbs && result.breadcrumbs.length > 0 && (
          <span className="porto-search-result__breadcrumbs">
            {result.breadcrumbs.join(" › ")}
          </span>
        )}
        <span className="porto-search-result__excerpt" ref={highlightRef}>
          {result.type === "heading" ? "# " : ""}
          {result.content}
        </span>
      </Link>
    </li>
  );
}

export function SearchDialog() {
  const config = usePortoConfig();
  const router = useRouter();
  const base = config.site.baseUrl ?? "/";
  const basePrefix = base === "/" ? "" : base.replace(/\/+$/, "");

  const { search, onSearchChange, isLoading, data } = useStaticSearch({
    from: `${basePrefix}/api/search`,
  });

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(
    () => (data ? flattenResults(data.items) : []),
    [data],
  );

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  // Sync the native dialog with `open`, and lock body scroll.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      document.body.setAttribute("data-search-modal-open", "");
      inputRef.current?.focus();
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.body.removeAttribute("data-search-modal-open");
    }
  }, [open]);

  // Reset the query + active result when the dialog closes.
  useEffect(() => {
    if (!open) {
      onSearchChange("");
      setActiveIndex(-1);
    }
  }, [open, onSearchChange]);

  // Cmd/Ctrl+K toggles; Escape closes (the native dialog fires
  // `close` on Escape, synced below); outside clicks close.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  // The native `close` event fires on Escape and on backdrop
  // dismissal — sync React state with it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const onClose = () => {
      setOpen(false);
    };
    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("close", onClose);
    };
  }, []);

  // Close on outside click (a click on the dialog element itself,
  // outside the frame, is a backdrop click).
  const onDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      close();
    }
  };

  // Arrow-key navigation + Enter to navigate to the active result.
  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0 ? -1 : (index + 1) % results.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        results.length === 0
          ? -1
          : (index - 1 + results.length) % results.length,
      );
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      const result = results[activeIndex];
      if (result) {
        event.preventDefault();
        close();
        router.push(result.url);
      }
    }
  };

  // Keep the active result visible in the list.
  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    listRef.current
      ?.querySelector(`[data-result-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const showEmpty = !isLoading && search.trim() !== "" && results.length === 0;

  return (
    <>
      <button
        type="button"
        className="porto-search-trigger"
        aria-label="Search"
        aria-keyshortcuts="Control+K"
        onClick={openDialog}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        className="porto-search-dialog"
        aria-label="Search"
        onClick={onDialogClick}
      >
        <div className="porto-search-dialog__frame">
          <button
            type="button"
            className="porto-search-dialog__cancel md:hidden"
            onClick={close}
          >
            Cancel
          </button>
          <input
            ref={inputRef}
            type="search"
            className="porto-search-dialog__input"
            placeholder="Search the documentation"
            aria-label="Search the documentation"
            value={search}
            onChange={(event) => {
              onSearchChange(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onInputKeyDown}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="porto-search-results"
            aria-activedescendant={
              activeIndex >= 0
                ? `porto-search-option-${results[activeIndex]?.id}`
                : undefined
            }
          />
          {isLoading && (
            <p className="porto-search-dialog__loading">Loading search…</p>
          )}
          {showEmpty && (
            <p className="porto-search-dialog__empty">
              No results found for “{search.trim()}”.
            </p>
          )}
          {results.length > 0 && (
            <ul
              ref={listRef}
              id="porto-search-results"
              className="porto-search-results"
              role="listbox"
            >
              {results.map((result, index) => (
                <SearchResultEntry
                  key={result.id}
                  result={result}
                  index={index}
                  active={index === activeIndex}
                  query={search}
                  onSelect={close}
                  onHover={() => {
                    setActiveIndex(index);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}
