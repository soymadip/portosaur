import type { MDXComponents } from "mdx/types";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Children, isValidElement } from "react";
import NextLink from "next/link";
import { pageHref } from "../lib/pageUrl.ts";
import {
  Dropdown as SharedDropdown,
  type DropdownAlign,
  type DropdownItem,
} from "./Dropdown.tsx";
import { Btn } from "./mdx/Btn.tsx";
import { Card, Cards } from "./mdx/Cards.tsx";
import { CodeBlock } from "./mdx/CodeBlock.tsx";
import {
  CodeBlockTab,
  CodeBlockTabs,
  CodeBlockTabsList,
  CodeBlockTabsTrigger,
} from "./mdx/CodeBlockTabs.tsx";
import { Details } from "./mdx/Details.tsx";
import { Diagram } from "./mdx/Diagram.tsx";
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
  /** The trigger text. */
  label?: string;
  /** Full trigger content — a string renders as the label text. */
  trigger?: string;
  /** The menu items — links, buttons and separators. */
  items?: DropdownItem[];
  children?: React.ReactNode;
  /** Pin the menu to the trigger's left or right edge. Centered by default. */
  align?: DropdownAlign;
  /** Drop the chevron on the trigger. */
  noArrow?: boolean;
  /** Open the menu above the trigger instead of below it. */
  dropUp?: boolean;
  /** Extra class on the container (`<details>`). */
  className?: string;
  /** Extra class on the menu (`<ul>`). */
  menuClassName?: string;
  /** Extra class on the trigger (`<summary>`). */
  triggerClassName?: string;
  /** Accessible label for the trigger. */
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
  Cards,
  CodeBlock,
  CodeBlockTabs,
  Details,
  Diagram,
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

/** The loader surface link resolution needs (a subset of `LoaderOutput`). */
export interface HrefResolver {
  // A method, not a property: methods are bivariant, so a typed
  // loader stays assignable here.
  resolveHref(href: string, page: unknown): string;
}

type AnchorProps = ComponentProps<"a">;

/**
 * The MDX `a` override — resolves relative links
 * (`./guide/setup.mdx`) to page URLs through the loader, renders
 * internal links via Next.js `<Link>`, and leaves external and
 * hash links as plain anchors. The generated route passes the
 * result in as `components` (Portosaur's own replacement for
 * `fumadocs-ui/mdx`'s version, which it does not depend on).
 */
export function createRelativeLink(
  source: HrefResolver,
  page: unknown,
): (props: AnchorProps) => ReactNode {
  return function MdxLink({ href, ...props }: AnchorProps) {
    if (!href) {
      return <a {...props} />;
    }
    // Absolute URLs, protocol-relative URLs, and hash links pass
    // through unchanged — never resolve or slash them.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) {
      const external = /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          {...props}
        />
      );
    }
    const resolved = pageHref(source.resolveHref(href, page));
    return <NextLink href={resolved} {...props} />;
  };
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
    Card,
    Cards,
    CodeBlockTab,
    CodeBlockTabs,
    CodeBlockTabsList,
    CodeBlockTabsTrigger,
    Details,
    Diagram,
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
export { Card, Cards } from "./mdx/Cards.tsx";
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
