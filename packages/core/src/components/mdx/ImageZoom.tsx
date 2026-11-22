"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button.tsx";
import { SiteIcon } from "../SiteIcon.tsx";
import {
  ZOOM_FIT,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  panBy,
  zoomToPoint,
  type ZoomTransform,
} from "../../lib/imageZoomMath.ts";

/**
 * The `src` a markdown image arrives with. Fumadocs' remarkImage
 * turns every local image into an ESM import, and under Next.js
 * that import is a `StaticImageData` object (`{ src, width,
 * height }`), not a URL string — a plain `<img src={object}>`
 * stringifies it to `"[object Object]"` and the image 404s. So
 * the mapping resolves the object to its `.src` (and keeps its
 * width and height, so the browser reserves the space before the
 * image loads). Remote images and JSX `<img>` tags still arrive
 * as plain strings.
 */
type ImageSource = string | { src: string; width?: number; height?: number };

/**
 * ImageZoom — the `img` MDX mapping: every content image opens
 * in a viewer when clicked (or with Enter/Space when focused),
 * showing it big with room to spare. An image inside a link
 * keeps its link — clicking follows it, no viewer. The dialog
 * follows the diagram viewer's pattern: showModal in an effect
 * synced with `open`, a `closing` class + timer for the exit
 * (the pure-CSS exit never ran on some phones), Escape
 * swallowed at capture phase (Chrome's `cancel` is not
 * cancelable), and body scroll locked while open.
 *
 * The dialog lives in a portal to the body, mounted only after
 * hydration: a `<dialog>` inside the `<p>` a markdown image sits
 * in is invalid HTML, and React reports it as a hydration error.
 * The server renders only the image, so the first client render
 * matches, and the dialog appears once the page is interactive.
 *
 * Inside the viewer the image zooms: pinch on a phone,
 * Ctrl+scroll (or Ctrl with + / -) on a desktop, drag to move
 * around once zoomed in, and zoom buttons at the bottom right.
 * The zoom math lives in lib/imageZoomMath.ts — the scale and
 * pan are clamped so the frame center always shows image, and
 * closing the viewer resets back to the fitted size.
 */
