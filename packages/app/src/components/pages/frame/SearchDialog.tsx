"use client";

import { useStaticSearch } from "fumadocs-core/search/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import { markSearchNavigation } from "../../../lib/search-highlight.ts";
import {
  flattenGroups,
  flattenResults,
  groupResults,
} from "../../../lib/search-results.ts";
import { Button } from "../../Button.tsx";
import { SearchResults, SearchSectionFilter } from "../SearchResults.tsx";

/**
 * Portosaur's own search dialog — a navbar magnifier button opens a
 * native `<dialog>` floating panel (at every width), with ZBSearch
 * (Fumadocs' static search) results inside.
 *
 * The bar is Fumadocs' wiki bar, copied whole: a magnifier (it
 * pulses while the index loads), a borderless input, and an ESC
 * button that closes the dialog. One change from Fumadocs: when
 * results span more than one section, the ESC button swaps for
 * the section filter — just the dropdown, no label — so the
 * dialog never grows a footer and never shifts. The filter
 * narrows by docs section (the index carries no tags. Every
 * result is a docs page). Results are Fumadocs' flat list,
 * rendered by the shared `SearchResults` (the search page
 * renders the same list).
 *
 * The dialog slides down from the top edge on open, fading in
 * as it drops, and slides back up on close. The entry is pure
 * CSS (`@starting-style` + `allow-discrete` in animations.css);
 * the exit runs on a `closing` class while the dialog is still
 * open, and the dialog closes for real 300ms later — the
 * pure-CSS exit never ran on some phones, where the dialog just
 * blinked out. No JS animation state besides the closing flag.
 *
 * - Cmd/Ctrl+K toggles, Escape / outside-click / link-click closes,
 *   body scroll locks while open (`data-search-modal-open`).
 * - Arrow keys move the active result, Enter navigates to it.
 * - Matches render bold, in the accent color, and underlined
 *   (`<mark>`), like Fumadocs'.
 * - The search index downloads on the first keystroke (the hook
 *   only searches a non-empty query), never on page load.
 * - `from` is basePath-aware (contracts §6): the generated
 *   `/api/search` route serves the exported index under the base.
 */

