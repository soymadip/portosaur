"use client";

import { useEffect, useRef } from "react";
import {
  setTheme,
  THEME_LABELS,
  useThemePreference,
  type ThemePreference,
} from "../../../lib/theme.ts";
import { PortoIcon } from "../../PortoIcon.tsx";

/**
 * Portosaur's own theme control — a Light / Dark / Auto dropdown
 * built like the navbar's "More" dropdown (`<details>` + `<summary>`
 * + menu), so its option list is our own markup instead of the
 * browser-native `<select>` popup. The moon/sun/laptop icons are
 * Starlight's (MIT License) — see `lib/porto-icons.ts`.
 *
 * Two instances render on a page (navbar + mobile menu footer);
 * they stay in sync through the shared theme store in
 * `lib/theme.ts` (`useThemePreference`).
 *
 * The preference lives under the existing `"theme"` localStorage
 * key (stored `light`/`dark` choices stay valid; `auto` is the new
 * third value). When nothing is stored, the site's `defaultMode`
 * wins — the pre-paint script in the root layout already applied
 * it, and the store reads the effective mode back.
 */

const OPTIONS: {
  label: string;
  value: ThemePreference;
  icon: "moon" | "sun" | "laptop";
}[] = [
  { label: "Dark", value: "dark", icon: "moon" },
  { label: "Light", value: "light", icon: "sun" },
  { label: "Auto", value: "auto", icon: "laptop" },
];

const ICONS: Record<ThemePreference, "moon" | "sun" | "laptop"> = {
  dark: "moon",
  light: "sun",
  auto: "laptop",
};

export function ThemeSelect() {
  const preference = useThemePreference();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  // Close the dropdown on outside click / Escape (<details>
  // doesn't close itself). The toggle click itself lands inside
  // the <details>, so it isn't treated as outside.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const details = detailsRef.current;
      if (
        details?.open &&
        event.target instanceof Node &&
        !details.contains(event.target)
      ) {
        details.removeAttribute("open");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        detailsRef.current?.removeAttribute("open");
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details
      ref={detailsRef}
      className="porto-navbar__dropdown porto-theme-select"
    >
      <summary
        className="porto-theme-select__summary"
        aria-label="Select theme"
      >
        <span className="porto-theme-select__current">
          <PortoIcon name={ICONS[preference]} size="0.875rem" />
          <span>{THEME_LABELS[preference]}</span>
        </span>
      </summary>
      <ul className="porto-theme-select__menu" role="menu">
        {OPTIONS.map((option) => (
          <li key={option.value} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={option.value === preference}
              className="porto-theme-select__option"
              onClick={() => {
                setTheme(option.value);
                detailsRef.current?.removeAttribute("open");
              }}
            >
              <PortoIcon name={option.icon} size="0.875rem" />
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
