import type { MDXComponents } from "mdx/types";
import type { HTMLAttributes, ReactNode } from "react";
import { Children, isValidElement } from "react";
import {
  Dropdown as SharedDropdown,
  type DropdownAlign,
  type DropdownItem,
} from "./Dropdown.tsx";
import { Btn } from "./mdx/Btn.tsx";
import { CodeBlock } from "./mdx/CodeBlock.tsx";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "./mdx/CodeBlockTabs.tsx";
import { Details } from "./mdx/Details.tsx";
import { DynamicIcon } from "./mdx/DynamicIcon.tsx";
import { Heading } from "./mdx/Heading.tsx";
import { Hint } from "./mdx/Hint.tsx";
import { Icon } from "./mdx/Icon.tsx";
import { IconSearch } from "./mdx/IconSearch.tsx";
import { Indent } from "./mdx/Indent.tsx";
import { Link } from "./mdx/Link.tsx";
import { Pv } from "./mdx/Pv.tsx";
import { TabItem } from "./mdx/TabItem.tsx";
import { Table } from "./mdx/Table.tsx";
import { Tabs } from "./mdx/Tabs.tsx";
import { TopicList } from "./mdx/TopicList.tsx";

/**
 * Dropdown — the MDX `<Dropdown>` tag: a thin wrapper around the
 * shared Dropdown with the compact trigger, keeping OG's MDX
 * API — `trigger` / `label`, an `items` array
 * (`{ label, to?, href? }[]`), and `children` as the menu
 * content when no items are given. `className`, `menuClassName`,
 * and `triggerClassName` pass extra CSS classes through, like
 * OG's. A click opens the menu (no hover-open — click works on
 * touch too, where hover doesn't exist). Clicking an item or
 * elsewhere closes it.
 */
export function Dropdown({
  label,
  trigger,
  items,
  children,
  align,
  noArrow = false,
  dropUp = false,
  className = "",
  menuClassName = "",
  triggerClassName = "",
  ariaLabel,
}: {
  label?: string;
  trigger?: string;
  items?: DropdownItem[];
  children?: React.ReactNode;
  align?: DropdownAlign;
  noArrow?: boolean;
  dropUp?: boolean;
  className?: string;
  menuClassName?: string;
  triggerClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <SharedDropdown
      label={label}
      trigger={trigger}
      items={items}
      align={align}
      noArrow={noArrow}
      dropUp={dropUp}
      className={className}
      menuClassName={menuClassName}
      triggerClassName={triggerClassName}
      ariaLabel={ariaLabel}
      size="sm"
    >
      {children}
    </SharedDropdown>
  );
}

/**
 * Block-level MDX components: their root element is a div, details,
 * or figure, which HTML forbids inside a <p>. A Dropdown mid-sentence
 * (or any of these without blank lines around it) lands in a paragraph
 * node, and React warns that <summary> or <div> cannot descend from
 * <p> — a hydration error. So a paragraph holding one of these renders
 * as a <div> instead. Inline components (Btn, Icon, Link, Pv) stay in
 * a <p> — their roots are phrasing content.
 */
const BLOCK_COMPONENTS: Set<unknown> = new Set([
  CodeBlock,
  CodeBlockTabs,
  Details,
  Dropdown,
  Hint,
  IconSearch,
  Indent,
  Tabs,
  TopicList,
]);

function hasBlockComponent(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement(child)) return false;
    if (BLOCK_COMPONENTS.has(child.type)) return true;
    return hasBlockComponent(
      (child.props as { children?: ReactNode }).children,
    );
  });
}

function Paragraph({
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  if (hasBlockComponent(children)) {
    return (
      <div className="porto-mdx-paragraph" {...props}>
        {children}
      </div>
    );
  }
  return <p {...props}>{children}</p>;
}

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
    /* A paragraph holding a block-level component (a Dropdown
       mid-sentence, a Tabs group without blank lines around it)
       renders as a <div> — HTML forbids divs and details inside
       a <p>, and React reports it as a hydration error. */
    p: Paragraph,
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
export { DynamicIcon } from "./mdx/DynamicIcon.tsx";
export { Hint } from "./mdx/Hint.tsx";
export { Icon } from "./mdx/Icon.tsx";
export { IconSearch } from "./mdx/IconSearch.tsx";
export { Indent } from "./mdx/Indent.tsx";
export { Link } from "./mdx/Link.tsx";
export { Pv } from "./mdx/Pv.tsx";
export { TabItem } from "./mdx/TabItem.tsx";
export { Table } from "./mdx/Table.tsx";
export { Tabs } from "./mdx/Tabs.tsx";
export {
  TopicList,
  AutoTopicList,
  TopicListProvider,
  TopicListContext,
} from "./mdx/TopicList.tsx";
export type { TopicListContextValue, TopicListItem } from "./mdx/TopicList.tsx";
