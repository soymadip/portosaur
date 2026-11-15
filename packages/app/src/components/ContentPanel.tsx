import type { ReactNode } from "react";

/**
 * One padded content block; consecutive panels are separated by a
 * hairline. The inner container caps the article at 80rem, centered.
 */
export function ContentPanel({ children }: { children: ReactNode }) {
  return (
    <div className="content-panel">
      <div className="porto-content-container">{children}</div>
    </div>
  );
}
