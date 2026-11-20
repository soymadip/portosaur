"use client";

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * Tabs — interactive tab group (Docusaurus `<Tabs>` /
 * `<TabItem>` shape). The active tab's value is shared with the
 * `TabItem` children via context. Each tab button is a real
 * `role="tab"` with `aria-selected` / `aria-controls`, arrow keys
 * move between tabs, and groups with the same `groupId` stay in
 * sync — the choice is remembered in the browser.
 *
 * The starting tab is picked in this order: the URL query value
 * (`queryString`), the remembered group choice, `defaultValue`,
 * the tab marked `default`, then the first tab.
 */

export type TabValue = {
  value: string;
  label?: string;
  default?: boolean;
  attributes?: ButtonHTMLAttributes<HTMLButtonElement>;
};

type TabItemElement = ReactElement<{
  value: string;
  label?: string;
  default?: boolean;
  attributes?: ButtonHTMLAttributes<HTMLButtonElement>;
}>;

type TabsContextValue = {
  active: string | null;
  lazy: boolean;
  idPrefix: string;
};

export const TabsContext = createContext<TabsContextValue | null>(null);

/* Groups with the same id share one live value: picking a tab in
   one group switches every other group on the page with that id.
   The choice is also remembered in localStorage, so it survives
   a reload and carries across pages. */
type GroupListener = (value: string) => void;
const groupListeners = new Map<string, Set<GroupListener>>();

function storageKey(groupId: string) {
  return `porto.tab.${groupId}`;
}

/* Tab values are author text, so they can hold characters that
   don't belong in an id — flatten them for the aria wiring. */
