import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Link from "@docusaurus/Link";
import Pv from "../Preview/components/Triggers/Pv.jsx";
import Icon from "../Icon/index.jsx";
import Hint from "../Hint/index.jsx";
import clsx from "clsx";
import CopyDropdown from "./CopyDropdown.jsx";
import styles from "./styles.module.css";

export default function PageActions({ className, mobile = false }) {
  const { frontMatter, metadata } = useDoc();
  const sourceRaw = frontMatter?.source;
  const editUrl = metadata?.editUrl;

  if (mobile) {
    return (
      <div className={clsx(styles.container, className)}>
        <CopyDropdown mobile editUrl={editUrl} sourceRaw={sourceRaw} />
      </div>
    );
  }

  return (
    <div className={clsx(styles.container, className)}>
      {editUrl && (
        <Hint msg="Edit this page" noUl hideOnClick>
          <Link
            to={editUrl}
            className={styles.actionBtn}
            aria-label="Edit this page"
          >
            <Icon id="lucide:pencil" className={styles.iconOnly} />
          </Link>
        </Hint>
      )}

      <CopyDropdown />

      {sourceRaw && (
        <Hint
          msg={
            Array.isArray(sourceRaw) && sourceRaw.length > 1
              ? "View Sources"
              : "View Source"
          }
          noUl
        >
          <Pv href={sourceRaw} activeIdx={0} noUl>
            <div className={styles.actionBtn}>
              <Icon id="lucide:code-xml" className={styles.iconOnly} />
            </div>
          </Pv>
        </Hint>
      )}
    </div>
  );
}
