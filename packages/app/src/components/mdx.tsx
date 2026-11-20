import type { MDXComponents } from "mdx/types";
import type { HTMLAttributes } from "react";
import { Btn } from "./mdx/Btn.tsx";
import { CodeBlock } from "./mdx/CodeBlock.tsx";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "./mdx/CodeBlockTabs.tsx";
import { Details } from "./mdx/Details.tsx";
import { Dropdown } from "./mdx/Dropdown/index.tsx";
import { DynamicIcon } from "./mdx/DynamicIcon.tsx";
import { Heading } from "./mdx/Heading/index.tsx";
import { Hint } from "./mdx/Hint/index.tsx";
import { Icon } from "./mdx/Icon.tsx";
import { IconSearch } from "./mdx/IconSearch/index.tsx";
import { Indent } from "./mdx/Indent/index.tsx";
import { Link } from "./mdx/Link.tsx";
import { Pv } from "./mdx/Pv/index.tsx";
import { TabItem } from "./mdx/TabItem.tsx";
import { Table } from "./mdx/Table.tsx";
import { Tabs } from "./mdx/Tabs/index.tsx";
import { TopicList } from "./mdx/TopicList/index.tsx";

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
    CodeBlockTab,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
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
    /* Every fenced code block renders in the CodeBlock frame. The
       pre's props (title, icon, allowCopy, line numbers) come from
       the fence meta via Fumadocs' rehype-code. */
    pre: (props: HTMLAttributes<HTMLPreElement>) => <CodeBlock {...props} />,
    /* Every markdown table renders in the scrolling Table wrapper,
       Fumadocs-style — the wrapper scrolls, the table keeps its
       rounded corners. */
    table: Table,
    /* Headings carry an anchor link button, Fumadocs wiki style:
       the text links to its own anchor, the button copies it. */
    h2: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h2" {...props} />
    ),
    h3: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h3" {...props} />
    ),
    h4: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h4" {...props} />
    ),
    h5: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h5" {...props} />
    ),
    h6: (props: HTMLAttributes<HTMLHeadingElement>) => (
      <Heading as="h6" {...props} />
    ),
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}

export { Btn } from "./mdx/Btn.tsx";
export { CodeBlock } from "./mdx/CodeBlock.tsx";
export {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "./mdx/CodeBlockTabs.tsx";
export { Details } from "./mdx/Details.tsx";
export { Dropdown } from "./mdx/Dropdown/index.tsx";
export { DynamicIcon } from "./mdx/DynamicIcon.tsx";
export { Hint } from "./mdx/Hint/index.tsx";
export { Icon } from "./mdx/Icon.tsx";
export { IconSearch } from "./mdx/IconSearch/index.tsx";
export { Indent } from "./mdx/Indent/index.tsx";
export { Link } from "./mdx/Link.tsx";
export { Pv } from "./mdx/Pv/index.tsx";
export { TabItem } from "./mdx/TabItem.tsx";
export { Table } from "./mdx/Table.tsx";
export { Tabs } from "./mdx/Tabs/index.tsx";
export {
  TopicList,
  AutoTopicList,
  TopicListProvider,
  TopicListContext,
} from "./mdx/TopicList/index.tsx";
export type {
  TopicListContextValue,
  TopicListItem,
} from "./mdx/TopicList/index.tsx";
