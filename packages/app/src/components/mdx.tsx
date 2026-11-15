import type { MDXComponents } from "mdx/types";
import { Btn } from "./mdx/Btn.tsx";
import { Details } from "./mdx/Details.tsx";
import { Dropdown } from "./mdx/Dropdown.tsx";
import { DynamicIcon } from "./mdx/DynamicIcon.tsx";
import { Hint } from "./mdx/Hint.tsx";
import { Icon } from "./mdx/Icon.tsx";
import { IconSearch } from "./mdx/IconSearch.tsx";
import { Indent } from "./mdx/Indent.tsx";
import { Link } from "./mdx/Link.tsx";
import { Pv } from "./mdx/Pv.tsx";
import { TabItem } from "./mdx/TabItem.tsx";
import { Tabs } from "./mdx/Tabs.tsx";
import { TopicList } from "./mdx/TopicList.tsx";

/**
 * Portosaur's MDX components — the tags MDX content may use
 * (`<Btn>`, `<Tabs>`, `<Hint>`, …). Follows Fumadocs' canonical
 * pattern: the generated route passes its `a` override (the
 * relative-link resolver) in as `components`, and it merges over
 * the defaults.
 *
 * `useMDXComponents` is the Next.js MDX convention name for the
 * same function, and the global `MDXProvidedComponents` type lets
 * MDX files type-check their component usage against this map.
 */
export function getMDXComponents(components?: MDXComponents) {
  return {
    Btn,
    Details,
    Dropdown,
    DynamicIcon,
    Hint,
    Icon,
    IconSearch,
    Indent,
    Link,
    Pv,
    TabItem,
    Tabs,
    TopicList,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

export { Btn } from "./mdx/Btn.tsx";
export { Details } from "./mdx/Details.tsx";
export { Dropdown } from "./mdx/Dropdown.tsx";
export { DynamicIcon } from "./mdx/DynamicIcon.tsx";
export { Hint } from "./mdx/Hint.tsx";
export { Icon } from "./mdx/Icon.tsx";
export { IconSearch } from "./mdx/IconSearch.tsx";
export { Indent } from "./mdx/Indent.tsx";
export { Link } from "./mdx/Link.tsx";
export { Pv } from "./mdx/Pv.tsx";
export { TabItem } from "./mdx/TabItem.tsx";
export { Tabs } from "./mdx/Tabs.tsx";
export {
  TopicList,
  AutoTopicList,
  TopicListProvider,
  TopicListContext,
} from "./mdx/TopicList.tsx";
export type { TopicListContextValue, TopicListItem } from "./mdx/TopicList.tsx";
