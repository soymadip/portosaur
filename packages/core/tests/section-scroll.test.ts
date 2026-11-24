import { describe, expect, test } from "bun:test";
import { landingOffset } from "../src/lib/section-scroll.ts";

const NAV = 56;
const GAP = 16;

describe("landingOffset", () => {
  test("never hides: always below the navbar, both directions", () => {
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: false,
        targetTop: 1000,
        scrollY: 0,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: false,
        targetTop: 0,
        scrollY: 1000,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
  });

  test("scrolling down past the navbar height lands flush", () => {
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 1000,
        scrollY: 0,
        gap: GAP,
      }),
    ).toBe(0);
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 57,
        scrollY: 0,
        gap: GAP,
      }),
    ).toBe(0);
  });

  test("scrolling down to a target at or below the navbar height stays below it", () => {
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 56,
        scrollY: 0,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 30,
        scrollY: 0,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
  });

  test("scrolling up lands below the navbar", () => {
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 0,
        scrollY: 1000,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 900,
        scrollY: 1000,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
  });

  test("a jump to the current position lands below the navbar", () => {
    expect(
      landingOffset({
        navbarHeight: NAV,
        hideOnScroll: true,
        targetTop: 500,
        scrollY: 500,
        gap: GAP,
      }),
    ).toBe(NAV + GAP);
  });
});
