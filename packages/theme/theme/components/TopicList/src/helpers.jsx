import clsx from "clsx";
import Link from "@docusaurus/Link";
import isInternalUrl from "@docusaurus/isInternalUrl";

import {
  useDocById,
  findFirstSidebarItemLink,
} from "@docusaurus/plugin-content-docs/client";

import {
  extractLeadingEmoji,
  useDocCardDescriptionCategoryItemsPlural,
} from "@docusaurus/theme-common/internal";

import { FaFolder, FaFileAlt, FaLink } from "react-icons/fa";
import {
  resolveIconFromMap,
  renderIconElement,
} from "../../../utils/iconUtils";

import styles from "../styles.module.css";

/**
 * Determines if a document source path represents a category index page.
 * Aligns perfectly with Docusaurus' native category index conventions:
 * 1. File named 'index' (case-insensitive)
 * 2. File named 'README' (case-insensitive)
 * 3. File named exactly like its parent directory (case-insensitive)
 *
 * @param {string} source - The relative file path (e.g., "@site/docs/Guides/index.md" or "Guides/Guides.mdx")
 * @returns {boolean} True if the path is considered an index page.
 */
export function isIndexPage(source) {
  if (!source) return false;

  // 1. Standardize backslashes (Windows) to forward slashes and split
  const pathParts = source.replace(/\\/g, "/").split("/");

  // 2. Extract the file segment (e.g., "Guides.mdx")
  const fullFileName = pathParts.pop();
  if (!fullFileName) return false;

  // 3. Extract immediate parent directory name (e.g., "Guides")
  const parentDirName = pathParts.pop() || "";

  // 4. Strip out the file extension cleanly
  const dotIndex = fullFileName.lastIndexOf(".");
  const fileName =
    dotIndex !== -1 ? fullFileName.slice(0, dotIndex) : fullFileName;

  // 5. Match using Docusaurus' internal matching rules (all lowercased)
  const baseNameLower = fileName.toLowerCase();
  const eligibleDocIndexNames = [
    "index",
    "readme",
    parentDirName.toLowerCase(),
  ];

  return eligibleDocIndexNames.includes(baseNameLower);
}

// Resolve and render icon from customProps - only if explicitly set in frontmatter
export function getIconTitleProps(item, customProps, href) {
  const extracted = extractLeadingEmoji(item.label);
  const title = extracted.rest.trim();

  if (customProps?.icon) {
    const iconData = resolveIconFromMap(customProps.icon) || {
      icon: customProps.icon,
    };
    const { icon: iconVal } = iconData;
    const resolvedColor = "var(--ifm-color-primary)";

    const iconElement = renderIconElement({
      iconVal,
      color: resolvedColor,
      style: { width: "24px", height: "24px" },
    });

    return {
      icon: iconElement,
      title,
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

export function CardCategory({ item }) {
  const href = findFirstSidebarItemLink(item);
  const categoryItemsPlural = useDocCardDescriptionCategoryItemsPlural();

  if (!href) {
    return null;
  }

  const { icon, title } = getIconTitleProps(item, item.customProps, href);

  const descriptionRaw = item.description || item.customProps?.description;
  const itemsCount = categoryItemsPlural(item.items.length);
  const descriptionString = descriptionRaw
    ? `${itemsCount} • ${descriptionRaw}`
    : itemsCount;

  return (
    <div style={{ position: "relative" }}>
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

export function CardLink({ item }) {
  const doc = useDocById(item.docId ?? undefined);
  const href = item.href;
  const customProps = {
    ...doc?.frontMatter,
    ...item.customProps,
  };
  const { icon, title } = getIconTitleProps(item, customProps, href);
  const description = item.description ?? doc?.description;

  return (
    <div style={{ position: "relative" }}>
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

export function TopicCard({ item }) {
  switch (item.type) {
    case "link":
      return <CardLink item={item} />;
    case "category":
      return <CardCategory item={item} />;
    default:
      return null;
  }
}
