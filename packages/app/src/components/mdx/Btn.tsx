import { renderDynamicIcon } from "../../lib/icons.ts";

/**
 * Btn — a link styled as a button. Variants ported from OG's
 * Button component: primary / secondary / success / warning /
 * danger / info, `outline`, and `sm` / `lg` sizes. The `icon`
 * prop renders a DynamicIcon before the label.
 */
export function Btn({
  href,
  to,
  variant = "primary",
  outline = false,
  size,
  icon,
  children,
}: {
  href?: string;
  to?: string;
  variant?: "primary" | "secondary" | "success" | "warning" | "danger" | "info";
  outline?: boolean;
  size?: "sm" | "lg";
  icon?: string;
  children?: React.ReactNode;
}) {
  const className = [
    "porto-btn",
    `porto-btn--${variant}`,
    outline ? "porto-btn--outline" : "",
    size ? `porto-btn--${size}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <a href={href ?? to ?? "#"} className={className}>
      {icon && (
        <span
          dangerouslySetInnerHTML={{
            __html: renderDynamicIcon(icon, {}),
          }}
        />
      )}
      {children}
    </a>
  );
}
