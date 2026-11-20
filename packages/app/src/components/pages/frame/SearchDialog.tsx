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
 * The dialog opens and closes like Fumadocs' — a 300ms
 * scale-and-fade (`fd-dialog-in` / `fd-dialog-out`), the backdrop
 * fading with it. Pure CSS (`@starting-style` + `allow-discrete`
 * in animations.css): the entry scales in from 1.06, and the exit
 * fades back to it. No JS animation state.
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
    // Close the dialog itself first, directly — going through
    // React state alone left the first press doing nothing in
    // some browsers. The native `close` event syncs the state.
    dialogRef.current?.close();
    setOpen(false);
  }, []);

  const openDialog = useCallback(() => {
    setOpen(true);
  }, []);

  // Sync the native dialog with `open`, and lock body scroll.
  // The open/close animation is pure CSS (`@starting-style` +
  // `allow-discrete` in animations.css) — no JS animation state.
  // The lock lives on the root element, not the body: the CSS
  // also reserves the scrollbar gutter there (`scrollbar-gutter:
  // stable`), so hiding the scrollbar doesn't widen the page
  // and shift the content sideways.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    let entryTimer: number | undefined;
    if (open) {
      // If the keyboard is already open (a quick reopen, before
      // it finished closing), skip the entry slide: the bar
      // would rise from below the screen while the keyboard is
      // up, leaving the input behind it — Firefox pans the page
      // to reveal it. Opening at rest instead puts the input
      // above the keyboard from the first frame. The class comes
      // off 50ms later, once the open has landed.
      const viewport = window.visualViewport;
      if (viewport && window.innerHeight - viewport.height > 100) {
        dialog.classList.add("porto-search-dialog--no-entry");
        entryTimer = window.setTimeout(() => {
          dialog.classList.remove("porto-search-dialog--no-entry");
        }, 50);
      }
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
    return () => {
      window.clearTimeout(entryTimer);
      dialog.classList.remove("porto-search-dialog--no-entry");
    };
  }, [open]);

  // While the dialog is open, track the visual viewport's bottom
  // edge so the empty bar rides above the virtual keyboard on
  // mobile: the layout viewport does not shrink when the keyboard
  // opens, so `dvh` alone leaves the bar behind it — sometimes
  // fully, sometimes half, depending on how far the browser pans.
  // The value is a CSS variable the mobile empty state reads
  // (desktop positions with `top` alone and ignores it). It
  // updates as the keyboard slides, so the bar follows it up.
  // While the keyboard moves, the bar must track it with almost
  // no lag: the 300ms `top` transition is for the results glide,
  // but during a keyboard open it leaves the bar 300ms behind —
  // the keyboard covers it for the whole glide and the bar only
  // pops out above it at the end (seen on a real phone). No
  // transition at all was worse in Firefox: its resize events
  // arrive in coarse steps, and instant tracking turned each
  // step into a visible jump. So each update adds a class that
  // shortens the `top` transition to a 100ms LINEAR glide —
  // linear spreads every step evenly, so the bar moves at one
  // steady speed behind the keyboard instead of jumping step by
  // step. Once the keyboard settles (no viewport event for
  // 150ms) the class comes off and the glide is back.
  useEffect(() => {
    if (!open) {
      return;
    }
    const dialog = dialogRef.current;
    const viewport = window.visualViewport;
    if (!dialog || !viewport) {
      return;
    }
    let settleTimer: number | undefined;
    const update = () => {
      dialog.classList.add("porto-search-dialog--keyboard-tracking");
      dialog.style.setProperty(
        "--porto-vv-bottom",
        `${viewport.offsetTop + viewport.height}px`,
      );
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        dialog.classList.remove("porto-search-dialog--keyboard-tracking");
      }, 150);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      window.clearTimeout(settleTimer);
      dialog.classList.remove("porto-search-dialog--keyboard-tracking");
      dialog.style.removeProperty("--porto-vv-bottom");
    };
  }, [open]);

  // Reset the query + active result + filter when the dialog closes.
  useEffect(() => {
    if (!open) {
      onSearchChange("");
      setActiveIndex(-1);
      setSection("All");
    }
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
  // path stays as a fallback — closing an already-closed
  // dialog is a no-op. Outside clicks close.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen((wasOpen) => !wasOpen);
        return;
      }
      if (event.key === "Escape" && dialogRef.current?.open) {
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [close]);

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
        className={
          hasSettledResults
            ? "porto-search-dialog porto-search-dialog--has-results"
            : "porto-search-dialog"
        }
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
