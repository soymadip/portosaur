import { useEffect, useState } from "react";
import FooterOriginal from "@theme-init/DocItem/Footer";
import { createPortal } from "react-dom";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import Pv from "../../components/Preview/components/Triggers/Pv.jsx";
import styles from "./styles.module.css";

export default function FooterWrapper(props) {
  const { frontMatter } = useDoc();
  const sourceRaw = frontMatter?.source;
  const [targetNode, setTargetNode] = useState(null);

  useEffect(() => {
    // Find the row containing the "Edit this page" button
    const row = document.querySelector(".theme-doc-footer-edit-meta-row");
    if (row) {
      // Ensure it has relative positioning so we can place our button on the right
      row.style.position = "relative";
      setTargetNode(row);
    }
  }, [sourceRaw]);

  return (
    <>
      <FooterOriginal {...props} />
      {sourceRaw &&
        targetNode &&
        createPortal(
          <div
            style={{
              position: "absolute",
              right: "var(--ifm-spacing-horizontal, 1rem)",
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <Pv href={sourceRaw} activeIdx={0} noUl>
              <div className={styles.footerSourceBtn}>
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: "6px", transform: "translateY(1.5px)" }}
                >
                  <polyline points="16 18 22 12 16 6"></polyline>
                  <polyline points="8 6 2 12 8 18"></polyline>
                </svg>
                {Array.isArray(sourceRaw) && sourceRaw.length > 1
                  ? "View Sources"
                  : "View Source"}
              </div>
            </Pv>
          </div>,
          targetNode,
        )}
    </>
  );
}
