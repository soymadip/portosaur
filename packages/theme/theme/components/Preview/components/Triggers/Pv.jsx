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
  path,
  sources,
  children,
  desc,
  title,
  id,
}) {
  const rawSources =
    sources && sources.length > 0
      ? sources
      : href || path
        ? [{ path: (href || path).trim(), label: null, desc }]
        : [];

  return rawSources.map((src) => {
    const sPath = (src.path || src.href || "").trim();
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

export default function Pv(props) {
  const {
    children,
    id: manualId,
    activeIdx = 0,
    sources: overrideSources,
    title,
    mode = "popup",
    modeSwitch = true,
    underline = true,
  } = props;

  const hasSingleSource = !!(props.href || props.path);
  const hasMultiSource = !!(overrideSources && overrideSources.length > 0);

  if (!hasSingleSource && !hasMultiSource) {
    console.error(
      "<Pv> component requires either 'href', 'path', or 'sources' prop.",
    );
    return <span style={{ color: "red" }}>[Preview Error: Missing href]</span>;
  }

  if (hasSingleSource && hasMultiSource) {
    console.error(
      "<Pv> component cannot accept both 'href' and 'sources'. Choose one.",
    );
    return <span style={{ color: "red" }}>[Preview Error: Conflict]</span>;
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
    () => overrideSources || normalizeSources(props),
    [props, overrideSources, title],
  );

  const baseSlug = useMemo(() => {
    if (manualId) return generatePvSlug(manualId);
    if (title) return generatePvSlug(title);
    const pathOrHref = props.href || props.path || srcList[activeIdx]?.path;
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
  }, [manualId, title, props.href, props.path, srcList, activeIdx, children]);

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
