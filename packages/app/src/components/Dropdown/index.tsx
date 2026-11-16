"use client";

import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { pageHref } from "../../lib/pageUrl.ts";
import { buttonClass } from "../Button/index.tsx";
import { PortoIcon } from "../PortoIcon/index.tsx";

/**
 * Dropdown — the one shared dropdown for the whole app: the
 * navbar's nav + "More" menus, the theme select, and the MDX
 * `<Dropdown>` tag (a thin wrapper around it). One
 * `<details>` + `<summary>` + menu, one popover style, one
 * close behavior — the three copies it replaces had drifted
 * apart while looking the same.
 *
 * The API follows OG's Dropdown: `trigger` / `label`, an `items`
 * array (links, buttons, separators, custom `render` functions),
 * `className` for the container and `menuClassName` for the
 * menu, `noArrow` to drop the chevron. `children` renders as
 * the menu content instead of `items` — the theme select uses
 * it for its radio options.
 *
 * Alignment follows Fumadocs' popover (`align="center"` by
 * default): the menu centers under the trigger, and OG's
 * edge-aware clamp shifts it back inside the viewport (or the
 * nearest clipping container, like the mobile menu popover)
 * when it would overflow. `align="left"` / `"right"` pin the
 * menu to the trigger's edge instead; the clamp still applies.
 *
 * The trigger is the shared ghost Button (`buttonClass`) on a
 * `<summary>` — a `<button>` cannot toggle a `<details>`.
 * `size="sm"` is the compact trigger the MDX dropdown uses in
 * content.
 */

export type DropdownItem =
  | { type: "separator" }
  | {
      id?: string;
      label: string;
      /** An internal page path — rendered with Next.js `<Link>`. */
      to?: string;
      /** A full URL or absolute path — external ones open a new tab. */
      href?: string;
      icon?: ReactNode;
      active?: boolean;
      onClick?: () => void;
      /** Keep an external link in the same tab. */
      sameTab?: boolean;
      /** Tooltip text for the item. */
      desc?: string;
      /** `false` skips Next.js prefetch for this link. */
      prefetch?: boolean;
      /** Custom item content — receives a `close` for the menu. */
      render?: (api: { close: () => void }) => ReactNode;
    };

export type DropdownAlign = "left" | "center" | "right";

function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

function renderItem(
  item: DropdownItem,
  index: number,
  close: () => void,
): ReactNode {
  if ("type" in item) {
    return (
      <li key={`separator-${index}`} role="separator">
        <hr className="porto-dropdown__separator" />
      </li>
    );
  }
  if (item.render) {
    return (
      <Fragment key={item.id ?? item.label ?? index}>
        {item.render({ close })}
      </Fragment>
    );
  }
  const key = item.id ?? item.label ?? index;
  const className = `porto-dropdown__item${item.active ? " active" : ""}`;
  const content = (
    <>
      {item.icon ? (
        <span className="porto-dropdown__item-icon">{item.icon}</span>
      ) : null}
      {item.label}
    </>
  );
  const prefetch = item.prefetch === false ? false : undefined;
  if (item.to !== undefined) {
    return (
      <li key={key}>
        <Link
          href={pageHref(item.to)}
          className={className}
          title={item.desc}
          prefetch={prefetch}
          onClick={item.onClick}
        >
          {content}
        </Link>
      </li>
    );
  }
  if (item.href !== undefined) {
    if (isExternalHref(item.href)) {
      return (
        <li key={key}>
          <a
            href={item.href}
            className={className}
            title={item.desc}
            target={item.sameTab ? undefined : "_blank"}
            rel={item.sameTab ? undefined : "noopener noreferrer"}
            onClick={item.onClick}
          >
            {content}
          </a>
        </li>
      );
    }
    return (
      <li key={key}>
        <Link
          href={item.href}
          className={className}
          title={item.desc}
          prefetch={prefetch}
          onClick={item.onClick}
        >
          {content}
        </Link>
      </li>
    );
  }
  return (
    <li key={key}>
      <button
        type="button"
        className={className}
        title={item.desc}
        onClick={item.onClick}
      >
        {content}
      </button>
    </li>
  );
}

