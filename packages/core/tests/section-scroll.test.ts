import { describe, expect, test } from "bun:test";
import { jumpTarget, landingOffset } from "../src/lib/section-scroll.ts";

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

describe("jumpTarget", () => {
  test("aims at the section's first h2 when it has one", () => {
    const heading = { tagName: "H2" } as unknown as Element;
    const section = {
      querySelector: (selector: string) => (selector === "h2" ? heading : null),
    } as unknown as Element;
    expect(jumpTarget(section)).toBe(heading);
  });

  test("falls back to the section itself when it has no h2", () => {
    const section = { querySelector: () => null } as unknown as Element;
    expect(jumpTarget(section)).toBe(section);
  });
});
