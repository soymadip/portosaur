import type { ReactNode } from "react";

/**
 * One padded content block. Consecutive panels are separated by a
 * hairline. The inner container caps the article at 80rem, centered.
 * `className` adds a modifier, e.g. `content-panel--header` for the
 * title panel, which sits flush under the navbar.
 */
export function ContentPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `content-panel ${className}` : "content-panel"}>
      <div className="porto-content-container">{children}</div>
    </div>
  );
}
