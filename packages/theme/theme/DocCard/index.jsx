import {
  useDocById,
  findFirstSidebarItemLink,
} from "@docusaurus/plugin-content-docs/client";
import {
  extractLeadingEmoji,
  useDocCardDescriptionCategoryItemsPlural,
} from "@docusaurus/theme-common/internal";
import isInternalUrl from "@docusaurus/isInternalUrl";
import Layout from "@theme/DocCard/Layout";

import { FaFolder, FaFileAlt, FaLink } from "react-icons/fa";
import { resolveIconFromMap, renderIconElement } from "../utils/iconUtils";

// Resolve and render icon from customProps - only if explicitly set in frontmatter
function getIconTitleProps(item, customProps, href) {
  const extracted = extractLeadingEmoji(item.label);
  const title = extracted.rest.trim();

  if (customProps?.icon) {
    const iconData = resolveIconFromMap(customProps.icon) || {
      icon: customProps.icon,
    };
    const { icon: iconVal, color: iconColor } = iconData;
    const resolvedColor =
      customProps?.color || iconColor || "var(--ifm-color-primary)";

    const iconElement = renderIconElement({
      iconVal,
      color: resolvedColor,
      style: { width: "24px", height: "24px" },
    });

    return {
      icon: iconElement,
      title,
      color: customProps?.color || iconColor,
    };
  }

  // If there's an emoji explicitly prefixed in the label, use that
  if (extracted.emoji) {
    return { icon: extracted.emoji, title };
  }

  // No explicit icon and no label emoji - use clean React Icons
  const IconComp =
    item.type === "category"
      ? FaFolder
      : isInternalUrl(href)
        ? FaFileAlt
        : FaLink;

  const iconElement = (
    <IconComp
      style={{
        width: "20px",
        height: "20px",
        color: "var(--ifm-color-primary)",
      }}
    />
  );

  return { icon: iconElement, title };
}

function getCardStyle(color) {
  if (!color) {
    return undefined;
  }

  return { "--ifm-color-primary": color };
}

function CardCategory({ item }) {
  const href = findFirstSidebarItemLink(item);
  const categoryItemsPlural = useDocCardDescriptionCategoryItemsPlural();

  if (!href) {
    return null;
  }

  const { icon, title, color } = getIconTitleProps(
    item,
    item.customProps,
    href,
  );

  const cardStyle = getCardStyle(color);

  // Prefer explicit category description, then index doc description (injected by
  // sidebar generator).
  const descriptionRaw = item.description || item.customProps?.description;

  const itemsCount = categoryItemsPlural(item.items.length);

  const descriptionString = descriptionRaw
    ? `${itemsCount} • ${descriptionRaw}`
    : itemsCount;

  // Prefix items count to the description and make it bold
  const descriptionNode = (
    <span data-raw-string={descriptionString}>
      <strong style={{ color: "var(--ifm-font-color-base)" }}>
        {itemsCount}
      </strong>
      {descriptionRaw ? (
        <>
          {" "}
          <span style={{ opacity: 0.5 }}>•</span> {descriptionRaw}
        </>
      ) : null}
    </span>
  );

  return (
    <div style={{ ...cardStyle, position: "relative" }}>
      <Layout
        item={item}
        className={item.className}
        href={href}
        description={descriptionNode}
        icon={icon}
        title={title}
      />
    </div>
  );
}

function CardLink({ item }) {
  const doc = useDocById(item.docId ?? undefined);
  const href = item.href;
  const customProps = {
    ...doc?.frontMatter,
    ...item.customProps,
  };
  const { icon, title, color } = getIconTitleProps(item, customProps, href);
  const cardStyle = getCardStyle(color);

  return (
    <div style={cardStyle}>
      <Layout
        item={item}
        className={item.className}
        href={href}
        description={item.description ?? doc?.description}
        icon={icon}
        title={title}
      />
    </div>
  );
}

export default function DocCard({ item }) {
  switch (item.type) {
    case "link":
      return <CardLink item={item} />;
    case "category":
      return <CardCategory item={item} />;
    default:
      throw new Error(`unknown item type ${JSON.stringify(item)}`);
  }
}
