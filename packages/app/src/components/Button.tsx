"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { pageHref } from "../lib/pageUrl.ts";

/**
 * Button — the one shared button for the whole app: MDX content
 * (`<Btn>` is a thin wrapper around it), page actions, and the
 * dropdown triggers (which apply the ghost variant's classes to
 * their `<summary>` through `buttonClass`).
 *
 * The class recipe follows Fumadocs' `buttonVariants`
 * (`packages/radix-ui/src/components/ui/button.tsx`): a base of
 * inline-flex, rounded-md, medium weight, 100ms color fades, and
 * variants for default / outline / ghost / secondary — with
 * Portosaur's own colored variants (success, warning, danger,
 * info) carried over from OG's Button, which also lends the API:
 * a `variant` string, an `outline` modifier, `size`, `className`
 * for custom CSS, and `href` / `to` to render a link instead of
 * a `<button>`.
 *
 * `to` is an internal page path (rendered with Next.js `<Link>`,
 * so it prefetches and navigates client-side); `href` is used
 * as-is — external URLs open in a new tab unless `sameTab` is
 * set. With neither, the button renders a plain `<button>`.
 */

export type ButtonVariant =
  "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "ghost";

export type ButtonSize = "sm" | "lg" | "icon" | "icon-sm" | "icon-xs";

/** Fumadocs' `buttonVariants`, as a plain class-name function. */
export function buttonClass({
  variant = "primary",
  outline = false,
  size,
  className = "",
}: {
  variant?: ButtonVariant;
  outline?: boolean;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return [
    "porto-button",
    `porto-button--${variant}`,
    outline && variant !== "ghost" ? "porto-button--outline" : "",
    size ? `porto-button--${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href);
}

export function Button({
  variant = "primary",
  outline = false,
  size,
  icon,
  href,
  to,
  sameTab = false,
  onClick,
  disabled = false,
  type = "button",
  className = "",
  ariaLabel,
  ariaKeyshortcuts,
  title,
  children,
}: {
  variant?: ButtonVariant;
  outline?: boolean;
  size?: ButtonSize;
  /** Rendered before the label (an icon element or node). */
  icon?: ReactNode;
  /** An external or absolute URL — renders an `<a>`. */
  href?: string;
  /** An internal page path — renders a Next.js `<Link>`. */
  to?: string;
  /** Keep an external link in the same tab. */
  sameTab?: boolean;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
  ariaLabel?: string;
  ariaKeyshortcuts?: string;
  title?: string;
  children?: ReactNode;
}) {
  const classes = buttonClass({ variant, outline, size, className });
  const content = (
    <>
      {icon}
      {children}
    </>
  );
  const handleClick = (event: MouseEvent) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  if (to !== undefined) {
    return (
      <Link
        href={pageHref(to)}
        className={classes}
        aria-label={ariaLabel}
        aria-keyshortcuts={ariaKeyshortcuts}
        aria-disabled={disabled ? "true" : undefined}
        title={title}
        onClick={handleClick}
      >
        {content}
      </Link>
    );
  }
  if (href !== undefined) {
    const external = isExternalHref(href);
    return (
      <a
        href={href}
        className={classes}
        aria-label={ariaLabel}
        aria-keyshortcuts={ariaKeyshortcuts}
        aria-disabled={disabled ? "true" : undefined}
        title={title}
        target={external && !sameTab ? "_blank" : undefined}
        rel={external && !sameTab ? "noopener noreferrer" : undefined}
        onClick={handleClick}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type={type}
      className={classes}
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyshortcuts}
      disabled={disabled}
      title={title}
      onClick={handleClick}
    >
      {content}
    </button>
  );
}
