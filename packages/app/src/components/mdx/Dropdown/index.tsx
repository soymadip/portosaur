import {
  Dropdown as SharedDropdown,
  type DropdownAlign,
  type DropdownItem,
} from "../../Dropdown/index.tsx";

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