export function tabIdFor(idPrefix: string, value: string) {
  return `${idPrefix}-${value.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function readStoredValue(groupId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(groupId));
  } catch {
    return null;
  }
}

function writeStoredValue(groupId: string, value: string) {
  try {
    window.localStorage.setItem(storageKey(groupId), value);
  } catch {
    /* Storage unavailable (private mode, disabled) — the tabs
       still work, the choice just isn't remembered. */
  }
}

function readQueryValue(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

function writeQueryValue(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.replaceState(null, "", url);
}

/* Tab values come from `values` when given, otherwise from the
   `TabItem` children. Duplicate values are an author mistake:
   warn and keep the first of each. */
function extractChildrenTabValues(children: ReactNode): TabValue[] {
  return Children.toArray(children)
    .filter(
      (child): child is TabItemElement =>
        isValidElement<TabItemElement["props"]>(child) &&
        typeof child.props.value === "string",
    )
    .map((child) => ({
      value: child.props.value,
      label: child.props.label,
      default: child.props.default,
      attributes: child.props.attributes,
    }));
}

function dedupeTabValues(tabValues: TabValue[]): TabValue[] {
  const seen = new Set<string>();
  return tabValues.filter((tab) => {
    if (seen.has(tab.value)) {
      console.error(
        `Portosaur error: duplicate value "${tab.value}" in <Tabs>. ` +
          `Every value needs to be unique.`,
      );
      return false;
    }
    seen.add(tab.value);
    return true;
  });
}

function resolveQueryKey(
  queryString: boolean | string,
  groupId: string | undefined,
): string | null {
  if (typeof queryString === "string") {
    return queryString;
  }
  if (queryString === false) {
    return null;
  }
  if (!groupId) {
    console.error(
      `Portosaur error: <Tabs> needs a groupId when queryString is true, ` +
        `because the group id is used as the query key. You can also pass ` +
        `an explicit key, such as queryString="my-tab".`,
    );
    return null;
  }
  return groupId;
}

export function Tabs({
  children,
  defaultValue,
  groupId,
  queryString = false,
  values: valuesProp,
  block = false,
  lazy = false,
  className,
}: {
  children?: ReactNode;
  defaultValue?: string | null;
  groupId?: string;
  queryString?: boolean | string;
  values?: TabValue[];
  block?: boolean;
  lazy?: boolean;
  className?: string;
}) {
  const instanceId = useId().replace(/:/g, "");
  const idPrefix = `porto-tab-${instanceId}`;
  const queryKey = resolveQueryKey(queryString, groupId);
  const listRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);

  const tabValues = useMemo(
    () => dedupeTabValues(valuesProp ?? extractChildrenTabValues(children)),
    [valuesProp, children],
  );
  const isValidValue = useCallback(
    (value: string | null | undefined): value is string =>
      typeof value === "string" && tabValues.some((tab) => tab.value === value),
    [tabValues],
  );

  /* The first render picks from defaultValue, then the tab marked
     `default`, then the first tab. A defaultValue that matches no
     tab is an author mistake: warn and fall back to the first tab.
     The remembered group choice and the URL query value are
     applied after mount (below), so the server render stays
     identical on both sides. */
  const [active, setActive] = useState<string | null>(() => {
    if (defaultValue) {
      if (tabValues.some((tab) => tab.value === defaultValue)) {
        return defaultValue;
      }
      console.error(
        `Portosaur error: <Tabs> has defaultValue "${defaultValue}" but ` +
          `none of its tabs has that value. Available values are: ` +
          `${tabValues.map((tab) => tab.value).join(", ")}.`,
      );
    }
    return (
      tabValues.find((tab) => tab.default)?.value ?? tabValues[0]?.value ?? null
    );
  });

  const selectValue = useCallback(
    (value: string) => {
      if (!isValidValue(value)) {
        return;
      }
      setActive(value);
      if (groupId) {
        writeStoredValue(groupId, value);
        groupListeners.get(groupId)?.forEach((listener) => listener(value));
      }
      if (queryKey) {
        writeQueryValue(queryKey, value);
      }
    },
    [groupId, isValidValue, queryKey],
  );

  /* After mount, the URL query value wins over the remembered
     group choice. Then this group joins its group listeners, so
     picking a tab elsewhere on the page switches this group too,
     and a storage listener keeps groups in sync across open tabs
     of the same site. */
  useLayoutEffect(() => {
    if (tabValues.length === 0) {
      return;
    }
    const syncedValue =
      (queryKey ? readQueryValue(queryKey) : null) ??
      (groupId ? readStoredValue(groupId) : null);
    if (isValidValue(syncedValue)) {
      setActive(syncedValue);
    }
    if (!groupId) {
      return;
    }
    const onGroupChange: GroupListener = (value) => {
      if (isValidValue(value)) {
        setActive(value);
      }
    };
    const listeners = groupListeners.get(groupId) ?? new Set();
    listeners.add(onGroupChange);
    groupListeners.set(groupId, listeners);
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(groupId) && isValidValue(event.newValue)) {
        setActive(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onGroupChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [groupId, isValidValue, queryKey, tabValues.length]);

  /* The underline under the active tab is one bar that glides
     between tabs: it is sized and placed from the active button's
     box, and CSS animates the move when the active tab changes.
     The first position is set in useLayoutEffect, before paint,
     so the bar never visibly slides in on load. A resize observer
     re-measures when the row's layout shifts (font load, window
     resize). */
  useLayoutEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) {
      return;
    }
    const positionIndicator = () => {
      const activeButton = list.querySelector<HTMLButtonElement>(
        '[role="tab"][aria-selected="true"]',
      );
      if (!activeButton) {
        return;
      }
      indicator.style.left = `${activeButton.offsetLeft}px`;
      indicator.style.width = `${activeButton.offsetWidth}px`;
    };
    positionIndicator();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(positionIndicator);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active, tabValues]);

  /* Arrow keys move to the next or previous tab (wrapping around)
     and switch to it. Home and End jump to the first and last tab.
     Buttons already handle Enter and Space natively. */
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "ArrowRight" &&
      event.key !== "ArrowLeft" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const current = tabs.indexOf(event.target as HTMLButtonElement);
    if (current === -1) {
      return;
    }
    event.preventDefault();
    let next = current;
    if (event.key === "ArrowRight") {
      next = (current + 1) % tabs.length;
    }
    if (event.key === "ArrowLeft") {
      next = (current - 1 + tabs.length) % tabs.length;
    }
    if (event.key === "Home") {
      next = 0;
    }
    if (event.key === "End") {
      next = tabs.length - 1;
    }
    const nextTab = tabs[next];
    const nextValue = tabValues[next]?.value;
    if (nextTab && nextValue) {
      nextTab.focus();
      selectValue(nextValue);
    }
  };

  if (tabValues.length === 0) {
    return null;
  }

  const tabListClassName = [
    "porto-tabs__list",
    block ? "porto-tabs__list--block" : "",
  ]
    .filter(Boolean)
    .join(" ");

  /* The author's className lands on the container, so variants
     like CodeBlockTabs' `porto-tabs--code` can restyle the whole
     switcher (tab row and panels), not just the tab row. */
  const containerClassName = ["porto-tabs", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName}>
      <div
        role="tablist"
        className={tabListClassName}
        onKeyDown={handleKeyDown}
        ref={listRef}
      >
        {tabValues.map((tab) => {
          const { attributes } = tab;
          const triggerClassName = ["porto-tabs__tab", attributes?.className]
            .filter(Boolean)
            .join(" ");
          /* Attributes from the author (title, data-*, ...) go on
             the button first, so the tab's own wiring always wins
             where they overlap. */
          return (
            <button
              {...attributes}
              key={tab.value}
              type="button"
              role="tab"
              id={`${tabIdFor(idPrefix, tab.value)}-btn`}
              aria-selected={active === tab.value}
              aria-controls={tabIdFor(idPrefix, tab.value)}
              tabIndex={active === tab.value ? 0 : -1}
              className={triggerClassName}
              onClick={() => selectValue(tab.value)}
            >
              {tab.label ?? tab.value}
            </button>
          );
        })}
        <span
          ref={indicatorRef}
          className="porto-tabs__indicator"
          aria-hidden="true"
        />
      </div>
      <TabsContext.Provider value={{ active, lazy, idPrefix }}>
        {children}
      </TabsContext.Provider>
    </div>
  );
}
