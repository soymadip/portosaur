"use client";

import {
  Children,
  createContext,
  isValidElement,
  useState,
  type ReactNode,
} from "react";

/**
 * Tabs — interactive tab group (Docusaurus `<Tabs>` /
 * `<TabItem>` shape). The active tab's value is shared with the
 * `TabItem` children via context; `defaultValue` picks the
 * initial tab, otherwise the first item wins. Each tab button is
 * a real `role="tab"` with `aria-selected` / `aria-controls`.
 */

export const TabsContext = createContext<string | null>(null);

export function Tabs({
  children,
  defaultValue,
}: {
  children?: ReactNode;
  defaultValue?: string;
}) {
  const items = Children.toArray(children).filter(
    (child): child is React.ReactElement<{ value: string; label?: string }> =>
      isValidElement<{ value: string; label?: string }>(child) &&
      typeof child.props.value === "string",
  );
  const values = items.map((item) => ({
    value: item.props.value,
    label: item.props.label ?? item.props.value,
  }));
  const [active, setActive] = useState<string | null>(
    defaultValue ?? values[0]?.value ?? null,
  );
  if (values.length === 0) {
    return null;
  }
  return (
    <div className="porto-tabs">
      <div role="tablist" className="porto-tabs__list">
        {values.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            id={`porto-tab-btn-${item.value}`}
            aria-selected={active === item.value}
            aria-controls={`porto-tab-${item.value}`}
            className="porto-tabs__tab"
            onClick={() => setActive(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <TabsContext.Provider value={active}>{children}</TabsContext.Provider>
    </div>
  );
}
