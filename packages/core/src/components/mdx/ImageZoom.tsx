"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Button } from "../Button.tsx";
import { SiteIcon } from "../SiteIcon.tsx";

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

  useEffect(() => {
    setMounted(true);
  }, []);

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
  // widen the page and shift the content sideways.
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
      return;
    }
    if (!dialog.open) {
      dialog.showModal();
    }
    document.documentElement.setAttribute("data-image-modal-open", "");
  }, [open]);

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

  const dialogClassName = [
    "porto-image-dialog",
    ...(closing ? ["porto-image-dialog--closing"] : []),
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
                  mounts with the image, and unmounts after the exit. */}
              {open && (
                <div className="porto-image-dialog__viewer">
                  <img src={src} alt={alt} draggable={false} />
                </div>
              )}
            </div>
          </dialog>,
          document.body,
        )}
    </>
  );
}
