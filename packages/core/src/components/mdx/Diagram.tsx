"use client";

import type { Zoom } from "pele/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../Button.tsx";
import { SiteIcon } from "../SiteIcon.tsx";

/**
 * Diagram — renders a build-time diagram. remarkMermaid turns
 * ```mermaid fences into `<Diagram svg="..."/>`, and the Pele SVG
 * goes straight into the page (Pele escapes diagram text and
 * filters links and styles, and the icons come from the site's own
 * Iconify packs). The wrapper centers the diagram (content.css).
 *
 * An expand button opens the diagram in a popup, GitHub-style: a
 * large native `<dialog>` with the diagram big and Pele's zoom inside (pinch, Ctrl+scroll, drag, and the buttons
 * at the bottom-right). On a phone, tapping the diagram itself
 * opens the popup too. A second expand button beside the close
 * button grows the popup to near-fullscreen, and back — expanding
 * fits the diagram to the popup's width, shrinking back resets
 * it to the whole diagram. On a
 * phone the popup is a bottom sheet: it slides up from the
 * bottom, and the expand button takes it full screen. The bar
 * at the top of the sheet is a drag handle: pull up to expand,
 * down to shrink back or close. Inline zoom was tried first and dropped —
 * zooming inside the small inline box just overflowed it. The
 * zoom code loads on the first expand, never on page load.
 * Imported from `pele/core`, not `pele` — the main entry is one
 * bundled file and would ship the whole renderer (269KB gzip)
 * for the zoom code.
 *
 * The dialog follows the search dialog's pattern: showModal in
 * an effect synced with `open`, a `closing` class + timer for
 * the exit (the pure-CSS exit never ran on some phones), Escape
 * swallowed at capture phase (Chrome's `cancel` is not
 * cancelable), and body scroll locked while open.
 */
