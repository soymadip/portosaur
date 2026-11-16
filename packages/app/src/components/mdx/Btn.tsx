import type { MouseEvent } from "react";
import { renderDynamicIcon } from "../../lib/icons.ts";
import { Button, type ButtonVariant } from "../Button/index.tsx";

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
  href?: string;
  to?: string;
  variant?: ButtonVariant;
  outline?: boolean;
  size?: "sm" | "lg";
  icon?: string;
  sameTab?: boolean;
  className?: string;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  title?: string;
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
          <span
            dangerouslySetInnerHTML={{
              __html: renderDynamicIcon(icon, {}),
            }}
          />
        ) : undefined
      }
    >
      {children}
    </Button>
  );
}
