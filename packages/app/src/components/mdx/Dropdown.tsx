import Link from "next/link";
import { pageHref } from "../../lib/pageUrl.ts";

/**
 * Dropdown — simplified from OG's Dropdown (trigger/label/items).
 * A `<details>`-based menu: click the trigger to open, click an
 * item (or elsewhere) to close. Hover-open is dropped — click
 * works on touch too, where hover doesn't exist.
 *
 * Items come from the `items` prop (`{ label, to?, href? }[]`); when
 * no items are given, the children render as the menu content.
 */
export function Dropdown({
  label,
  trigger,
  items,
  children,
}: {
  label?: string;
  trigger?: string;
  items?: Array<{ label: string; to?: string; href?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <details className="porto-mdx-dropdown">
      <summary className="porto-mdx-dropdown__trigger">
        {trigger ?? label ?? "Menu"}
      </summary>
      <ul className="porto-mdx-dropdown__menu">
        {items
          ? items.map((item) => (
              <li key={item.label}>
                {item.to ? (
                  <Link
                    href={pageHref(item.to)}
                    className="porto-mdx-dropdown__item"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    href={item.href ?? "#"}
                    className="porto-mdx-dropdown__item"
                    target={
                      item.href?.startsWith("http") ? "_blank" : undefined
                    }
                    rel={
                      item.href?.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                  >
                    {item.label}
                  </a>
                )}
              </li>
            ))
          : children}
      </ul>
    </details>
  );
}
