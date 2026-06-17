import useBaseUrl from "@docusaurus/useBaseUrl";
import { usePluginData } from "@docusaurus/useGlobalData";
import Link from "@docusaurus/Link";
import { FaBook, FaChevronRight } from "react-icons/fa";
import Tooltip from "../Tooltip/index.jsx";
import { iconMap } from "../../config/iconMappings.jsx";
import { guessDocPermalink } from "../../utils/docsUtils.js";
import styles from "./styles.module.css";

/**
 * Represents a parsed markdown note, extracted from Docusaurus frontmatter.
 * @typedef {Object} ParsedNote
 * @property {string} title - Display title (from `title` or directory name)
 * @property {string} slug - Routing slug (from `slug` or computed)
 * @property {string} description - Description for tooltips (from `description`)
 * @property {number} position - Ordering weight (from `sidebar_position`)
 * @property {string|null} iconStr - Custom icon override (from `icon`)
 * @property {string|null} colorStr - Custom CSS color override (from `color`)
 */

/**
 * Custom hook that uses Webpack's require.context to dynamically
 * parse and load markdown files from the notes/ directory at build time.
 * @returns {Array<ParsedNote>} A sorted array of parsed note objects containing frontmatter and routing data.
 */
function getAllNotesData() {
  const context = require.context(`@site/notes`, true, /index\.mdx?$|\.mdx?$/);

  return context
    .keys()
    .filter((path) => {
      if (path === "./index.md" || path === "./index.mdx") {
        return false;
      }
      const pathParts = path.split("/");
      const isTopLevelFile =
        pathParts.length === 2 && !path.match(/index\.mdx?$/);
      const isTopLevelDir =
        pathParts.length === 3 && path.match(/index\.mdx?$/);
      return isTopLevelFile || isTopLevelDir;
    })
    .map((path) => {
      const { frontMatter } = context(path);
      const { slug, fileSlug } = guessDocPermalink(path, frontMatter);

      const rawTitle = frontMatter.title || fileSlug;
      const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);

      return {
        title,
        slug,
        description: frontMatter.description || "",
        position: frontMatter.sidebar_position || 999,
        iconStr: frontMatter.icon || null,
        colorStr: frontMatter.color || null,
      };
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * Renders an individual note card with an icon, title, and optional tooltip.
 * @param {object} props - The component props
 * @param {ParsedNote} props.note - The parsed note object containing all metadata (title, language, slug, etc)
 * @param {number} props.index - The iteration index, used for staggered CSS animations
 * @param {string} props.docsBasePath - The base path for Docusaurus routes
 * @returns {JSX.Element} A single linked note card
 */
function NoteCard({ note, index, docsBasePath }) {
  const { title, slug, description, iconStr, colorStr } = note;
  const noteUrl = useBaseUrl(`${docsBasePath}/${slug}`);
  
  // Guess the icon key using the first segment of the slug
  const firstSlugSegment = slug.split('/')[0].toLowerCase();
  
  // Try exact match on the first segment
  let defaultIconData = iconMap[firstSlugSegment];
  
  // If no match and it contains hyphens/underscores, check individual sub words
  if (!defaultIconData && firstSlugSegment.match(/[-_]/)) {
    const subParts = firstSlugSegment.split(/[-_]/);
    for (const part of subParts) {
      if (iconMap[part]) {
        defaultIconData = iconMap[part];
        break;
      }
    }
  }

  // Fallback to the title (Exact Match)
  if (!defaultIconData) {
    const lowerTitle = title.toLowerCase();
    defaultIconData = iconMap[lowerTitle];
    
    // Ultimate fallback - default icon
    if (!defaultIconData) {
      defaultIconData = {};
    }
  }

  let Icon = defaultIconData.icon || FaBook;
  let color = colorStr || defaultIconData.color || "var(--ifm-color-primary)";

  let customIconElement = null;

  if (iconStr) {
    if (iconMap[iconStr.toLowerCase()]) {
      Icon = iconMap[iconStr.toLowerCase()].icon;
      if (!colorStr) {
        color = iconMap[iconStr.toLowerCase()].color;
      }
    } else if (iconStr.startsWith("/") || iconStr.startsWith("http")) {
      const imgSrc = iconStr.startsWith("/") ? useBaseUrl(iconStr) : iconStr;
      customIconElement = (
        <img src={imgSrc} className={styles.imgIcon} alt={`${title} icon`} />
      );
    } else if (iconStr.trim().startsWith("<svg")) {
      customIconElement = (
        <div
          className={styles.svgIcon}
          dangerouslySetInnerHTML={{ __html: iconStr }}
          aria-hidden="true"
        />
      );
    } else {
      customIconElement = <span className={styles.textIcon}>{iconStr}</span>;
    }
  }

  const tooltipContent = description ? description : null;

  const cardInner = (
    <Link
      to={noteUrl}
      className={styles.noteCard}
      style={{ "--card-index": index, "--note-color": color }}
      aria-label={`Read note: ${title}`}
    >
      <div className={styles.iconWrapper}>
        {customIconElement ? (
          customIconElement
        ) : (
          <Icon className={styles.noteIcon} />
        )}
      </div>
      <div className={styles.cardContent}>
        <h3 className={styles.noteTitle} title={title}>
          {title}
        </h3>
      </div>
      <FaChevronRight className={styles.mobileChevron} />
    </Link>
  );

  return tooltipContent ? (
    <Tooltip msg={tooltipContent} position="top" underline={false} gap={-8}>
      {cardInner}
    </Tooltip>
  ) : (
    cardInner
  );
}

/**
 * A responsive grid container that renders a collection of NoteCard components
 * based on the markdown files present in the notes/ directory.
 * @returns {JSX.Element|null} The NoteCards grid or null if no notes exist
 */
export default function NoteCards() {
  const notes = getAllNotesData();
  const { path: docsBasePath } = usePluginData(
    "docusaurus-plugin-content-docs",
  );

  if (!notes.length) {
    return null;
  }

  return (
    <div className={styles.notesGrid} role="list">
      {notes.map((note, index) => (
        <NoteCard
          key={note.slug}
          note={note}
          index={index}
          docsBasePath={docsBasePath}
        />
      ))}
    </div>
  );
}
