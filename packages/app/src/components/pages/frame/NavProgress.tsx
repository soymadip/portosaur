"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Navigation progress bar (Docusaurus's NProgress mechanism) — a
 * 2px bar in the accent color, fixed just under the navbar (it
 * docks to the top edge when the navbar hides on scroll), no spinner.
 *
 * A navigation starts the bar only after a 200ms delay, so slow
 * navigations show something and fast ones show nothing — no
 * flicker. The bar finishes when the pathname changes, with a
 * 400ms reset so a failed navigation can't leave it stuck.
 *
 * React port of the Astro `nav-progress.ts` script: instead of
 * Astro's `astro:before-preparation` / `astro:after-swap` events,
 * a navigation begins on an internal-link click (capture listener)
 * or a `popstate`, and ends when `usePathname()` changes.
 *
 * Back-forward cache: a full page load freezes this component's
 * state as-is — if the bar was mid-flight when the user left, a
 * back-button restore resumes it stuck `active`, because no
 * pathname change ever fires on the resumed page to complete it.
 * `pagehide` clears the bar before the freeze, and `pageshow`
 * resets it on a cached restore, so the bar can never come back
 * from the dead.
 *
 * `popstate` also fires on the DESTINATION page of a back/forward
 * full load — after that navigation already completed. Showing the
 * bar for it would leave it stuck, because no pathname change
 * follows on the new page to finish it. So a navigation only
 * starts the bar when the URL actually moves away from the
 * pathname this component last rendered (same rule for clicks:
 * a link to the current page starts no bar).
 *
 * One more race: a navigation that commits just around the 200ms
 * show timer. If it commits before the timer fires, the pathname
 * effect is still pending when the timer fires and runs while the
 * bar is still `idle` (React flushes it before the pending
 * `active` render) — and if it commits just after the timer
 * fires, the same thing happens in reverse: the pathname effect
 * runs before the active render commits. Either way the bar shows
 * with no pathname change left to finish it, frozen at 80%. Two
 * checks close the race, both against the navigation's starting
 * URL (recorded when it begins): the timer doesn't show the bar
 * if the URL already moved, and a bar that does become active
 * finishes at once if the URL has moved since it started. Both
 * checks read the URL, not the rendered pathname — the pathname
 * effect is exactly what lags in this race, while the URL updates
 * at commit. (For a router.push the URL moves at commit, not at
 * click time, so a genuinely slow navigation still shows the bar:
 * the URL hasn't moved when the timer fires or when the bar
 * becomes active.)
 */

type BarState = "idle" | "active" | "done";

/** Delay before the bar appears — fast navigations never show it. */
const SHOW_DELAY_MS = 200;

/** Time the finished bar lingers before resetting to empty. */
const RESET_DELAY_MS = 400;

/** Trailing-slash-insensitive pathname compare (`/docs` === `/docs/`). */
function samePath(a: string, b: string): boolean {
  const strip = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);
  return strip(a) === strip(b);
}

