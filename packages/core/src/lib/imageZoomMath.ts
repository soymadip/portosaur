/**
 * imageZoomMath — the pure zoom and pan math for the image viewer
 * (ImageZoom). The viewer centers the image in its frame and moves
 * it with `translate(x, y) scale(s)` from the image's top-left
 * corner, so every function here works in image-layout coordinates:
 * the point (0, 0) is the image's top-left corner as laid out, and
 * the viewer center is the image center (width / 2, height / 2).
 *
 * The pan is clamped so the viewer center always shows image — the
 * picture can never be dragged clean off the frame. At the minimum
 * scale the whole image is already visible, so the pan is forced
 * back to zero.
 */

/** The zoom transform: a scale and a pan in layout pixels. */
export interface ZoomTransform {
  scale: number;
  x: number;
  y: number;
}

/** The fitted size — never smaller than the frame. */
export const ZOOM_MIN = 1;
/** The closest zoom. */
export const ZOOM_MAX = 4;
/** One button click or key press multiplies the scale by this. */
export const ZOOM_STEP = 1.5;

/** The fitted transform: whole image, no pan. */
export const ZOOM_FIT: ZoomTransform = { scale: 1, x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Clamp a pan so the rendered image still covers the viewer center.
 * The rendered image spans from (x, y) to (x + width * scale,
 * y + height * scale) in layout coordinates, and the center sits at
 * (width / 2, height / 2) — so x runs from center minus the full
 * rendered width up to the center itself, and likewise for y.
 */
export function clampPan(
  x: number,
  y: number,
  scale: number,
  size: { width: number; height: number },
): { x: number; y: number } {
  return {
    x: clamp(x, size.width / 2 - size.width * scale, size.width / 2),
    y: clamp(y, size.height / 2 - size.height * scale, size.height / 2),
  };
}

/**
 * Zoom by a factor around a point (the cursor, or the frame center
 * for the buttons), keeping the point under the cursor fixed: the
 * new pan is the point minus its old offset from the pan, scaled by
 * the ratio of the new scale to the old one. The scale clamps to
 * the min and max, and zooming back out to the fitted size resets
 * the pan — there is nothing left to pan to.
 */
export function zoomToPoint(
  current: ZoomTransform,
  factor: number,
  point: { x: number; y: number },
  size: { width: number; height: number },
): ZoomTransform {
  const scale = clamp(current.scale * factor, ZOOM_MIN, ZOOM_MAX);
  if (scale === ZOOM_MIN) {
    return { ...ZOOM_FIT };
  }
  const ratio = scale / current.scale;
  const x = point.x - (point.x - current.x) * ratio;
  const y = point.y - (point.y - current.y) * ratio;
  return { scale, ...clampPan(x, y, scale, size) };
}

/**
 * Move the image by a drag delta, clamped to the frame. A fitted
 * image does not pan at all.
 */
export function panBy(
  current: ZoomTransform,
  dx: number,
  dy: number,
  size: { width: number; height: number },
): ZoomTransform {
  if (current.scale <= ZOOM_MIN) {
    return current;
  }
  return {
    scale: current.scale,
    ...clampPan(current.x + dx, current.y + dy, current.scale, size),
  };
}
