import type { MouseEvent } from "react";
import { SiteIcon } from "../SiteIcon.tsx";
import { Button, type ButtonVariant } from "../Button.tsx";

/**
 * Btn — the MDX content button: a link styled as a button.
 * A thin wrapper around the shared `Button` — the variants
 * (primary / secondary / success / warning / danger / info /
 * ghost), `outline`, and `sm` / `lg` sizes are OG's Button API,
 * and the `icon` prop renders a DynamicIcon before the label.
 * `className`, `disabled`, `onClick`, `title`, and `ariaLabel`
 * pass straight through to the shared Button.
 */
export function Btn({
  href,
  to,
  variant = "primary",
  outline = false,
  size,
  icon,
  sameTab = false,
  className = "",
  disabled = false,
  onClick,
  title,
  ariaLabel,
  children,
}: {
  /** A full URL — external links open in a new tab. */
  href?: string;
  /** An internal page path. */
  to?: string;
  /** The button style. */
  variant?: ButtonVariant;
  /** Outline style instead of a filled button. */
  outline?: boolean;
  /** Small or large. Leave unset for the default size. */
  size?: "sm" | "lg";
  /** An icon id shown before the label. */
  icon?: string;
  /** Keep an external link in the same tab. */
  sameTab?: boolean;
  /** Extra classes on the button. */
  className?: string;
  /** Render the button disabled. */
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  /** Tooltip text. */
  title?: string;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <Button
      variant={variant}
      outline={outline}
      size={size}
      href={href}
      to={to}
      sameTab={sameTab}
      className={className}
      disabled={disabled}
      onClick={onClick}
      title={title}
      ariaLabel={ariaLabel}
      icon={
        icon ? (
          <span>
            <SiteIcon icon={icon} />
          </span>
        ) : undefined
      }
    >
      {children}
    </Button>
  );
}