export function NavProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<BarState>("idle");
  const showTimer = useRef<number | undefined>(undefined);
  const resetTimer = useRef<number | undefined>(undefined);
  const stateRef = useRef<BarState>("idle");
  stateRef.current = state;
  // The pathname this component last rendered — the bar only
  // starts when a navigation moves away from it.
  const pathnameRef = useRef(pathname);
  // The URL when the current navigation started — the show timer
  // compares against it (see the header comment).
  const pendingPathRef = useRef<string | null>(null);

  // A navigation begins — schedule the delayed show. Fast
  // navigations finish before the delay and show nothing.
  useEffect(() => {
    const scheduleShow = () => {
      // Recorded on every call: a second click while the timer
      // runs re-bases the check on the URL that click started
      // from, so a fast first navigation can't hide a slow
      // second one.
      pendingPathRef.current = window.location.pathname;
      if (showTimer.current !== undefined) {
        return;
      }
      showTimer.current = window.setTimeout(() => {
        showTimer.current = undefined;
        // If the URL already moved, the navigation committed
        // before the delay elapsed — show nothing. (The pathname
        // effect may still be pending. The URL is the authority
        // here, not the rendered pathname.)
        if (
          pendingPathRef.current === null ||
          !samePath(window.location.pathname, pendingPathRef.current)
        ) {
          return;
        }
        setState("active");
      }, SHOW_DELAY_MS);
    };
    const onClick = (event: MouseEvent) => {
      const target = (event.target as Element | null)?.closest?.("a[href]");
      if (!target) {
        return;
      }
      const href = target.getAttribute("href") ?? "";
      // Only internal same-tab navigations start the bar: no
      // external links, no new-tab links, no hash-only links, no
      // modified clicks (those open a new tab / download).
      if (
        target.getAttribute("target") === "_blank" ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        href.startsWith("#") ||
        /^[a-z][a-z0-9+.-]*:/i.test(href) ||
        href.startsWith("//")
      ) {
        return;
      }
      // A link to the current page starts no navigation — and no
      // pathname change follows to finish a bar started for it.
      if (
        samePath(
          new URL(href, window.location.href).pathname,
          pathnameRef.current,
        )
      ) {
        return;
      }
      scheduleShow();
    };
    const onPopState = () => {
      // On a client-side back/forward the URL has already moved
      // while this component still renders the old pathname — a
      // real navigation, show the bar. On a full-load back/forward
      // the destination page mounts with the new pathname already,
      // so the two match and there is nothing to show the bar for.
      if (!samePath(window.location.pathname, pathnameRef.current)) {
        scheduleShow();
      }
    };
    // A stuck bar can only come back from a cached page — clear
    // it before the freeze and again on a cached restore.
    const resetBar = () => {
      window.clearTimeout(showTimer.current);
      window.clearTimeout(resetTimer.current);
      showTimer.current = undefined;
      resetTimer.current = undefined;
      pendingPathRef.current = null;
      setState("idle");
    };
    const onPageHide = () => {
      resetBar();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        resetBar();
      }
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.clearTimeout(showTimer.current);
      window.clearTimeout(resetTimer.current);
    };
  }, []);

  // Schedule the reset that takes a finished bar back to empty. A
  // new navigation may have started meanwhile — only reset when
  // the bar is not active again.
  const scheduleReset = () => {
    resetTimer.current = window.setTimeout(() => {
      if (stateRef.current !== "active") {
        setState("idle");
      }
    }, RESET_DELAY_MS);
  };

  // Finish the bar: full width, then fade and reset.
  const finishBar = () => {
    setState("done");
    scheduleReset();
  };

  // The pathname change is the navigation completing — finish the
  // bar. If it never appeared (fast navigation), cancel the pending
  // show instead. If a second navigation landed during the fade,
  // the cleanup below just cleared the reset — re-arm it so the
  // bar can't stick in `done`.
  useEffect(() => {
    pathnameRef.current = pathname;
    if (showTimer.current !== undefined) {
      window.clearTimeout(showTimer.current);
      showTimer.current = undefined;
    }
    if (stateRef.current === "active") {
      finishBar();
    } else if (stateRef.current === "done") {
      scheduleReset();
    }
    return () => {
      window.clearTimeout(resetTimer.current);
    };
    // Only the pathname change finishes the bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Stale-active guard (see the header comment): a bar that
  // becomes active after its navigation already committed — the
  // URL moved away from where the navigation started — finishes
  // at once instead of freezing at 80%. A genuinely slow
  // navigation leaves the URL unmoved, so the guard leaves the
  // bar alone. No cleanup: the reset the finish schedules must
  // survive the active -> done transition (unmount is covered by
  // the listener effect's cleanup).
  useEffect(() => {
    if (state !== "active") {
      return;
    }
    if (
      pendingPathRef.current !== null &&
      samePath(window.location.pathname, pendingPathRef.current)
    ) {
      return;
    }
    finishBar();
    // Only the bar becoming active can trip the guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <div
      id="porto-nav-progress"
      aria-hidden="true"
      className={
        state === "active"
          ? "porto-nav-progress porto-nav-progress--active"
          : state === "done"
            ? "porto-nav-progress porto-nav-progress--done"
            : "porto-nav-progress"
      }
    />
  );
}
