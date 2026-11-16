import type { MDXComponents } from "mdx/types";
import { Btn } from "./Btn/index.tsx";
import { Details } from "./Details/index.tsx";
import { Dropdown } from "./Dropdown/index.tsx";
import { DynamicIcon } from "./DynamicIcon/index.tsx";
import { Hint } from "./Hint/index.tsx";
import { Icon } from "./Icon/index.tsx";
import { IconSearch } from "./IconSearch/index.tsx";
import { Indent } from "./Indent/index.tsx";
import { Link } from "./Link/index.tsx";
import { Pv } from "./Pv/index.tsx";
import { TabItem } from "./TabItem/index.tsx";
import { Tabs } from "./Tabs/index.tsx";
import { TopicList } from "./TopicList/index.tsx";

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

export { Btn } from "./Btn/index.tsx";
export { Details } from "./Details/index.tsx";
export { Dropdown } from "./Dropdown/index.tsx";
export { DynamicIcon } from "./DynamicIcon/index.tsx";
export { Hint } from "./Hint/index.tsx";
export { Icon } from "./Icon/index.tsx";
export { IconSearch } from "./IconSearch/index.tsx";
export { Indent } from "./Indent/index.tsx";
export { Link } from "./Link/index.tsx";
export { Pv } from "./Pv/index.tsx";
export { TabItem } from "./TabItem/index.tsx";
export { Tabs } from "./Tabs/index.tsx";
export {
  TopicList,
  AutoTopicList,
  TopicListProvider,
  TopicListContext,
} from "./TopicList/index.tsx";
export type {
  TopicListContextValue,
  TopicListItem,
} from "./TopicList/index.tsx";
