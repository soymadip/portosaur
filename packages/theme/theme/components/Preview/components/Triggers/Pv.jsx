import React, { useEffect, useMemo } from "react";
import { useLocation } from "@docusaurus/router";
import { usePreview } from "../../state/index.jsx";
import Tooltip from "../../../Tooltip/index.jsx";
import {
  generatePvSlug,
  generatePvHash,
  parsePvHash,
  classify,
} from "../../utils";
import styles from "../../styles.module.css";

export function normalizeSources({
  href,
  children,
  desc,
  title,
  id,
}) {
  let rawSources = [];
  if (Array.isArray(href)) {
    rawSources = href.map(item => {
      if (typeof item === 'string') return { href: item.trim() };
      return item;
    });
  } else if (href) {
    rawSources = [{ href: href.trim(), label: null, desc }];
  }

  return rawSources.map((src) => {
    const sPath = (src.href || "").trim();
    const sDesc = src.desc || "";
    const childrenText = React.Children.toArray(children)
      .map((c) => (typeof c === "string" || typeof c === "number" ? c : ""))
      .join("")
      .trim();
    const label = src.label || childrenText;
    let urlLabel = "";
    let domain = "";
    let type = "text";

    if (sPath) {
      type = classify(sPath);
      const cleanPath = sPath.split(/[?#]/)[0].toLowerCase();
      urlLabel = cleanPath.split("/").filter(Boolean).pop();
      try {
        if (sPath.startsWith("http") || sPath.startsWith("//")) {
          const url = new URL(
            sPath.startsWith("//") ? `https:${sPath}` : sPath,
          );
          domain = url.hostname.replace("www.", "");
        }
      } catch (e) {}
    }

    const source = domain || urlLabel || "Local";
    const displayLabel = label || source;
    const tooltip = sDesc || null;

    return {
      path: sPath,
      url: sPath,
      label: displayLabel,
      domain,
      type,
      source,
      tooltip,
      id: src.id || id,
      title: src.title || title,
    };
  });
}

/**
 * @typedef {Object} PvSource
 * @property {string} href - The URL or path to preview
 * @property {string} [label] - The text label for the tab/source
 * @property {string} [desc] - Tooltip description
 * @property {string} [title] - Custom title for the preview window
 * @property {string} [id] - Manual ID for generating the URL hash
 */

/**
 * A trigger component that opens the global file preview window.
 * 
 * @param {Object} props
 * @param {string|PvSource|Array<string|PvSource>} props.href - The URL/path(s) to preview. Can be a single string, or an array for multi-tab preview.
 * @param {React.ReactNode} [props.children] - The clickable trigger content. Defaults to the filename if not provided.
 * @param {string} [props.title] - Custom title for the preview window header.
 * @param {string} [props.id] - Manual ID to generate the URL hash.
 * @param {"popup"|"dock"|"pip"} [props.mode="popup"] - The default display mode to open in.
 * @param {boolean} [props.modeSwitch=true] - Whether the user can switch between popup/dock/pip modes inside the preview.
 * @param {boolean} [props.underline=true] - Whether the trigger link should have an underline style.
 * @param {number} [props.activeIdx=0] - The index of the initially active tab when multiple hrefs are provided.
 */
export default function Pv(props) {
  const {
    children,
    id: manualId,
    activeIdx = 0,
    title,
    mode = "popup",
    modeSwitch = true,
    underline = true,
  } = props;

  if (!props.href) {
    console.error("<Pv> component requires the 'href' prop.");
    return <span style={{ color: "red" }}>[Preview Error: Missing href]</span>;
  }

  const {
    isOpen,
    mode: currentMode,
    sources: activeSources,
    activeIndex,
    openPreview,
    closePreview,
    setMode,
  } = usePreview();

  const location = useLocation();
  const srcList = useMemo(
    () => normalizeSources(props),
    [props, title],
  );

  const baseSlug = useMemo(() => {
    if (manualId) return generatePvSlug(manualId);
    if (title) return generatePvSlug(title);
    const pathOrHref = typeof props.href === "string" ? props.href : srcList[activeIdx]?.path;
    if (pathOrHref) {
      const filename = pathOrHref
        .split(/[?#]/)[0]
        .split("/")
        .filter(Boolean)
        .pop();
      if (filename) return generatePvSlug(filename);
    }
    const childrenText = typeof children === "string" ? children.trim() : null;
    if (childrenText) return generatePvSlug(childrenText);
    return "preview";
  }, [manualId, title, props.href, srcList, activeIdx, children]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parsePvHash(window.location.hash);
      if (parsed && parsed.slug === baseSlug) {
        const hashMode = parsed.mode || mode;
        setMode(hashMode);
        openPreview(
          srcList,
          activeIdx,
          generatePvHash(baseSlug, hashMode),
          hashMode,
          baseSlug,
          modeSwitch,
        );
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [
    location.hash,
    baseSlug,
    srcList,
    openPreview,
    setMode,
    mode,
    activeIdx,
    modeSwitch,
  ]);

  if (srcList.length === 0) {
    return <span>{children}</span>;
  }

  const isCurrentlyActive =
    isOpen &&
    activeSources.length === srcList.length &&
    activeSources[activeIdx]?.path === srcList[activeIdx]?.path &&
    activeIndex === activeIdx;

  const handleClick = () => {
    if (isCurrentlyActive) {
      closePreview();
    } else {
      setMode(mode);
      openPreview(
        srcList,
        activeIdx,
        generatePvHash(baseSlug, mode),
        mode,
        baseSlug,
        modeSwitch,
      );
    }
  };

  const targetHash = generatePvHash(baseSlug, mode);

  const trigger = (
    <a
      href={`#${targetHash}`}
      className={`${styles.previewTrigger} ${isCurrentlyActive ? styles.activeTrigger : ""} ${!underline ? styles.noUnderline : ""}`}
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
  );

  const hasTooltip = !!srcList[activeIdx]?.tooltip;
  const tooltipMsg = srcList[activeIdx]?.tooltip;

  return (
    <span className={styles.previewContainer}>
      {hasTooltip && tooltipMsg ? (
        <Tooltip msg={tooltipMsg} position="top" underline={false}>
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
    </span>
  );
}
