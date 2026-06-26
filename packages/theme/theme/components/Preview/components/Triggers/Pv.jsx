import React, { useEffect, useMemo } from "react";
import { useLocation } from "@docusaurus/router";
import { usePreview } from "../../state/index.jsx";
import Hint from "../../../Hint/index.jsx";
import {
  generatePvSlug,
  generatePvHash,
  parsePvHash,
  extractTextFromChildren,
  classify,
} from "../../utils";
import styles from "../../styles.module.css";

export function normalizeSources({
  href,
  children,
  desc,
  title,
  id,
  type: manualType,
}) {
  let rawSources = [];
  if (Array.isArray(href)) {
    rawSources = href.map((item) => {
      if (typeof item === "string") return { href: item.trim() };
      if (!item.href && item.path) return { ...item, href: item.path };
      return item;
    });
  } else if (href) {
    rawSources = [{ href: href.trim(), label: null, desc }];
  }

  return rawSources.map((src) => {
    const sPath = (src.href || "").trim();
    const sDesc = src.desc || "";
    const childrenText = extractTextFromChildren(children).trim();
    const label = src.label;
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

    if (src.type) type = src.type;
    else if (manualType) type = manualType;

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
      title: src.title || title || childrenText,
    };
  });
}

/**
 * @typedef {Object} PvSource
 * @property {string} href - The URL or path to preview
 * @property {string} [label] - The text label for the tab/source
 * @property {string} [desc] - Hint description
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
 * @param {string} [props.type] - Manual type to force the renderer (e.g. "video", "image").
 * @param {boolean} [props.popup] - Open in popup mode (default).
 * @param {boolean} [props.dock] - Open in dock mode.
 * @param {boolean} [props.pip] - Open in pip mode.
 * @param {boolean} [props.modeSwitch=true] - Whether the user can switch between popup/dock/pip modes inside the preview.
 * @param {boolean} [props.noUl] - Whether the trigger link should have NO underline style.
 * @param {string} [props.className] - CSS class to apply to the anchor tag.
 * @param {number} [props.activeIdx=0] - The index of the initially active tab when multiple hrefs are provided.
 */
export default function Pv(props) {
  const {
    children,
    id: manualId,
    activeIdx = 0,
    title,
    dock,
    pip,
    modeSwitch = true,
    noUl,
    className,
  } = props;

  let mode = "popup";

  if (dock) mode = "dock";
  else if (pip) mode = "pip";

  if (!props.href) {
    console.error("<Pv> component requires the 'href' prop.");
    return <span style={{ color: "red" }}>[Preview Error: Missing href]</span>;
  }

  const {
    isOpen,
    sources: activeSources,
    activeIndex,
    baseSlug: activeBaseSlug,
    openPreview,
    closePreview,
    setMode,
  } = usePreview();

  const location = useLocation();
  const srcList = useMemo(() => normalizeSources(props), [props, title]);

  const baseSlug = useMemo(() => {
    if (manualId) return generatePvSlug(manualId);
    if (title) return generatePvSlug(title);

    const childrenText = extractTextFromChildren(children).trim();
    if (childrenText) {
      return generatePvSlug(childrenText);
    }

    const pathOrHref =
      typeof props.href === "string" ? props.href : srcList[activeIdx]?.path;

    if (pathOrHref) {
      const filename = pathOrHref
        .split(/[?#]/)[0]
        .split("/")
        .filter(Boolean)
        .pop();
      if (filename) return generatePvSlug(filename);
    }

    return "preview";
  }, [manualId, title, props.href, srcList, activeIdx, children]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const parsed = parsePvHash(window.location.hash);
      if (parsed) {
        let isMatch = false;
        let targetIdx = activeIdx;

        if (parsed.slug === baseSlug) {
          isMatch = true;
          if (parsed.tabNum !== undefined) {
            const parsedIdx = parsed.tabNum - 1;
            if (
              !isNaN(parsedIdx) &&
              parsedIdx >= 0 &&
              parsedIdx < srcList.length
            ) {
              targetIdx = parsedIdx;
            }
          }
        }

        if (isMatch) {
          const hashMode = parsed.mode || mode;
          setMode(hashMode);
          openPreview(
            srcList,
            targetIdx,
            window.location.hash.substring(1),
            hashMode,
            baseSlug,
            modeSwitch,
          );
        }
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
    activeBaseSlug === baseSlug &&
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
        generatePvHash(baseSlug, mode, activeIdx),
        mode,
        baseSlug,
        modeSwitch,
      );
    }
  };

  const targetHash = generatePvHash(baseSlug, mode, activeIdx);

  const baseClassName = [
    className || styles.previewTrigger,
    isCurrentlyActive ? styles.activeTrigger : "",
    noUl ? styles.noUnderline : "",
  ]
    .filter(Boolean)
    .join(" ");

  const trigger = (
    <a
      href={`#${targetHash}`}
      className={baseClassName}
      onClick={(e) => {
        e.preventDefault();
        handleClick();
      }}
      title={srcList[activeIdx]?.tooltip || ""}
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
        <Hint msg={tooltipMsg} top noUl>
          {trigger}
        </Hint>
      ) : (
        trigger
      )}
    </span>
  );
}