export function ImageZoom(
  props: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
    src?: ImageSource;
  },
) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // True once the page has hydrated: the portal only renders
  // then, so the server HTML (image only) matches the first
  // client render.
  const [mounted, setMounted] = useState(false);
  // True while the exit animation runs: the dialog is still open
  // (and still focused), it just wears the `closing` class until
  // the timer below closes it for real. The ref mirrors the state
  // for the event handlers, which must not read stale state.
  const closingRef = useRef(false);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const zoomImgRef = useRef<HTMLImageElement>(null);

  // The zoom transform: the state drives the img's transform
  // style, and the ref mirrors it so the wheel and pointer
  // handlers always read the current value without stale
  // closures. Both change together, through applyZoom.
  const [zoom, setZoom] = useState<ZoomTransform>({ ...ZOOM_FIT });
  const zoomRef = useRef<ZoomTransform>({ ...ZOOM_FIT });
  const [dragging, setDragging] = useState(false);
  // The pointers currently down on the viewer, by pointer id.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  // The pinch in progress: the finger distance and midpoint from
  // the last move, so each move zooms by the change since then.
  const pinchRef = useRef<{
    distance: number;
    midpoint: { x: number; y: number };
  } | null>(null);
  // The drag in progress: the pointer that started it, where it
  // started, and the pan it started from — the pan is recomputed
  // from the start each move, so clamping never drifts it.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const applyZoom = useCallback((next: ZoomTransform) => {
    zoomRef.current = next;
    setZoom(next);
  }, []);

  const resetZoom = useCallback(() => {
    applyZoom({ ...ZOOM_FIT });
  }, [applyZoom]);

  // The image's layout box inside the viewer: the viewer centers
  // it with flex, so the layout top-left is the viewer rect inset
  // by half the leftover space on each side. clientWidth and
  // clientHeight are the layout sizes — the transform never
  // changes them.
  const imageBox = useCallback(() => {
    const viewer = viewerRef.current;
    const img = zoomImgRef.current;
    if (!viewer || !img) {
      return null;
    }
    const rect = viewer.getBoundingClientRect();
    const width = img.clientWidth;
    const height = img.clientHeight;
    return {
      width,
      height,
      left: rect.left + (rect.width - width) / 2,
      top: rect.top + (rect.height - height) / 2,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
    };
  }, []);

  // Zoom by a factor around a point on the screen (the cursor,
  // or a pinch midpoint): the point is translated into
  // image-layout coordinates for the math.
  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const box = imageBox();
      if (!box) {
        return;
      }
      applyZoom(
        zoomToPoint(
          zoomRef.current,
          factor,
          { x: clientX - box.left, y: clientY - box.top },
          { width: box.width, height: box.height },
        ),
      );
    },
    [applyZoom, imageBox],
  );

  // Zoom by a factor around the frame center (the buttons and
  // the keyboard shortcuts have no cursor point).
  const zoomCenter = useCallback(
    (factor: number) => {
      const box = imageBox();
      if (!box) {
        return;
      }
      zoomAt(box.centerX, box.centerY, factor);
    },
    [imageBox, zoomAt],
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
    // ran on some phones — the dialog just blinked out. The 300ms
    // matches the exit transition in animations.css; the real
    // close is invisible by then, since the dialog and the
    // backdrop have both faded out. The viewer unmounts only
    // once `open` goes false, so the image stays put during the
    // exit instead of vanishing mid-fade.
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

  // Sync the native dialog with `open` and lock body scroll. The
  // lock lives on the root element, not the body: the CSS also
  // reserves the scrollbar gutter there
  // (`scrollbar-gutter: stable`), so hiding the scrollbar doesn't
  // widen the page and shift the content sideways. Closing resets
  // the zoom, so reopening starts at the fitted size.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (!open) {
      if (dialog.open) {
        dialog.close();
      }
      document.documentElement.removeAttribute("data-image-modal-open");
      applyZoom({ ...ZOOM_FIT });
      setDragging(false);
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    document.documentElement.setAttribute("data-image-modal-open", "");
  }, [open, applyZoom]);

  // Escape closes — listened for on the window in the CAPTURE
  // phase, like the search dialog: a dialog-level or bubble-phase
  // listener needed two presses in Firefox (the first never
  // reached it). Swallowing the key itself keeps the close on
  // the JS path — its default action fires the dialog's `cancel`
  // event, and in Chrome that event is NOT cancelable, so
  // preventing it does nothing and the dialog closes natively,
  // skipping the exit animation.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
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

  // Ctrl (or Cmd) with + / - zooms the image in steps, Ctrl+0
  // resets it — the viewer grabs the browser's zoom shortcuts
  // while it is open, so they zoom the image instead of the page.
  // Capture phase, like Escape: preventing the default here is
  // what stops the browser zoom.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (!dialogRef.current?.open) {
        return;
      }
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        zoomCenter(ZOOM_STEP);
      } else if (event.key === "-") {
        event.preventDefault();
        zoomCenter(1 / ZOOM_STEP);
      } else if (event.key === "0") {
        event.preventDefault();
        resetZoom();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [zoomCenter, resetZoom]);

  // Ctrl+scroll (and a trackpad pinch, which the browser reports
  // the same way) zooms around the cursor. Attached natively, not
  // through React: React's wheel listeners are passive, so
  // preventDefault inside one does nothing and the browser would
  // zoom the page instead. Plain scrolling without Ctrl is left
  // alone — the viewer has nothing to scroll.
  useEffect(() => {
    if (!open) {
      return;
    }
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }
      event.preventDefault();
      zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.0015));
    };
    viewer.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      viewer.removeEventListener("wheel", onWheel);
    };
  }, [open, zoomAt]);

  // The native `cancel` event (Android Back, or Escape reaching
  // the dialog) must not close the dialog itself — the exit
  // animation runs first, and the dialog closes for real 300ms
  // later. Preventing the default keeps the dialog open for it.
  // Runs again once the portal mounts: the dialog doesn't exist
  // on the first render.
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
  }, [close, mounted]);

  // The native `close` event syncs React state with the dialog —
  // a safety net for any close that bypasses `close()` above.
  // Runs again once the portal mounts, like the cancel listener.
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
  }, [mounted]);

  // Close on outside click (a click on the dialog element itself,
  // outside the frame, is a backdrop click).
  const onDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      close();
    }
  };

  // An image inside a link keeps its link: the click follows it
  // instead of opening the viewer.
  const onImgClick = () => {
    if (imgRef.current?.closest("a")) {
      return;
    }
    openDialog();
  };

  const onImgKeyDown = (event: KeyboardEvent<HTMLImageElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    if (imgRef.current?.closest("a")) {
      return;
    }
    event.preventDefault();
    openDialog();
  };

  // Pointer down on the viewer: a second pointer starts a pinch
  // (and ends any drag), a single pointer starts a drag — but a
  // fitted image has nothing to pan to, so the drag only starts
  // once zoomed in. The viewer captures the pointer, so moves
  // keep coming even past its edge.
  const onViewerPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }
    viewer.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointersRef.current.size === 2) {
      dragRef.current = null;
      setDragging(false);
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        distance: Math.hypot(b.x - a.x, b.y - a.y),
        midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      };
      return;
    }
    if (zoomRef.current.scale > ZOOM_MIN) {
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPan: { x: zoomRef.current.x, y: zoomRef.current.y },
      };
      setDragging(true);
    }
  };

  // Pointer move: with two pointers down it is a pinch — zoom by
  // the change in finger distance, around the midpoint. With one
  // pointer dragging, pan by the distance from where the drag
  // started.
  const onViewerPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(event.pointerId)) {
      return;
    }
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.size === 2 && pinchRef.current) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinchRef.current.distance > 0 && distance > 0) {
        zoomAt(midpoint.x, midpoint.y, distance / pinchRef.current.distance);
      }
      pinchRef.current = { distance, midpoint };
      return;
    }
    const drag = dragRef.current;
    if (drag && event.pointerId === drag.pointerId) {
      const box = imageBox();
      if (!box) {
        return;
      }
      applyZoom(
        panBy(
          {
            scale: zoomRef.current.scale,
            x: drag.startPan.x,
            y: drag.startPan.y,
          },
          event.clientX - drag.startX,
          event.clientY - drag.startY,
          { width: box.width, height: box.height },
        ),
      );
    }
  };

  // Pointer up or cancelled: forget the pointer, and end the
  // pinch or drag it belonged to. Dropping from two fingers to
  // one hands the drag to the remaining finger from where it is,
  // so the image does not jump.
  const endViewerPointer = (event: PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) {
      pinchRef.current = null;
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setDragging(false);
    }
    if (pointers.size === 1 && zoomRef.current.scale > ZOOM_MIN) {
      const [id, pos] = [...pointers.entries()][0];
      dragRef.current = {
        pointerId: id,
        startX: pos.x,
        startY: pos.y,
        startPan: { x: zoomRef.current.x, y: zoomRef.current.y },
      };
      setDragging(true);
    }
  };

  const dialogClassName = [
    "porto-image-dialog",
    ...(closing ? ["porto-image-dialog--closing"] : []),
  ].join(" ");

  const viewerClassName = [
    "porto-image-dialog__viewer",
    ...(zoom.scale > ZOOM_MIN ? ["porto-image-dialog__viewer--pannable"] : []),
    ...(dragging ? ["porto-image-dialog__viewer--dragging"] : []),
  ].join(" ");

  const alt = props.alt ?? "";
  const className = [props.className, "porto-image-zoom"]
    .filter(Boolean)
    .join(" ");
  // A local image arrives as an import object, a remote one as a
  // string — resolve both to the URL the browser needs.
  const rawSrc = props.src;
  const imported =
    typeof rawSrc === "object" && rawSrc !== null ? rawSrc : undefined;
  const src = typeof rawSrc === "string" ? rawSrc : imported?.src;
  const width = imported?.width ?? props.width;
  const height = imported?.height ?? props.height;

  return (
    <>
      {/* The image itself is the trigger: a button wrapper would
          be invalid HTML inside a link (and a hydration risk if
          it only rendered sometimes), so the img carries the
          button role and the handlers bail when a link wraps it. */}
      <img
        {...props}
        ref={imgRef}
        className={className}
        src={src}
        width={width}
        height={height}
        tabIndex={0}
        role="button"
        aria-label={alt ? `Zoom image: ${alt}` : "Zoom image"}
        title={props.title ?? "Click to zoom"}
        onClick={onImgClick}
        onKeyDown={onImgKeyDown}
      />

      {/* Portaled to the body, after hydration only — a dialog
          inside the paragraph would be a hydration error. */}
      {mounted &&
        createPortal(
          <dialog
            ref={dialogRef}
            className={dialogClassName}
            aria-label="Image viewer"
            onClick={onDialogClick}
          >
            <div className="porto-image-dialog__frame">
              <div className="porto-image-dialog__actions">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="porto-image-dialog__close"
                  ariaLabel="Close image viewer"
                  onClick={close}
                >
                  <SiteIcon icon="lu:x" size="20px" strokeWidth={2.5} />
                </Button>
              </div>
              {/* The viewer only exists while the popup is open — it
                  mounts with the image, and unmounts after the exit.
                  The zoom toolbar sits beside it, not inside it, so
                  its buttons never start a drag. */}
              {open && (
                <div
                  ref={viewerRef}
                  className={viewerClassName}
                  onPointerDown={onViewerPointerDown}
                  onPointerMove={onViewerPointerMove}
                  onPointerUp={endViewerPointer}
                  onPointerCancel={endViewerPointer}
                >
                  <img
                    ref={zoomImgRef}
                    src={src}
                    alt={alt}
                    draggable={false}
                    style={{
                      transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                    }}
                  />
                </div>
              )}
              <div className="porto-image-dialog__zoom">
                {/* The three icons are literal `icon="..."` props,
                    not computed values — the icon scan only picks
                    up literals. */}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  ariaLabel="Zoom in"
                  title="Zoom in"
                  disabled={zoom.scale >= ZOOM_MAX}
                  onClick={() => {
                    zoomCenter(ZOOM_STEP);
                  }}
                >
                  <SiteIcon icon="lu:zoom-in" size="20px" strokeWidth={2.5} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  ariaLabel="Zoom out"
                  title="Zoom out"
                  disabled={zoom.scale <= ZOOM_MIN}
                  onClick={() => {
                    zoomCenter(1 / ZOOM_STEP);
                  }}
                >
                  <SiteIcon icon="lu:zoom-out" size="20px" strokeWidth={2.5} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  ariaLabel="Reset zoom"
                  title="Reset zoom"
                  disabled={zoom.scale <= ZOOM_MIN}
                  onClick={resetZoom}
                >
                  <SiteIcon icon="lu:scan" size="20px" strokeWidth={2.5} />
                </Button>
              </div>
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
