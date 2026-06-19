import clsx from "clsx";
import {
  useCurrentSidebarCategory,
  filterDocCardListItems,
} from "@docusaurus/plugin-content-docs/client";

import styles from "./styles.module.css";
import { isIndexPage, TopicCard } from "./src/helpers.jsx";

const DEFAULT_DESC = "Click on the links below to explore the topics.";

/**
 * Lists sub-topics (child sidebar items) inside individual Docusaurus notes.
 * Supports two distinct modes:
 * - **Auto Mode**: (rendered globally via DocItem/Content) No props needed. Reads frontmatter
 *                   internally via `useDoc()`. Controlled via frontmatter configuration (`topic_list.enable` / `topic_list.desc`).
 * - **Manual MDX Mode**: Explicitly declared inside a `.mdx` file with optional prop overrides.
 *
 * @component
 * @param {object} props
 * @param {React.ReactNode} [props.children] - Custom description content. Takes highest priority over all other description sources.
 * @param {string|null} [props.desc] - Custom description string. Explicitly passing `null` disables the description entirely.
 * @param {string} [props.className] - Additional CSS class name(s) applied to the outer `<section>` wrapper container.
 * @param {string} [props.descClass] - CSS class name(s) applied to the description wrapper `<div>`.
 * @param {React.CSSProperties} [props.style={ marginTop: "0rem", marginBottom: "1.6rem", textAlign: "center" }] - Inline styles applied to the description wrapper `<div>`.
 * @returns {React.JSX.Element|null} The rendered topic list grid, or `null` if the component should not render (e.g., disabled, outside a sidebar category, or empty items).
 *
 * @example
 * // 1. Manual MDX: Default behavior (uses frontmatter desc or fallback)
 * <TopicList />
 *
 * @example
 * // 2. Manual MDX: Explicit string description override
 * <TopicList desc="Explore the following advanced sub-topics:" />
 *
 * @example
 * // 3. Manual MDX: Disable description block entirely
 * <TopicList desc={null} />
 *
 * @example
 * // 4. Manual MDX: Rich JSX description using children
 * <TopicList>
 * Please select a topic from the <strong>curated list</strong> below.
 * </TopicList>
 */
export default function TopicList({
  children,
  desc,
  className,
  descClass,
  style = {
    marginTop: "0rem",
    marginBottom: "1.9rem",
    textAlign: "center",
  },
}) {
  let frontMatter = {};
  let metadata = {};

  // Read doc context — may throw outside a doc page (e.g. custom MDX pages)
  try {
    const { useDoc } = require("@docusaurus/plugin-content-docs/client");
    const doc = useDoc();
    frontMatter = doc.frontMatter;
    metadata = doc.metadata;
  } catch (e) {
    // Fallback if not on a category page
  }

  const topicListConfig = frontMatter?.topic_list;

  // Decide whether to render at all:
  // - explicit enable: false → never render
  // - explicit enable: true → always render
  // - no topic_list config → only render on index/README pages
  const shouldRender =
    topicListConfig?.enable === false
      ? false
      : topicListConfig?.enable === true
        ? true
        : isIndexPage(metadata?.source);

  // Get sidebar items — may throw if not on a sidebar category page
  let items;
  try {
    const category = useCurrentSidebarCategory();
    items = category.items;
  } catch (e) {}

  if (!shouldRender || !items || items.length === 0) return null;

  const filteredItems = filterDocCardListItems(items);

  // Class / Layout resolution priority:
  // - Explicit manual prop definition
  // - YAML frontmatter option configuration
  const resolvedClassName = className ?? topicListConfig?.class;
  const resolvedDescClass = descClass ?? topicListConfig?.desc_class;

  // Desc resolution priority:
  // children (manual MDX)
  // desc prop (manual MDX)
  // topic_list.desc from frontmatter (null disables, string overrides)
  // frontMatter.description (page-level description)
  // DEFAULT_DESC
  const resolvedDesc = (() => {
    if (children) return children;
    if (desc !== undefined) return desc; // null disables, string overrides
    if (topicListConfig?.desc !== undefined) return topicListConfig.desc; // null disables
    return frontMatter?.description ?? DEFAULT_DESC;
  })();

  return (
    <>
      {resolvedDesc !== null && (
        <div style={style} className={resolvedDescClass}>
          {resolvedDesc}
        </div>
      )}
      <section
        className={clsx("row", resolvedClassName, {
          [styles.topicListSection]: resolvedDesc === null,
        })}
      >
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
