"use client";

import { useContext, type ReactNode } from "react";
import { TabsContext } from "./Tabs/index.tsx";

/**
 * TabItem — one panel of a `Tabs` group. Hidden unless its `value`
 * is the active tab. Outside a `Tabs` group (no context) it
 * renders its children plainly.
 */
export function TabItem({
  value,
  children,
}: {
  value: string;
  label?: string;
  children?: ReactNode;
}) {
  const active = useContext(TabsContext);
  if (active === null) {
    return <>{children}</>;
  }
  return (
    <div
      role="tabpanel"
      id={`porto-tab-${value}`}
      aria-labelledby={`porto-tab-btn-${value}`}
      hidden={active !== value}
      className="porto-tabs__panel"
    >
      {children}
    </div>
  );
}
