import clsx from "clsx";
import Link from "@docusaurus/Link";
import {
  useDocById,
  findFirstSidebarItemLink,
  useCurrentSidebarCategory,
  filterDocCardListItems,
} from "@docusaurus/plugin-content-docs/client";
import {
  extractLeadingEmoji,
  useDocCardDescriptionCategoryItemsPlural,
} from "@docusaurus/theme-common/internal";
import isInternalUrl from "@docusaurus/isInternalUrl";

import { FaFolder, FaFileAlt, FaLink } from "react-icons/fa";
import { resolveIconFromMap, renderIconElement } from "../../utils/iconUtils";

import styles from "./styles.module.css";

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
  const descriptionRaw = item.description || item.customProps?.description;
  const itemsCount = categoryItemsPlural(item.items.length);
  const descriptionString = descriptionRaw
    ? `${itemsCount} • ${descriptionRaw}`
    : itemsCount;

  return (
    <div style={{ ...cardStyle, position: "relative" }}>
      <Link
        href={href}
        className={clsx("card padding--lg", styles.cardContainer)}
        title={descriptionString}
      >
        <h2 className={styles.cardTitle} title={title}>
          <span className={styles.cardIcon}>{icon}</span>
          <span className="text--truncate">{title}</span>
        </h2>
        <p className={clsx("text--truncate", styles.cardDescription)}>
          <strong style={{ color: "var(--ifm-font-color-base)" }}>
            {itemsCount}
          </strong>
          {descriptionRaw ? (
            <>
              {" "}
              <span style={{ opacity: 0.5 }}>•</span> {descriptionRaw}
            </>
          ) : null}
        </p>
      </Link>
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
  const description = item.description ?? doc?.description;

  return (
    <div style={{ ...cardStyle, position: "relative" }}>
      <Link
        href={href}
        className={clsx("card padding--lg", styles.cardContainer)}
        title={description || undefined}
      >
        <h2 className={styles.cardTitle} title={title}>
          <span className={styles.cardIcon}>{icon}</span>
          <span className="text--truncate">{title}</span>
        </h2>
        {description && (
          <p className={clsx("text--truncate", styles.cardDescription)}>
            {description}
          </p>
        )}
      </Link>
    </div>
  );
}

function TopicCard({ item }) {
  switch (item.type) {
    case "link":
      return <CardLink item={item} />;
    case "category":
      return <CardCategory item={item} />;
    default:
      return null;
  }
}

// List Topics inside Individual Notes
export default function TopicList({
  children,
  description = "Click on the links below to explore the topics.",
  style = {
    marginTop: "-2.5rem",
    marginBottom: "2.5rem",
    textAlign: "center",
  },
}) {
  let items;
  try {
    const category = useCurrentSidebarCategory();
    items = category.items;
  } catch (e) {
    // Fallback if not on a category page
  }

  if (!items || items.length === 0) {
    return null;
  }

  const filteredItems = filterDocCardListItems(items);

  return (
    <>
      <br />
      {(children || description) && (
        <p style={style}>{children || description}</p>
      )}
      <section className="row">
        {filteredItems.map((item, index) => (
          <article
            key={index}
            className={clsx("col col--6", styles.docCardListItem)}
          >
            <TopicCard item={item} />
          </article>
        ))}
      </section>
    </>
  );
}