export function Dropdown({
  label,
  trigger,
  items,
  children,
  className = "",
  menuClassName = "",
  triggerClassName = "",
  align = "center",
  noArrow = false,
  size,
  ariaLabel,
  menuRole,
}: {
  label?: string;
  /** Full trigger content — a string renders as the label text. */
  trigger?: ReactNode;
  items?: DropdownItem[];
  /** Menu content when no `items` are given. */
  children?: ReactNode;
  /** Extra class on the container (`<details>`). */
  className?: string;
  /** Extra class on the menu (`<ul>`). */
  menuClassName?: string;
  /** Extra class on the trigger (`<summary>`). */
  triggerClassName?: string;
  align?: DropdownAlign;
  noArrow?: boolean;
  /** `"sm"` is the compact trigger for use inside content. */
  size?: "sm";
  ariaLabel?: string;
  /** `role` for the menu — the theme select passes `"menu"`. */
  menuRole?: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    detailsRef.current?.removeAttribute("open");
  }, []);

  // Edge-aware clamp (OG's approach): measure the open menu and
  // shift it back inside the viewport — or the nearest clipping
  // container, so the theme menu inside the mobile popover stays
  // inside the popover — or the nearest `isolation: isolate`
  // ancestor, so a menu in content stays inside the main pane
  // (its z-index can't lift it past the pane's edge — a menu
  // hanging over the sidebar paints underneath it). The shift
  // lands in `--porto-menu-offset`, which the alignment rules add
  // to the menu's position.
  const clampMenu = useCallback(() => {
    const details = detailsRef.current;
    const menu = menuRef.current;
    if (!details?.open || !menu) {
      return;
    }
    menu.style.setProperty("--porto-menu-offset", "0px");
    requestAnimationFrame(() => {
      if (!details.open) {
        return;
      }
      const rect = menu.getBoundingClientRect();
      const padding = 12;
      let leftBound = padding;
      let rightBound = document.documentElement.clientWidth - padding;
      let el = details.parentElement;
      while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        if (
          overflowX === "auto" ||
          overflowX === "scroll" ||
          overflowX === "hidden" ||
          style.isolation === "isolate"
        ) {
          const bounds = el.getBoundingClientRect();
          rightBound = Math.min(rightBound, bounds.right - padding);
          leftBound = Math.max(leftBound, bounds.left + padding);
          break;
        }
        el = el.parentElement;
      }
      let offset = 0;
      if (rect.left < leftBound) {
        offset = leftBound - rect.left;
      } else if (rect.right > rightBound) {
        offset = rightBound - rect.right;
      }
      menu.style.setProperty("--porto-menu-offset", `${offset}px`);
    });
  }, []);

  // Close on outside click / Escape (`<details>` doesn't close
  // itself). The toggle click itself lands inside the
  // `<details>`, so it isn't treated as outside. Re-clamp on
  // resize while open — the trigger may have moved.
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
    const onResize = () => {
      if (detailsRef.current?.open) {
        clampMenu();
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [clampMenu]);

  const detailsClasses = ["porto-dropdown", className]
    .filter(Boolean)
    .join(" ");
  const triggerClasses = [
    buttonClass({ variant: "ghost" }),
    "porto-dropdown__trigger",
    size === "sm" ? "porto-dropdown__trigger--sm" : "",
    triggerClassName,
  ]
    .filter(Boolean)
    .join(" ");
  const menuClasses = ["porto-dropdown__menu", menuClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <details
      ref={detailsRef}
      className={detailsClasses}
      onToggle={() => {
        if (detailsRef.current?.open) {
          clampMenu();
        }
      }}
    >
      <summary className={triggerClasses} aria-label={ariaLabel}>
        {trigger ?? label ?? "Menu"}
        {!noArrow && (
          <PortoIcon
            name="chevron-down"
            size="0.875rem"
            className="porto-dropdown__chevron"
          />
        )}
      </summary>
      <ul
        ref={menuRef}
        className={menuClasses}
        data-align={align}
        role={menuRole}
        onClick={close}
      >
        {items
          ? items.map((item, index) => renderItem(item, index, close))
          : children}
      </ul>
    </details>
  );
}
