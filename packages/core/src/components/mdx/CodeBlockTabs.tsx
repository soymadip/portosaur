import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Tabs, type TabValue } from "./Tabs.tsx";
import { TabItem } from "./TabItem.tsx";

/**
 * CodeBlockTabs — the tabs Fumadocs' `remark-code-tab` generates
 * from code fences with `tab="..."` meta (and `remark-npm` from
 * npm commands). The plugin emits a `CodeBlockTabsList` of
 * `CodeBlockTabsTrigger`s plus a `CodeBlockTab` per fence. This
 * component reads that shape and renders the plain `Tabs`
 * underneath, so code tabs share its switching, group sync,
 * persistence, and keyboard support. The `porto-tabs--code`
 * variant drops the panel padding — the code fills the box.
 *
 * `CodeBlockTabsList`, `CodeBlockTabsTrigger`, and `CodeBlockTab`
 * are element descriptors only: `CodeBlockTabs` reads their props
 * and never renders them. They are mapped in `mdx.tsx` so MDX can
 * resolve the generated elements. Rendered on their own, they
 * pass their children through.
 */
export function CodeBlockTabsList({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function CodeBlockTabsTrigger({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function CodeBlockTab({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/* Trigger labels are plain text (the plugin runs with parseMdx
   off) — flattened defensively in case a label ever nests. */
function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(textOf).join("");
  }
  if (isValidElement(node)) {
    return textOf((node.props as { children?: ReactNode }).children);
  }
  return "";
}

type ElementProps = { value?: string; children?: ReactNode };

export function CodeBlockTabs({
  children,
  defaultValue,
  groupId,
}: {
  children?: ReactNode;
  defaultValue?: string;
  groupId?: string;
  /* The plugin passes `persist` with `groupId`. Portosaur always
     persists grouped tabs to localStorage, so there is nothing to
     do with it. */
  persist?: boolean;
}) {
  const elements = Children.toArray(children).filter(
    (child): child is ReactElement => isValidElement(child),
  );
  const list = elements.find((el) => el.type === CodeBlockTabsList);
  const panels = elements.filter((el) => el.type === CodeBlockTab);

  const triggers = list
    ? Children.toArray((list.props as ElementProps).children).filter(
        (child): child is ReactElement =>
          isValidElement(child) && child.type === CodeBlockTabsTrigger,
      )
    : [];

  const values: TabValue[] = triggers
    .map((trigger) => {
      const props = trigger.props as ElementProps;
      return {
        value: props.value ?? "",
        label: textOf(props.children),
      };
    })
    .filter((tab) => tab.value !== "");

  if (values.length === 0 || panels.length === 0) {
    /* Not the shape the plugin generates — render as-is rather
       than dropping the author's content. */
    return <>{children}</>;
  }

  return (
    <Tabs
      groupId={groupId}
      defaultValue={defaultValue}
      values={values}
      className="porto-tabs--code"
    >
      {panels.map((panel) => {
        const props = panel.props as ElementProps;
        return (
          <TabItem key={props.value} value={props.value ?? ""}>
            {props.children}
          </TabItem>
        );
      })}
    </Tabs>
  );
}
