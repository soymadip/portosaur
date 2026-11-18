"use client";

import { useContext, type ButtonHTMLAttributes, type ReactNode } from "react";
import { TabsContext, tabIdFor } from "./Tabs/index.tsx";

/**
 * TabItem — one panel of a `Tabs` group. Hidden unless its `value`
 * is the active tab. Outside a `Tabs` group (no context) it
 * renders its children plainly.
 *
 * `label`, `default`, and `attributes` are read by the parent
 * `Tabs` (for the tab button). This component only renders the
 * panel. With `lazy` on the parent, inactive panels aren't
 * rendered at all.
 */
export function TabItem({
  value,
  children,
  className,
}: {
  value: string;
  label?: string;
  default?: boolean;
  attributes?: ButtonHTMLAttributes<HTMLButtonElement>;
  className?: string;
  children?: ReactNode;
}) {
  const tabs = useContext(TabsContext);
  if (tabs === null) {
    return <>{children}</>;
  }
  const isActive = tabs.active === value;
  if (!isActive && tabs.lazy) {
    return null;
  }
  const panelClassName = ["porto-tabs__panel", className]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      role="tabpanel"
      id={tabIdFor(tabs.idPrefix, value)}
      aria-labelledby={`${tabIdFor(tabs.idPrefix, value)}-btn`}
      hidden={!isActive}
      className={panelClassName}
    >
      {children}
    </div>
  );
}
