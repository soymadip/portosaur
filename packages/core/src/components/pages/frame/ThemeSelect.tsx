"use client";

import {
  setTheme,
  THEME_LABELS,
  useThemePreference,
  type ThemePreference,
} from "../../../lib/theme.ts";
import { Dropdown } from "../../Dropdown.tsx";
import { SiteIcon } from "../../SiteIcon.tsx";

/**
 * Portosaur's own theme control — a Light / Dark / Auto dropdown
 * rendered with the shared Dropdown, so its option list is our
 * own markup instead of the browser-native `<select>` popup. The
 * moon/sun/laptop icons render from the site's icon map.
 *
 * Two instances render on a page (navbar + drawer header).
 * They stay in sync through the shared theme store in
 * `lib/theme.ts` (`useThemePreference`).
 *
 * The preference lives under the existing `"theme"` localStorage
 * key (stored `light`/`dark` choices stay valid. `auto` is the new
 * third value). When nothing is stored, the site's `defaultMode`
 * wins — the pre-paint script in the root layout already applied
 * it, and the store reads the effective mode back.
 */

const OPTIONS: {
  label: string;
  value: ThemePreference;
  icon: string;
}[] = [
  { label: "Dark", value: "dark", icon: "mdi:moon-waning-crescent" },
  { label: "Light", value: "light", icon: "lu:sun" },
  { label: "Auto", value: "auto", icon: "mdi:laptop" },
];

export function ThemeSelect() {
  const preference = useThemePreference();
  const currentIcon =
    OPTIONS.find((option) => option.value === preference)?.icon ??
    "mdi:moon-waning-crescent";

  return (
    <Dropdown
      ariaLabel="Select theme"
      menuRole="menu"
      trigger={
        <span className="porto-theme-select__current">
          <SiteIcon icon={currentIcon} size="0.875rem" />
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
            <SiteIcon icon={option.icon} size="0.875rem" />
            {option.label}
          </button>
        </li>
      ))}
    </Dropdown>
  );
}
