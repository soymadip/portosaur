"use client";

import {
  setTheme,
  THEME_LABELS,
  useThemePreference,
  type ThemePreference,
} from "../../../../lib/theme.ts";
import { Dropdown } from "../../../Dropdown/index.tsx";
import { PortoIcon } from "../../../PortoIcon/index.tsx";

/**
 * Portosaur's own theme control — a Light / Dark / Auto dropdown
 * rendered with the shared Dropdown, so its option list is our
 * own markup instead of the browser-native `<select>` popup. The
 * moon/sun/laptop icons are Starlight's (MIT License) — see
 * `lib/porto-icons.ts`.
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

  return (
    <Dropdown
      ariaLabel="Select theme"
      menuRole="menu"
      trigger={
        <span className="porto-theme-select__current">
          <PortoIcon name={ICONS[preference]} size="0.875rem" />
          <span>{THEME_LABELS[preference]}</span>
        </span>
      }
    >
      {OPTIONS.map((option) => (
        <li key={option.value} role="none">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={option.value === preference}
            className="porto-dropdown__item"
            onClick={() => {
              setTheme(option.value);
            }}
          >
            <PortoIcon name={option.icon} size="0.875rem" />
            {option.label}
          </button>
        </li>
      ))}
    </Dropdown>
  );
}
