import React, { useEffect, useMemo } from "react";
import { useLocation } from "@docusaurus/router";
import { usePreview } from "../../state";
import Tooltip from "@site/src/components/Tooltip";
import { generatePvSlug, generatePvHash, parsePvHash } from "../../utils";
import styles from "../../styles.module.css";

// Helper to normalize boolean props (handles "true", "false", and shorthand)
export function isTrue(val) {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true";
  return !!val;
}

// Normalize props into a sources array
export function normalizeSources({ href, path, sources, children, desc }) {
  const rawSources =
    sources && sources.length > 0
      ? sources
      : href || path
        ? [{ path: (href || path).trim(), label: null, desc }]
        : [];

  return rawSources.map((src) => {
    const sPath = (src.path || src.href || "").trim();
    const sDesc = src.desc || "";

    // Extract text content from children (if single source)
    const childrenText = React.Children.toArray(children)
      .map((c) => (typeof c === "string" || typeof c === "number" ? c : ""))
      .join("")
      .trim();

    const label = src.label || childrenText;

    // Smart fallback for filename
    let urlLabel = "";
    let domain = "";
    let type = "Web";

    if (sPath) {
      const cleanPath = sPath.split(/[?#]/)[0].toLowerCase();
      if (cleanPath.endsWith(".pdf")) type = "PDF";
      else if (cleanPath.match(/\.(png|jpe?g|gif|svg|webp)$/)) type = "Image";
      else if (sPath.includes("youtube.com") || sPath.includes("youtu.be") || sPath.includes("vimeo.com"))
        type = "Video";

      try {
        if (sPath.startsWith("http") || sPath.startsWith("//")) {
          const url = new URL(sPath.startsWith("//") ? `https:${sPath}` : sPath);
          domain = url.hostname.replace("www.", "");
        }
      } catch (e) {}
      urlLabel = cleanPath.split("/").filter(Boolean).pop();
    }

    const source = domain || urlLabel || "Local";
    const displayLabel = label || source;

    let tooltip = sDesc;
    if (!tooltip) {
      tooltip = `${type}: ${source}`;
    }

    return {
      path: sPath,
      label: displayLabel,
      domain,
      type,
      source,
      tooltip,
      id: src.id,
    };
  });
}

/**
 * --- Inline trigger: <Pv href="..." id="...">link text</Pv> ---
 */
export default function Pv(props) {
  const { children, id: manualId, activeIdx = 0, sources: overrideSources } = props;
  const initialDocked = isTrue(props.docked);
  const {
    isOpen,
    isDocked,
    sources: activeSources,
    activeIndex,
    openPreview,
    closePreview,
    setDocked,
  } = usePreview();
  const location = useLocation();

  const srcList = useMemo(() => overrideSources || normalizeSources(props), [props, overrideSources]);

  // Unified Slug & Hash Generation
  const slug = useMemo(() => {
    if (manualId) return manualId;
    const label = typeof children === "string" ? children : null;
    return generatePvSlug(label, props.href || props.path || (srcList[activeIdx]?.path));
  }, [manualId, children, props.href, props.path, srcList, activeIdx]);

  // Deep Link Detection
  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parsePvHash(window.location.hash);
      if (parsed && parsed.slug === slug) {
        setDocked(parsed.isDocked || initialDocked);
        openPreview(srcList, activeIdx, generatePvHash(slug, parsed.isDocked));
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [location.hash, slug, srcList, openPreview, setDocked, initialDocked, activeIdx]);

  if (srcList.length === 0) return <span>{children}</span>;

  // Active detection (check if this specific source/index is the one being viewed)
  const isCurrentlyActive =
    isOpen &&
    activeSources.length === srcList.length &&
    activeSources[activeIdx]?.path === srcList[activeIdx]?.path &&
    activeIndex === activeIdx;

  const handleClick = () => {
    if (isCurrentlyActive) {
      closePreview();
    } else {
      const targetDocked = initialDocked || isDocked;
      setDocked(targetDocked);
      openPreview(srcList, activeIdx, generatePvHash(slug, targetDocked));
    }
  };

  const targetHash = generatePvHash(slug, initialDocked || isDocked);

  return (
    <span className={styles.previewContainer}>
      <Tooltip
        msg={srcList[activeIdx]?.tooltip || "Preview"}
        position="top"
        underline={false}
      >
        <a
          href={`#${targetHash}`}
          className={`${styles.previewTrigger} ${isCurrentlyActive ? styles.activeTrigger : ""}`}
          onClick={(e) => {
            e.preventDefault();
            handleClick();
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          {children || srcList[activeIdx]?.label}
        </a>
      </Tooltip>
    </span>
  );
}