export function Diagram({ svg }: { svg: string }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);
  // True while the exit animation runs: the dialog is still open
  // (and still focused), it just wears the `closing` class until
  // the timer below closes it for real. The ref mirrors the state
  // for the event handlers, which must not read stale state.
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<Zoom | undefined>(undefined);

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
    // ran on some phones — the dialog just blinked out. The 300ms
    // matches the exit transition in animations.css; the real
    // close is invisible by then, since the dialog and the
    // backdrop have both faded out. The viewer unmounts only
    // once `open` goes false, so the diagram stays put during
    // the exit instead of vanishing mid-fade.
    closingRef.current = true;
    setClosing(true);
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
    // never closed, so it just fades back in from mid-exit.
    window.clearTimeout(closeTimerRef.current);
    closingRef.current = false;
    setClosing(false);
    setOpen(true);
  }, []);

  // Clear a pending close on unmount (navigating away mid-exit
  // unmounts the dialog before the timer fires).
  useEffect(() => {
    return () => {
      window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  // Sync the native dialog with `open`, lock body scroll, and
  // enable zoom once the popup is showing. The lock lives on the
  // root element, not the body: the CSS also reserves the
  // scrollbar gutter there (`scrollbar-gutter: stable`), so
  // hiding the scrollbar doesn't widen the page and shift the
  // content sideways.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!open) {
      if (dialog.open) {
        dialog.close();
      }
      document.documentElement.removeAttribute("data-diagram-modal-open");
      // Reopening starts at the default size, not expanded.
      setExpanded(false);
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    document.documentElement.setAttribute("data-diagram-modal-open", "");
    // Zoom loads on the first expand and attaches to the popup's
    // viewer. The import is cached after the first load, so
    // reopening attaches at once.
    let cancelled = false;
    import("pele/core").then((mod) => {
      if (!cancelled && viewerRef.current) {
        zoomRef.current = mod.enableZoom(viewerRef.current, {
          always: true,
        });
      }
    });
    return () => {
      cancelled = true;
      zoomRef.current?.destroy();
      zoomRef.current = undefined;
    };
  }, [open]);

  // Expanding fits the diagram to the popup's width: the
  // diagram keeps its natural size otherwise, so a narrow one
  // floats in the middle of the bigger view with gaps at the
  // sides. The zoom waits out the 300ms size transition — Pele
  // resets the zoom whenever the viewer resizes, so zooming
  // mid-transition would be undone. Shrinking back resets to
  // the whole diagram.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!expanded) {
      zoomRef.current?.reset();
      return;
    }
    const timer = window.setTimeout(() => {
      const viewer = viewerRef.current;
      const zoom = zoomRef.current;
      const svg = viewer?.querySelector("svg");
      const naturalWidth = Number(svg?.getAttribute("width"));
      if (!viewer || !zoom || !naturalWidth) {
        return;
      }
      const style = window.getComputedStyle(viewer);
      const paddingX =
        (parseFloat(style.paddingLeft) || 0) +
        (parseFloat(style.paddingRight) || 0);
      zoom.zoomTo((viewer.clientWidth - paddingX) / naturalWidth);
    }, 350);
    return () => {
      window.clearTimeout(timer);
    };
  }, [expanded, open]);

  // Escape closes — listened for on the window in the CAPTURE
  // phase, like the search dialog: a dialog-level or bubble-phase
  // listener needed two presses in Firefox (the first never
  // reached it). Swallowing the key itself keeps the close on
  // the JS path — its default action fires the dialog's `cancel`
  // event, and in Chrome that event is NOT cancelable, so
  // preventing it does nothing and the dialog closes natively,
  // skipping the exit animation.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dialogRef.current?.open) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [close]);

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

  // On a phone, tapping the diagram itself opens the popup — the
  // expand button stays the way in on desktop. The breakpoint
  // matches the sheet layout in Diagram.css.
  const onInlineTap = () => {
    if (window.matchMedia("(max-width: 50rem)").matches) {
      openDialog();
    }
  };

  // Sheet drag (mobile only — the drag strip is display:none on
  // desktop): pulling the bar at the top of the sheet up expands
  // it to full screen, pulling down shrinks it back to a sheet,
  // and pulling a sheet down far enough closes it. The sheet
  // follows the finger during the drag: growing changes the
  // height toward full screen, dismissing slides it down. The
  // drag state lives in a ref — no re-render per move.
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startTime: number;
    sheetHeight: number;
    viewportHeight: number;
  } | null>(null);

  const onDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const dialog = dialogRef.current;
    if (!dialog?.open || closingRef.current) {
      return;
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTime: performance.now(),
      sheetHeight: dialog.getBoundingClientRect().height,
      viewportHeight: window.innerHeight,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const dialog = dialogRef.current;
    if (!drag || !dialog || event.pointerId !== drag.pointerId) {
      return;
    }
    const dy = event.clientY - drag.startY;
    // Follow the finger directly: the 300ms transition would lag
    // behind it. Restored on release.
    dialog.style.transition = "none";
    if (expanded) {
      // From full screen, only a downward pull does anything:
      // the sheet shrinks toward its resting height. Pulling
      // back up restores full screen.
      if (dy > 0) {
        dialog.style.height = `${Math.max(drag.viewportHeight - dy, drag.sheetHeight)}px`;
      } else {
        dialog.style.height = "";
      }
      dialog.style.translate = "";
    } else if (dy < 0) {
      // From the sheet, an upward pull grows it toward full
      // screen. The max-height override lifts the sheet's 85%
      // cap, or the height below would stop at the resting size.
      dialog.style.height = `${Math.min(drag.sheetHeight - dy, drag.viewportHeight)}px`;
      dialog.style.maxHeight = "100dvh";
      dialog.style.translate = "";
    } else {
      // A downward pull slides the sheet toward dismissing.
      dialog.style.translate = `0 ${dy}px`;
      dialog.style.height = "";
      dialog.style.maxHeight = "";
    }
  };

  const finishDrag = (
    event: React.PointerEvent<HTMLDivElement>,
    commit: boolean,
  ) => {
    const drag = dragRef.current;
    const dialog = dialogRef.current;
    if (!drag || !dialog || event.pointerId !== drag.pointerId) {
      return;
    }
    dragRef.current = null;
    const dy = event.clientY - drag.startY;
    const dt = performance.now() - drag.startTime;
    const velocity = dt > 0 ? dy / dt : 0;
    // Clear the drag's inline styles first: the transition comes
    // back, and the dialog glides to whichever state the release
    // picks below. A cancelled drag just snaps back.
    dialog.style.transition = "";
    dialog.style.height = "";
    dialog.style.maxHeight = "";
    dialog.style.translate = "";
    if (!commit || !dialog.open) {
      return;
    }
    if (expanded) {
      if (dy > 60 || (dy > 20 && velocity > 0.5)) {
        setExpanded(false);
      }
      return;
    }
    if (dy < -60 || (dy < -20 && velocity < -0.5)) {
      setExpanded(true);
      return;
    }
    if (dy > 100 || (dy > 40 && velocity > 0.5)) {
      close();
    }
  };

  const onDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    finishDrag(event, true);
  };

  const onDragCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    finishDrag(event, false);
  };

  const dialogClassName = [
    "porto-diagram-dialog",
    ...(expanded ? ["porto-diagram-dialog--expanded"] : []),
    ...(closing ? ["porto-diagram-dialog--closing"] : []),
  ].join(" ");

  return (
    <>
      {/* The svg lives in its own div: `dangerouslySetInnerHTML`
          wipes children, so the expand button is a sibling, not a
          child of the svg's container. */}
      <div className="porto-diagram" onClick={onInlineTap}>
        <div dangerouslySetInnerHTML={{ __html: svg }} />
        <button
          type="button"
          className="porto-diagram__expand"
          onClick={openDialog}
          aria-label="Expand diagram"
          title="Expand diagram"
        >
          <SiteIcon icon="lu:maximize-2" size="0.875rem" />
        </button>
      </div>

      <dialog
        ref={dialogRef}
        className={dialogClassName}
        aria-label="Diagram viewer"
        onClick={onDialogClick}
      >
        <div className="porto-diagram-dialog__frame">
          {/* The drag strip is mobile-only (display:none on
              desktop): the bar at the top of the sheet, and the
              handle for pulling it up to expand or down to
              shrink and close. */}
          <div
            className="porto-diagram-dialog__drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragCancel}
          >
            <div className="porto-diagram-dialog__grabber" />
          </div>
          <div className="porto-diagram-dialog__actions">
            {/* The expand button toggles the popup between its
                default size and near-fullscreen. The two icons are
                literal `icon="..."` props, not a computed value —
                the icon scan only picks up literals. */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="porto-diagram-dialog__expand"
              ariaLabel={expanded ? "Shrink popup" : "Expand popup"}
              onClick={() => {
                setExpanded((value) => !value);
              }}
            >
              {expanded ? (
                <SiteIcon icon="lu:minimize-2" size="20px" strokeWidth={2.5} />
              ) : (
                <SiteIcon icon="lu:maximize-2" size="20px" strokeWidth={2.5} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="porto-diagram-dialog__close"
              ariaLabel="Close diagram viewer"
              onClick={close}
            >
              <SiteIcon icon="lu:x" size="20px" strokeWidth={2.5} />
            </Button>
          </div>
          {/* The viewer only exists while the popup is open — it
              mounts with the diagram, so the zoom code attaches
              to a live svg, and unmounts after the exit. */}
          {open && (
            <div
              ref={viewerRef}
              className="porto-diagram-dialog__viewer"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </dialog>
    </>
  );
}
