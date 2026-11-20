/**
 * Portosaur's built-in icon set — the small icons the chrome itself
 * needs (theme select, sidebar carets, edit link). Generated from
 * the installed Iconify packs by scripts/generate-porto-icons.mjs —
 * do not edit by hand.
 *
 * Lucide icons: ISC License, Copyright (c) 2020 Lucide Contributors.
 * Material Design Icons: Apache License 2.0.
 *
 * Content icons (frontmatter `icon`, note cards, feature icons) do
 * NOT come from here — those resolve through `lib/icons.ts` (Iconify
 * packs) at build time.
 */

export const PortoIcons = {
  "chevron-down":
    '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m6 9l6 6l6-6"/>', // lucide:chevron-down
  sidebar:
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></g>', // lucide:panel-left
  copy: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></g>', // lucide:copy
  check:
    '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 6L9 17l-5-5"/>', // lucide:check
  "wrap-text":
    '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16 16l-2 2l2 2"/><path d="M3 12h15a3 3 0 1 1 0 6h-4M3 18h7M3 6h18"/></g>', // lucide:wrap-text
  link: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g>', // lucide:link
  sun: '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></g>', // lucide:sun
  "right-caret":
    '<path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"/>', // mdi:chevron-right
  pencil:
    '<path fill="currentColor" d="m14.06 9l.94.94L5.92 19H5v-.92zm3.6-6c-.25 0-.51.1-.7.29l-1.83 1.83l3.75 3.75l1.83-1.83c.39-.39.39-1.04 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29m-3.6 3.19L3 17.25V21h3.75L17.81 9.94z"/>', // mdi:pencil-outline
  moon: '<path fill="currentColor" d="M2 12a10 10 0 0 0 13 9.54a10 10 0 0 1 0-19.08A10 10 0 0 0 2 12"/>', // mdi:moon-waning-crescent
  laptop:
    '<path fill="currentColor" d="M4 6h16v10H4m16 2a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4c-1.11 0-2 .89-2 2v10a2 2 0 0 0 2 2H0v2h24v-2z"/>', // mdi:laptop
} as const;

export type PortoIcon = keyof typeof PortoIcons;
