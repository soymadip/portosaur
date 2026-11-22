import { describe, expect, test } from "bun:test";
import {
  ZOOM_FIT,
  clampPan,
  panBy,
  zoomToPoint,
  type ZoomTransform,
} from "../src/lib/imageZoomMath.ts";

const size = { width: 400, height: 200 };
const fit: ZoomTransform = { ...ZOOM_FIT };

describe("zoomToPoint", () => {
  // Where a layout point renders, relative to the image's layout
  // top-left: the pan plus the point scaled.
  const rendered = (t: ZoomTransform, p: { x: number; y: number }) => ({
    x: t.x + p.x * t.scale,
    y: t.y + p.y * t.scale,
  });

  test("zooming on the center keeps the center point fixed", () => {
    // With a top-left origin the pan pulls back by half the
    // growth, so the center still renders at the center.
    const point = { x: 200, y: 100 };
    const zoomed = zoomToPoint(fit, 2, point, size);
    expect(zoomed).toEqual({ scale: 2, x: -200, y: -100 });
    expect(rendered(zoomed, point)).toEqual(rendered(fit, point));
  });

  test("zooming on a corner keeps that corner under the cursor", () => {
    // The top-left corner is already at the pan origin, so it
    // stays put; the image grows down and right from it.
    const point = { x: 0, y: 0 };
    const zoomed = zoomToPoint(fit, 2, point, size);
    expect(zoomed).toEqual({ scale: 2, x: 0, y: 0 });
    expect(rendered(zoomed, point)).toEqual(rendered(fit, point));
  });

  test("zooming on the right edge shifts the image left", () => {
    // The point (400, 100) must render at the same spot after a
    // 2x zoom, so the pan moves left by the image width (and up
    // by half the height, since the point sits mid-height).
    const point = { x: 400, y: 100 };
    const zoomed = zoomToPoint(fit, 2, point, size);
    expect(zoomed).toEqual({ scale: 2, x: -400, y: -100 });
    expect(rendered(zoomed, point)).toEqual(rendered(fit, point));
  });

  test("zooming in steps composes", () => {
    const point = { x: 200, y: 100 };
    const once = zoomToPoint(fit, 1.5, point, size);
    const twice = zoomToPoint(once, 1.5, point, size);
    expect(twice.scale).toBeCloseTo(2.25);
    expect(twice.x).toBe(-250);
    expect(twice.y).toBe(-125);
    expect(rendered(twice, point)).toEqual(rendered(fit, point));
  });

  test("clamps at the maximum scale", () => {
    expect(zoomToPoint(fit, 10, { x: 200, y: 100 }, size).scale).toBe(4);
  });

  test("zooming out to the fit resets the pan", () => {
    const zoomed = zoomToPoint(fit, 2, { x: 400, y: 100 }, size);
    expect(zoomed.x).toBe(-400);
    expect(zoomToPoint(zoomed, 0.5, { x: 200, y: 100 }, size)).toEqual({
      scale: 1,
      x: 0,
      y: 0,
    });
  });
});

describe("clampPan", () => {
  test("keeps the viewer center covered at 2x", () => {
    // At 2x the image spans 800px wide around a 400px frame, so
    // x runs from -600 (right edge on the center) to 200 (left
    // edge on the center).
    expect(clampPan(-1000, 0, 2, size)).toEqual({ x: -600, y: 0 });
    expect(clampPan(1000, 500, 2, size)).toEqual({ x: 200, y: 100 });
    expect(clampPan(-100, -50, 2, size)).toEqual({ x: -100, y: -50 });
  });
});

describe("panBy", () => {
  test("a fitted image does not pan", () => {
    expect(panBy(fit, 50, 50, size)).toBe(fit);
  });

  test("a zoomed image pans by the delta, clamped", () => {
    const zoomed: ZoomTransform = { scale: 2, x: 0, y: 0 };
    expect(panBy(zoomed, 50, -25, size)).toEqual({
      scale: 2,
      x: 50,
      y: -25,
    });
    expect(panBy(zoomed, -1000, 0, size)).toEqual({
      scale: 2,
      x: -600,
      y: 0,
    });
  });
});
