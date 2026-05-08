import useBaseUrl from "@docusaurus/useBaseUrl";
import { usePluginData } from "@docusaurus/useGlobalData";
import Link from "@docusaurus/Link";
import { FaBook, FaChevronRight } from "react-icons/fa";
import Tooltip from "../Tooltip/index.jsx";
import { iconMap } from "../../config/iconMappings.jsx";
import DocCardList from "@theme/DocCardList";
import styles from "./styles.module.css";

function useNotes() {
  const context = require.context(`@site/notes`, true, /index\.mdx?$|\.mdx?$/);
  return context
    .keys()
    .filter((path) => {
      if (path === "./index.md" || path === "./index.mdx") return false;
      const pathParts = path.split("/");
      const isTopLevelFile =
        pathParts.length === 2 && !path.match(/index\.mdx?$/);
      const isTopLevelDir =
        pathParts.length === 3 && path.match(/index\.mdx?$/);
      return isTopLevelFile || isTopLevelDir;
    })
    .map((path) => {
      const { frontMatter } = context(path);
      const pathParts = path.split("/");
      const isTopLevelFile = pathParts.length === 2;
      const fileSlug = isTopLevelFile
        ? path.replace("./", "").replace(/\.mdx?$/, "")
        : pathParts[1];
      const slug = frontMatter.slug || frontMatter.id || fileSlug;
      const rawTitle = frontMatter.title || frontMatter.language || fileSlug;
      const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
      const language = frontMatter.language
        ? frontMatter.language
            .toLowerCase()
            .replace(/ /g, "")
            .replace(/[\s-]/g, "")
        : slug.toLowerCase() || title.toLowerCase();
      return {
        title,
        language,
        slug,
        desc: frontMatter.desc || "",
        position: frontMatter.sidebar_position || 999,
      };
    })
    .sort((a, b) => a.position - b.position);
}

function NoteCard({ title, language, slug, desc, index, docsBasePath }) {
  const noteUrl = useBaseUrl(`${docsBasePath}/${slug}`);
  const { icon: Icon = FaBook, color = "var(--ifm-color-primary)" } =
    iconMap[language] || iconMap[title.toLowerCase()] || {};
  const tooltipContent = desc ? desc : null;

  const cardInner = (
    <Link
      to={noteUrl}
      className={styles.noteCard}
      style={{ "--card-index": index, "--note-color": color }}
      aria-label={`Read note: ${title}`}
    >
      <div className={styles.iconWrapper}>
        <Icon className={styles.noteIcon} />
      </div>
      <div className={styles.cardContent}>
        <h3 className={styles.noteTitle}>{title}</h3>
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

export default function NoteCards() {
  const notes = useNotes();
  const { path: docsBasePath } = usePluginData(
    "docusaurus-plugin-content-docs",
  );

  if (!notes.length) return null;

  return (
    <div className={styles.notesGrid} role="list">
      {notes.map((note, index) => (
        <NoteCard
          key={note.slug}
          {...note}
          index={index}
          docsBasePath={docsBasePath}
        />
      ))}
    </div>
  );
}

export function TopicList({
  desc = "Click on the links below to explore the topics.",
  style = { marginTop: "-2.5rem", marginBottom: "2.5rem", textAlign: "center" },
}) {
  return (
    <div style={style}>
      <p dangerouslySetInnerHTML={{ __html: desc }} />
      <DocCardList />
    </div>
  );
}
