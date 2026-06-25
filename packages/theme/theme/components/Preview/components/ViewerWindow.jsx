import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { Rnd } from "react-rnd";
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
    setMode,
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
  // pvMounted: portal is in the DOM. pvVisible: CSS fade-in/out class is active.
  const [pvMounted, setPvMounted] = useState(false);
  const [pvVisible, setPvVisible] = useState(false);
  const closeTimerRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true,
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? document.documentElement.clientWidth : 1200,
  );
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? document.documentElement.clientHeight : 800,
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const popupBodyRef = useRef(null);

  const [portalRoot, setPortalRoot] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    let root = document.getElementById("pv-portal-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "pv-portal-root";
      // display: contents ensures this wrapper is ignored for layout, 
      // making the sticky previewSystem act as a direct child of the body.
      root.style.display = "contents";
      // Prepend to body so it sits at the very top of the document flow,
      // allowing position: sticky to work correctly and bounce with rubber-banding!
      document.body.prepend(root);
    }
    setPortalRoot(root);
  }, []);

  useEffect(() => {
    setMounted(true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleResize = () => {
      setWindowWidth(document.documentElement.clientWidth);
      setWindowHeight(document.documentElement.clientHeight);
    };
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
    windowHeight,
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
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    if (isOpen) {
      setPvMounted(true);
    } else {
      setPvVisible(false);
      closeTimerRef.current = setTimeout(() => setPvMounted(false), 250);
    }
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [isOpen]);

  // Trigger the CSS transition only after the DOM has been fully mounted and painted
  useEffect(() => {
    if (pvMounted && isOpen) {
      // A small timeout ensures React has finished the commit phase and the browser has painted
      const timer = setTimeout(() => {
        setPvVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [pvMounted, isOpen]);

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

  // --- Peek resize via custom pointer tracking (not Rnd) ---
  const peekDragStartY = useRef(null);
  const peekStartHeight = useRef(null);

  const handlePeekPointerDown = useCallback((e) => {
    if (!showAsPeek) return;
    e.preventDefault();
    peekDragStartY.current = e.clientY;
    peekStartHeight.current = peekHeight;
    document.body.classList.add("pv-resizing");

    const handlePointerMove = (moveEvent) => {
      const deltaY = moveEvent.clientY - peekDragStartY.current;
      const newHeight = peekStartHeight.current - deltaY;
      const clampedHeight = Math.max(150, Math.min(newHeight, layout.vh * 0.85));
      document.body.style.setProperty("--mobile-peek-height", `${clampedHeight}px`);
      setPeekHeight(clampedHeight);
    };

    const handlePointerUp = () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("pv-resizing");
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [showAsPeek, peekHeight, layout.vh, setPeekHeight]);

  if (!mounted || !currentFile) return null;

  const displayTitle =
    currentFile.title ||
    (fileType === "web"
      ? currentFile.url.replace(/^https?:\/\//, "").split("/")[0]
      : currentFile.url.split("/").pop() || "File");

  // --- Rnd configuration per mode ---

  const rndEnableResizing = isPopupMode
    ? false
    : isDockMode
      ? { left: true }
      : showAsPeek
        ? false // Peek uses custom pointer events, not Rnd resize
        : true;

  const rndResizeHandles = isDockMode
    ? { left: { width: "20px", left: "-10px" } }
    : isPipMode
      ? {
          bottom: { height: "20px", bottom: "-10px" },
          right: { width: "20px", right: "-10px" },
          left: { width: "20px", left: "-10px" },
          top: { height: "20px", top: "-10px" },
          bottomRight: { width: "30px", height: "30px", bottom: "-15px", right: "-15px" },
          bottomLeft: { width: "30px", height: "30px", bottom: "-15px", left: "-15px" },
          topRight: { width: "30px", height: "30px", top: "-15px", right: "-15px" },
          topLeft: { width: "30px", height: "30px", top: "-15px", left: "-15px" },
        }
      : {};

  const rndMinWidth = isDockMode ? 380 : showAsPeek ? windowWidth : 280;
  const rndMinHeight = showAsPeek ? 150 : isDockMode ? undefined : 60;
  const rndMaxWidth = isDockMode ? windowWidth * 0.8 : windowWidth;
  const rndMaxHeight = layout.vh;

  if (!pvMounted || !portalRoot) return null;

  return createPortal(
    <React.Fragment>
      {isPopupMode && (
        <div
          className={`${styles.previewBackdrop} ${pvVisible ? styles.pvVisible : ""}`}
          onClick={closePreview}
          style={{ position: "fixed", zIndex: 1999, inset: 0 }}
        />
      )}
      <div
        id="pv-viewer"
        data-mode={mode}
        className={`${styles.previewSystem} ${showAsPeek ? styles.modePeek : ""} ${isDockMode ? styles.modeDock : ""} ${isPipMode ? styles.modePip : ""} ${isPopupMode ? styles.modePopup : ""} ${pvVisible ? styles.pvVisible : ""}`}
        onWheel={(e) => e.stopPropagation()}
      >
        <Rnd
          position={layout.rndPosition}
          size={layout.rndSize}
          disableDragging={isDockMode || showAsPeek || isPopupMode}
          enableResizing={rndEnableResizing}
          dragHandleClassName={styles.pipGripStrip}
          minWidth={rndMinWidth}
          minHeight={rndMinHeight}
          maxWidth={rndMaxWidth}
          maxHeight={rndMaxHeight}
          bounds={layout.rndBounds}
          resizeHandleStyles={rndResizeHandles}
          onDragStop={(_e, d) => {
            if (!isDockMode && !showAsPeek && !isPopupMode) {
              setFloatingState({ x: d.x, y: d.y });
            }
          }}
          onResizeStart={() => {
            document.body.classList.add("pv-resizing");
          }}
          onResize={(_e, _dir, ref, _delta, position) => {
            if (isDockMode) {
              const newWidth = parseInt(ref.style.width, 10);
              document.body.style.setProperty("--pv-dock-width", `${newWidth}px`);
            } else if (isPipMode) {
              setFloatingState({
                width: parseInt(ref.style.width, 10),
                height: parseInt(ref.style.height, 10),
                ...position,
              });
            }
          }}
          onResizeStop={(_e, _dir, ref, _delta, position) => {
            document.body.classList.remove("pv-resizing");
            const newWidth = parseInt(ref.style.width, 10);
            const newHeight = parseInt(ref.style.height, 10);
            if (isDockMode) {
              setDockWidth(newWidth);
            } else if (!isPopupMode && !showAsPeek) {
              setFloatingState({ width: newWidth, height: newHeight, ...position });
            }
          }}
          className={styles.rndWrapper}
          style={{ zIndex: 10 }}
        >
          <div
            className={styles.windowFrame}
            style={{ width: "100%", height: "100%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* PiP drag grip: invisible strip at top, ABOVE the header.
                Only this element triggers Rnd dragging, so header buttons stay clickable. */}
            {isPipMode && <div className={styles.pipGripStrip} />}

            {/* Peek drag pill: visible handle above header for mobile resize. */}
            {showAsPeek && (
              <div
                className={styles.peekHandle}
                onPointerDown={handlePeekPointerDown}
              />
            )}

            {/* Header: NOT the Rnd drag handle, so all buttons respond to clicks. */}
            <div className={styles.headerWrapper}>
              <PreviewHeader
                displayTitle={displayTitle}
                fileType={fileType}
                fileUrl={fileUrl}
                mode={mode}
                zoomLevel={zoomLevel}
                onZoomChange={setZoomLevel}
                onChangeMode={setMode}
                onClose={closePreview}
                onDownload={handleDownload}
                isDownloading={isDownloading}
                modeSwitch={modeSwitch}
              />
            </div>

            {/* Main content: file tabs and preview body */}
            <div className={styles.windowContent}>
              <FileTabs
                sources={sources}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
              />
              <div
                className={`${styles.popupBody} ${fileType === "text" ? styles.isText : fileType === "image" || fileType === "pdf" ? styles.isGrabbable : ""}`}
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
          </div>
        </Rnd>
      </div>
    </React.Fragment>,
    portalRoot,
  );
}

