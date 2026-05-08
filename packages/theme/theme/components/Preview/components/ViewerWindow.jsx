import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { Rnd } from "react-rnd";
import { AnimatePresence, motion } from "framer-motion";
import { usePreview } from "../state/index.jsx";
import { classify, getExt, resolveUrl } from "../utils/index.jsx";
import { useFileFetch } from "../hooks/useFileFetch.jsx";
import { useDockLayout } from "../hooks/useDockLayout.jsx";
import { useDeepLinkHash } from "../hooks/useDeepLinkHash.jsx";
import { useAdaptiveSizing } from "../hooks/useAdaptiveSizing.jsx";
import { useTouchZoom } from "../hooks/useTouchZoom.jsx";
import PreviewHeader from "./PreviewHeader.jsx";
import FileTabs from "./FileTabs.jsx";
import PreviewContent from "./PreviewContent.jsx";
import styles from "../styles.module.css";

export default function PreviewViewer() {
  const {
    isOpen,
    mode,
    sources,
    activeIndex,
    baseSlug,
    dockWidth,
    peekHeight,
    modeSwitch,
    closePreview,
    toggleMode,
    setActiveIndex,
    setDockWidth,
    setPeekHeight,
    floatingState,
    setFloatingState,
  } = usePreview();

  const { siteConfig } = useDocusaurusContext();
  const customFields = siteConfig?.customFields;
  const corsProxyList = customFields?.corsProxyList || [];
  const location = useLocation();

  const [mounted, setMounted] = useState(typeof window !== "undefined");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true,
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? document.documentElement.clientWidth : 1200,
  );
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const popupBodyRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () =>
      setWindowWidth(document.documentElement.clientWidth);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("resize", handleResize);
    return () => {
      setMounted(false);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const layout = useAdaptiveSizing({
    mode,
    windowWidth,
    floatingState,
    dockWidth,
    peekHeight,
    setFloatingState,
  });
  const { isDockMode, showAsPeek, isPipMode, isPopupMode } = layout;

  useTouchZoom({ containerRef: popupBodyRef, isOpen, zoomLevel, setZoomLevel });
  useDockLayout({
    isOpen,
    isPopupMode,
    isSidebarDock: isDockMode,
    isPeekDock: showAsPeek,
    dockWidth,
    peekHeight,
  });
  useDeepLinkHash(isOpen, sources, activeIndex, mode, baseSlug);

  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) closePreview();
    }
  }, [location.pathname, isOpen, closePreview]);

  useEffect(() => {
    if (isOpen) setZoomLevel(1);
  }, [mode, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [isOpen, closePreview]);

  const currentFile = sources[activeIndex] ?? sources[0] ?? null;
  const fileType = currentFile ? classify(currentFile.url) : null;
  const ext = currentFile ? getExt(currentFile.url) : "";
  const fileUrl = currentFile ? resolveUrl(currentFile.url) : "";

  const {
    content: textContent,
    loading: textLoading,
    errors: fetchErrors,
    retry: retryFetch,
    setError,
  } = useFileFetch(currentFile?.url, fileType, isOpen);

  const handleDownload = useCallback(async () => {
    if (!fileUrl) return;
    setIsDownloading(true);
    try {
      const downloadName =
        currentFile.title || currentFile.url.split("/").pop() || "download";
      const triggerBlobDownload = async (url) => {
        const resp = await fetch(url, { mode: "cors", cache: "no-cache" });
        if (!resp.ok) throw new Error("Fetch failed");
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = downloadName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      };
      try {
        const bustUrl = fileUrl.includes("?")
          ? `${fileUrl}&cb=${Date.now()}`
          : `${fileUrl}?cb=${Date.now()}`;
        await triggerBlobDownload(bustUrl);
      } catch (e1) {
        let proxySuccess = false;
        for (const proxyBaseUrl of corsProxyList) {
          try {
            const proxyUrl = `${proxyBaseUrl}${encodeURIComponent(fileUrl)}`;
            await triggerBlobDownload(proxyUrl);
            proxySuccess = true;
            break;
          } catch (pE) {}
        }
        if (!proxySuccess) {
          const link = document.createElement("a");
          link.href = fileUrl;
          link.target = "_blank";
          link.setAttribute("download", downloadName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } finally {
      setIsDownloading(false);
    }
  }, [fileUrl, currentFile, corsProxyList]);

  if (!mounted || !currentFile) return null;

  const displayTitle =
    currentFile.title ||
    (fileType === "web"
      ? currentFile.url.replace(/^https?:\/\//, "").split("/")[0]
      : currentFile.url.split("/").pop() || "File");

  const header = (
    <div className={styles.headerWrapper}>
      {showAsPeek && <div className={styles.peekHandle} />}
      <PreviewHeader
        displayTitle={displayTitle}
        fileType={fileType}
        fileUrl={fileUrl}
        mode={mode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        onToggleMode={toggleMode}
        onClose={closePreview}
        onDownload={handleDownload}
        isDownloading={isDownloading}
        modeSwitch={modeSwitch}
      />
    </div>
  );

  const innerContent = (
    <div className={styles.windowContent}>
      <FileTabs
        sources={sources}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />
      <div
        className={`${styles.popupBody} ${fileType === "code" ? styles.isText : styles.isGrabbable}`}
        ref={(el) => {
          popupBodyRef.current = el;
          if (el && isOpen) el.focus({ preventScroll: true });
        }}
        tabIndex={-1}
      >
        <PreviewContent
          currentFile={currentFile}
          fileType={fileType}
          fileUrl={fileUrl}
          isOnline={isOnline}
          fetchErrors={fetchErrors}
          textLoading={textLoading}
          textContent={textContent}
          zoomLevel={zoomLevel}
          ext={ext}
          retryFetch={retryFetch}
          setError={setError}
        />
      </div>
    </div>
  );

  const rndEnableResizing = isDockMode
    ? { left: true }
    : showAsPeek
      ? { top: true }
      : true;
  const rndResizeHandleStyles = showAsPeek
    ? {
        top: {
          height: "24px",
          top: "-12px",
          cursor: "row-resize",
          zIndex: 100,
        },
      }
    : isDockMode
      ? { left: { width: "20px", left: "-10px" } }
      : isPipMode
        ? {
            bottom: { height: "20px", bottom: "-10px" },
            right: { width: "20px", right: "-10px" },
            left: { width: "20px", left: "-10px" },
            top: { height: "20px", top: "-10px" },
            bottomRight: {
              width: "30px",
              height: "30px",
              bottom: "-15px",
              right: "-15px",
            },
            bottomLeft: {
              width: "30px",
              height: "30px",
              bottom: "-15px",
              left: "-15px",
            },
            topRight: {
              width: "30px",
              height: "30px",
              top: "-15px",
              right: "-15px",
            },
            topLeft: {
              width: "30px",
              height: "30px",
              top: "-15px",
              left: "-15px",
            },
          }
        : {};

  const rndMinWidth = isDockMode ? 380 : showAsPeek ? windowWidth : 380;
  const rndMinHeight = showAsPeek ? 150 : isDockMode ? undefined : 60;
  const rndMaxWidth = isDockMode
    ? windowWidth * 0.8
    : showAsPeek
      ? windowWidth
      : undefined;
  const rndMaxHeight = showAsPeek ? layout.vh * 0.85 : undefined;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="pv-viewer"
          data-mode={mode}
          className={`${styles.previewSystem} ${showAsPeek ? styles.modePeek : ""} ${isDockMode ? styles.modeDock : ""} ${isPipMode ? styles.modePip : ""} ${isPopupMode ? styles.modePopup : ""}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onWheel={(e) => e.stopPropagation()}
        >
          {isPopupMode && (
            <div className={styles.previewBackdrop} onClick={closePreview} />
          )}

          {isPopupMode ? (
            <motion.div
              key="desktop-popup"
              className={styles.windowFrame}
              initial={{ opacity: 0, scale: 0.9, y: "-45%", x: "-50%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
              exit={{ opacity: 0, scale: 0.9, y: "-45%", x: "-50%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.dragHandleWrapper}>{header}</div>
              {innerContent}
            </motion.div>
          ) : (
            <Rnd
              key={`${mode}-${showAsPeek}`}
              position={layout.rndPosition}
              size={layout.rndSize}
              disableDragging={isDockMode || showAsPeek}
              enableResizing={rndEnableResizing}
              dragHandleClassName={styles.dragHandleWrapper}
              minWidth={rndMinWidth}
              minHeight={rndMinHeight}
              maxWidth={rndMaxWidth}
              maxHeight={rndMaxHeight}
              bounds={layout.rndBounds}
              resizeHandleStyles={rndResizeHandleStyles}
              onDragStart={() => setIsInteracting(true)}
              onDragStop={(_e, d) => {
                setIsInteracting(false);
                if (!isDockMode && !showAsPeek)
                  setFloatingState({ x: d.x, y: d.y });
              }}
              onResizeStart={() => setIsInteracting(true)}
              onResizeStop={(_e, _direction, ref, _delta, position) => {
                setIsInteracting(false);
                const newWidth = parseInt(ref.style.width, 10);
                const newHeight = parseInt(ref.style.height, 10);
                if (isDockMode) setDockWidth(newWidth);
                else if (showAsPeek) setPeekHeight(newHeight);
                else
                  setFloatingState({
                    width: newWidth,
                    height: newHeight,
                    ...position,
                  });
              }}
              className={styles.rndWrapper}
              style={{
                zIndex: 10,
                transition: isInteracting
                  ? "none"
                  : "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              <div
                className={`${styles.windowFrame} ${isInteracting ? styles.windowInteracting : ""}`}
                style={{ width: "100%", height: "100%", position: "relative" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.dragHandleWrapper}>{header}</div>
                {innerContent}
              </div>
            </Rnd>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