function MagnifierIcon() {
  return (
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
  const [section, setSection] = useState("All");
  // True while the exit animation runs: the dialog is still open
  // (and still focused), it just wears the `closing` class until
  // the timer below closes it for real. The ref mirrors the state
  // for the event handlers, which must not read stale state.
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const groups = useMemo(
    () => (data ? groupResults(flattenResults(data.items)) : []),
    [data],
  );

  // The sections the current results span, in first-seen order —
  // the filter's options.
  const sections = useMemo(() => {
    const seen = new Set<string>();
    for (const group of groups) {
      if (group.section) {
        seen.add(group.section);
      }
    }
    return [...seen];
  }, [groups]);

  // A section that no longer has results (the query changed) falls
  // back to All instead of filtering everything away.
  useEffect(() => {
    if (section !== "All" && !sections.includes(section)) {
      setSection("All");
    }
  }, [sections, section]);

  const filteredGroups = useMemo(
    () =>
      section === "All"
        ? groups
        : groups.filter((group) => group.section === section),
    [groups, section],
  );

  // The flat entry list behind the groups — keyboard navigation walks this.
  const navList = useMemo(
    () => flattenGroups(filteredGroups),
    [filteredGroups],
  );

  const close = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closingRef.current) {
      return;
    }
    // With reduced motion there is no exit animation to wait for
    // (the guard strips the transition), so close at once.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      dialog.close();
      setOpen(false);
      return;
    }
    // Animate out first, then close for real: the exit runs on
    // the `closing` class while the dialog is still open, because
    // the pure-CSS exit (display/overlay allow-discrete) never
    // ran on some phones — the dialog just blinked out. The input
    // blurs at once so the keyboard drops with the dialog instead
    // of after it. The 300ms matches the transition in
    // animations.css; the real close is invisible by then, since
    // the dialog and the backdrop have both faded out. The query
    // reset waits too (it runs on `open` going false), so the
    // results stay put during the exit instead of dropping the
    // dialog back down mid-slide.
    closingRef.current = true;
    setClosing(true);
    inputRef.current?.blur();
    closeTimerRef.current = window.setTimeout(() => {
      closingRef.current = false;
      // Close first, then drop the class: the `:not([open])`
      // rules hold the same faded-out values, so nothing flashes.
      dialog.close();
      setClosing(false);
      setOpen(false);
    }, 300);
  }, []);

  const openDialog = useCallback(() => {
    // Reopening mid-exit cancels the pending close: the dialog
    // never closed, so it just slides back in from mid-exit. The
    // input needs focusing again — the close blurred it, and the
    // sync effect below does not re-run (`open` never changed).
    window.clearTimeout(closeTimerRef.current);
    closingRef.current = false;
    setClosing(false);
    setOpen(true);
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const toggleDialog = useCallback(() => {
    if (closingRef.current) {
      openDialog();
    } else if (dialogRef.current?.open) {
      close();
    } else {
      openDialog();
    }
  }, [close, openDialog]);

  // Clear a pending close on unmount (navigating away mid-exit
  // unmounts the dialog before the timer fires).
  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Sync the native dialog with `open`, and lock body scroll.
  // The entry is pure CSS (`@starting-style` + `allow-discrete`
  // in animations.css); the exit runs on the `closing` class and
  // `close()` calls the real close after it — no JS animation
  // state besides the closing flag. The lock lives on the root
  // element, not the body: the CSS also reserves the scrollbar
  // gutter there (`scrollbar-gutter: stable`), so hiding the
  // scrollbar doesn't widen the page and shift the content
  // sideways.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      document.documentElement.setAttribute("data-search-modal-open", "");
      // Never scroll on focus: the input lives in a top-layer
      // dialog, so scrolling the document can never reveal it —
      // it only shoves the page behind the dialog.
      inputRef.current?.focus({ preventScroll: true });
    } else {
      if (dialog.open) {
        dialog.close();
      }
      document.documentElement.removeAttribute("data-search-modal-open");
    }
  }, [open]);

  // Reset the query + active result + filter once the dialog has
  // finished closing, 300ms after it starts (the exit length in
  // animations.css). Clearing them at once makes the results area
  // unmount and the bar drop back down while the dialog is still
  // fading out, so the exit flickers instead of fading cleanly.
  // Reopening before the timer fires cancels it, so a quick
  // reopen keeps the last results on screen.
  useEffect(() => {
    if (open) {
      return;
    }
    const timer = window.setTimeout(() => {
      onSearchChange("");
      setActiveIndex(-1);
      setSection("All");
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [open, onSearchChange]);

  // Cmd/Ctrl+K toggles. Escape closes — listened for on the
  // window in the CAPTURE phase, like Radix does, instead of
  // on the dialog element: a dialog-level handler needed two
  // presses in Firefox (the first never reached it), and a
  // bubble-phase window listener has the same problem — in
  // Firefox the first Escape is swallowed at the focused input
  // (it just blurs it, so the caret disappears) and never
  // bubbles back up, so the dialog only closes on the second
  // press. Fumadocs' own wiki dialog has the same two-press
  // problem. Capture sees the key before it reaches the input,
  // so the first press closes the dialog. The native `cancel`
  // event is prevented below and routed through the same close,
  // so the exit animation runs for Back-button closes too.
  // Outside clicks close.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        toggleDialog();
        return;
      }
      if (event.key === "Escape" && dialogRef.current?.open) {
        // Swallow the key: its default action fires the dialog's
        // `cancel` event, and in Chrome that event is NOT
        // cancelable — preventing it does nothing and the dialog
        // closes natively, skipping the exit animation. Stopping
        // the key itself keeps the close on the JS path below.
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [close, toggleDialog]);

  // The native `cancel` event (Android Back, or Escape reaching
  // the dialog) must not close the dialog itself — the exit
  // animation runs first, and the dialog closes for real 300ms
  // later. Preventing the default keeps the dialog open for it.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const onCancel = (event: Event) => {
      event.preventDefault();
      close();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
    };
  }, [close]);

  // The native `close` event syncs React state with the dialog —
  // a safety net for any close that bypasses `close()` above.
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
        navList.length === 0 ? -1 : (index + 1) % navList.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        navList.length === 0
          ? -1
          : (index - 1 + navList.length) % navList.length,
      );
      return;
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      const result = navList[activeIndex];
      if (result) {
        event.preventDefault();
        markSearchNavigation(result);
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
    resultsRef.current
      ?.querySelector(`[data-result-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const hasQuery = search.trim() !== "";
  const showEmpty = !isLoading && hasQuery && groups.length === 0;
  const showFilteredEmpty =
    !isLoading && hasQuery && groups.length > 0 && navList.length === 0;
  // Whether the results area is showing — it renders while a
  // search is loading too, so the "Loading search…" line has
  // somewhere to live on slow connections.
  const hasResults =
    isLoading || showEmpty || showFilteredEmpty || navList.length > 0;
  // Whether results have actually landed — the dialog only
  // slides up (and shrinks and widens) once they have, never
  // while the search is still running. The class drives the
  // position and size in CSS. Old results stay on screen
  // while a new query loads (the hook keeps the last data),
  // so retyping never drops the dialog back down mid-search.
  const hasSettledResults =
    showEmpty || showFilteredEmpty || navList.length > 0;

  const dialogClassName = [
    "porto-search-dialog",
    ...(hasSettledResults ? ["porto-search-dialog--has-results"] : []),
    ...(closing ? ["porto-search-dialog--closing"] : []),
  ].join(" ");

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        ariaLabel="Search"
        ariaKeyshortcuts="Control+K"
        onClick={openDialog}
      >
        <MagnifierIcon />
      </Button>

      <dialog
        ref={dialogRef}
        className={dialogClassName}
        aria-label="Search"
        onClick={onDialogClick}
      >
        <div className="porto-search-dialog__frame">
          <div className="porto-search-dialog__header">
            <span
              className={
                isLoading
                  ? "porto-search-dialog__icon porto-search-dialog__icon--loading"
                  : "porto-search-dialog__icon"
              }
              aria-hidden="true"
            >
              <MagnifierIcon />
            </span>
            <input
              ref={inputRef}
              type="text"
              className="porto-search-dialog__input"
              placeholder="Search"
              aria-label="Search"
              value={search}
              onChange={(event) => {
                onSearchChange(event.target.value);
                setActiveIndex(-1);
              }}
              onKeyDown={onInputKeyDown}
              role="combobox"
              aria-expanded={navList.length > 0}
              aria-controls="porto-search-results"
              aria-activedescendant={
                activeIndex >= 0
                  ? `porto-search-option-${navList[activeIndex]?.id}`
                  : undefined
              }
            />
            {sections.length > 1 ? (
              <SearchSectionFilter
                sections={sections}
                value={section}
                onChange={(next) => {
                  setSection(next);
                  setActiveIndex(-1);
                }}
                showLabel={false}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="porto-search-dialog__close"
                ariaLabel="Close Search"
                onClick={close}
              >
                ESC
              </Button>
            )}
          </div>
          {/* The results area only exists when it has something to
              show — with no query yet, the dialog is just the
              bar. */}
          {hasResults && (
            <div ref={resultsRef} className="porto-search-dialog__results">
              {isLoading && (
                <p className="porto-search-dialog__loading">Loading search…</p>
              )}
              {showEmpty && (
                <p className="porto-search-dialog__empty">
                  No results found for “{search.trim()}”.
                </p>
              )}
              {showFilteredEmpty && (
                <p className="porto-search-dialog__empty">
                  No results in “{section}” for “{search.trim()}”.
                </p>
              )}
              {navList.length > 0 && (
                <SearchResults
                  groups={filteredGroups}
                  query={search}
                  activeIndex={activeIndex}
                  onHoverIndex={setActiveIndex}
                  onSelect={close}
                  listbox
                  listId="porto-search-results"
                />
              )}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
