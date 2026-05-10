import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { Rnd } from "react-rnd";
import { AnimatePresence, motion } from "framer-motion";

import { usePreview } from "../state";
import { classify, getExt, resolveUrl } from "../utils";
import { useFileFetch } from "../hooks/useFileFetch";
import { useDockLayout } from "../hooks/useDockLayout";
import { useDeepLinkHash } from "../hooks/useDeepLinkHash";

import PreviewHeader from "./PreviewHeader";
import FileTabs from "./FileTabs";
import { LoadingState, ErrorState, OfflineState } from "./FeedbackStates";

import ImageRenderer from "../renderers/ImageRenderer";
import PdfRenderer from "../renderers/PdfRenderer";
import CodeRenderer from "../renderers/CodeRenderer";
import WebRenderer from "../renderers/WebRenderer";

import styles from "../styles.module.css";

/**
 * The main Preview Viewer — orchestrates layout modes (floating, docked, mobile peek)
 * using react-rnd for window management and framer-motion for animations.
 */
export default function PreviewViewer() {
  const {
    isOpen,
    isDocked,
    sources,
    activeIndex,
    dockWidth,
    closePreview,
    setDocked,
    setActiveIndex,
    setDockWidth,
    floatingState,
    setFloatingState,
  } = usePreview();

  const { siteConfig } = useDocusaurusContext();
  const corsProxyList = siteConfig?.customFields?.corsProxyList || [];

  const location = useLocation();
  const [mounted, setMounted] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true,
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  const [isInteracting, setIsInteracting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const tabRefs = useRef([]);

  // --- Mount and Resize Listeners ---
  useEffect(() => {
    setMounted(true);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    const handleResize = () => {
      const newWidth = window.innerWidth;
      // If docked, adjust dockWidth to maintain roughly the same ratio
      if (isDocked && windowWidth > 0) {
        const ratio = dockWidth / windowWidth;
        const targetWidth = Math.floor(newWidth * ratio);
        // Clamp between 380px and 80% of window
        setDockWidth(Math.max(380, Math.min(targetWidth, newWidth * 0.8)));
      }
      setWindowWidth(newWidth);
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
  }, [isDocked, dockWidth, windowWidth, setDockWidth]);

  // --- Auto-close on route change ---
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) closePreview();
    }
  }, [location.pathname, isOpen, closePreview]);

  // --- Derived state ---
  const currentFile = sources[activeIndex] ?? sources[0] ?? null;
  const fileType = currentFile ? classify(currentFile.path) : null;
  const ext = currentFile ? getExt(currentFile.path) : "";
  const fileUrl = currentFile ? resolveUrl(currentFile.path) : "";

  // --- Hooks ---
  const {
    content: textContent,
    loading: textLoading,
    error: fetchError,
    errors: fetchErrors,
    retry: retryFetch,
    setError,
  } = useFileFetch(currentFile?.path, fileType, isOpen);

  useDockLayout(isOpen, isDocked, dockWidth);
  useDeepLinkHash(isOpen, sources, activeIndex, tabRefs, isDocked);

  // --- Escape key to close floating window ---
  useEffect(() => {
    if (!isOpen || isDocked) return;
    const handler = (e) => {
      if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isDocked, closePreview]);

  // Reset zoom when switching modes
  useEffect(() => {
    if (isOpen) setZoomLevel(1.0);
  }, [isDocked, isOpen]);

  // --- Download handler ---
  // --- Download handler ---
  const handleDownload = useCallback(async () => {
    if (!fileUrl) return;
    setIsDownloading(true);

    try {
      const downloadName =
        currentFile.label || currentFile.path.split("/").pop();

      const triggerBlobDownload = async (url) => {
        const resp = await fetch(url, {
          mode: "cors",
          cache: "no-cache", // Ensure we don't get a tainted cache version
        });
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
        // 1. Try standard CORS fetch with cache busting
        const bustUrl = fileUrl.includes("?")
          ? `${fileUrl}&cb=${Date.now()}`
          : `${fileUrl}?cb=${Date.now()}`;
        await triggerBlobDownload(bustUrl);
        return;
      } catch (e1) {
        console.warn("Standard download failed, trying proxies...", e1);

        let proxySuccess = false;

        // Iterate through our fallback proxy array
        for (const proxyBaseUrl of corsProxyList) {
          try {
            console.warn(`Trying proxy: ${proxyBaseUrl}`);
            const proxyUrl = `${proxyBaseUrl}${encodeURIComponent(fileUrl)}`;
            await triggerBlobDownload(proxyUrl);
            proxySuccess = true;
            break; // Success! Exit the loop.
          } catch (proxyError) {
            console.warn(`Proxy ${proxyBaseUrl} failed:`, proxyError);
            // Continue loop to try the next proxy
          }
        }

        if (!proxySuccess) {
          // Absolute Fallback: direct link redirect
          console.warn(
            "All proxy downloads failed, falling back to direct link",
          );

          alert(
            "This file is heavily protected by browser security (CORS) and cannot be downloaded directly. It will be opened in a new tab instead.",
          );

          const link = document.createElement("a");
          link.href = fileUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.setAttribute("download", downloadName);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } finally {
      setIsDownloading(false);
    }
  }, [fileUrl, currentFile]);

  // --- Guard ---
  if (!mounted || !currentFile) return null;

  // --- Display title ---
  const displayTitle =
    fileType === "web"
      ? currentFile.path.replace(/^https?:\/\//, "").split("/")[0]
      : currentFile.label || currentFile.path.split("/").pop();

  // --- Content Router ---
  const renderContent = () => {
    const path = currentFile?.path;
    const isExternal = path?.startsWith("http") || path?.startsWith("//");

    // Offline guard for external resources
    if (!isOnline && isExternal) {
      return <OfflineState onRetry={retryFetch} />;
    }

    // Error state
    const errorMsg = fetchErrors?.[path];
    if (errorMsg) {
      return (
        <ErrorState
          path={path}
          message={errorMsg}
          fileType={fileType}
          fileUrl={fileUrl}
          onRetry={retryFetch}
        />
      );
    }

    // Loading state (for text files only — renderers handle their own loading)
    if (textLoading && fileType === "text") {
      return <LoadingState />;
    }

    switch (fileType) {
      case "image":
        return (
          <ImageRenderer
            key={fileUrl}
            fileUrl={fileUrl}
            label={currentFile.label}
            zoomLevel={zoomLevel}
            onError={(msg) => setError(path, msg)}
          />
        );
      case "pdf":
        return (
          <PdfRenderer
            key={fileUrl}
            fileUrl={fileUrl}
            zoomLevel={zoomLevel}
            onError={(msg) => setError(path, msg)}
          />
        );
      case "web":
        return (
          <WebRenderer
            key={fileUrl}
            fileUrl={fileUrl}
            label={currentFile.label}
            onError={(msg) => setError(path, msg)}
          />
        );
      default: {
        // Text / code
        if (!textContent) return <LoadingState />;
        return <CodeRenderer code={textContent} language={ext} />;
      }
    }
  };

  // --- Layout calculations ---
  const isMobile = windowWidth <= 768;
  const showAsDock = !isMobile && isDocked;
  const showAsFloating = !isMobile && !isDocked;
  const showAsPeek = isMobile && isDocked;

  // --- Header (shared across all modes) ---
  const header = (
    <PreviewHeader
      displayTitle={displayTitle}
      fileType={fileType}
      fileUrl={fileUrl}
      isDocked={isDocked}
      zoomLevel={zoomLevel}
      onZoomChange={setZoomLevel}
      onToggleDock={() => setDocked(!isDocked)}
      onClose={closePreview}
      onDownload={handleDownload}
      isDownloading={isDownloading}
    />
  );

  // --- Inner content (shared across all modes) ---
  const innerContent = (
    <div className={styles.windowContent}>
      <FileTabs
        sources={sources}
        activeIndex={activeIndex}
        onSelect={setActiveIndex}
      />
      <div className={styles.modalBody}>{renderContent()}</div>
    </div>
  );

  // --- Rnd-based unified window ---
  const rndPosition = showAsDock
    ? { x: windowWidth - dockWidth, y: 0 }
    : {
        x:
          floatingState.x ??
          Math.max(0, (windowWidth - (floatingState.width ?? 720)) / 2),
        y:
          floatingState.y ??
          Math.max(0, window.innerHeight - (floatingState.height ?? 500) - 20),
      };

  const rndSize = showAsDock
    ? { width: dockWidth, height: window.innerHeight }
    : {
        width: floatingState.width ?? 800,
        height: floatingState.height ?? 600,
      };

  const rndEnableResizing = showAsDock
    ? {
        left: true,
        right: false,
        top: false,
        bottom: false,
        topLeft: false,
        topRight: false,
        bottomLeft: false,
        bottomRight: false,
      }
    : true; // All directions enabled for floating

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          id="pv-viewer"
          data-mode={isDocked ? "dock" : "popup"}
          className={`
            ${styles.previewSystem}
            ${showAsPeek ? styles.modePeek : ""}
            ${showAsDock ? styles.modeDock : ""}
            ${showAsFloating ? styles.modeFloating : ""}
          `}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {showAsPeek ? (
            /* Mobile peek: simple fixed bottom sheet */
            <motion.div
              className={styles.windowFrame}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.peekHandle} />
              <div className={styles.dragHandleWrapper}>{header}</div>
              {innerContent}
            </motion.div>
          ) : (
            /* Desktop: Rnd-powered window for both floating and docked */
            <Rnd
              position={rndPosition}
              size={rndSize}
              disableDragging={showAsDock}
              enableResizing={rndEnableResizing}
              dragHandleClassName={styles.dragHandleWrapper}
              minWidth={showAsDock ? 380 : 380}
              minHeight={showAsDock ? undefined : 350}
              maxWidth={showAsDock ? window.innerWidth * 0.8 : undefined}
              bounds="window"
              onDragStart={() => setIsInteracting(true)}
              onDragStop={(e, d) => {
                setIsInteracting(false);
                if (!showAsDock) {
                  setFloatingState({ x: d.x, y: d.y });
                }
              }}
              onResizeStart={() => setIsInteracting(true)}
              onResizeStop={(e, direction, ref, delta, position) => {
                setIsInteracting(false);
                const newWidth = parseInt(ref.style.width, 10);
                const newHeight = parseInt(ref.style.height, 10);
                if (showAsDock) {
                  setDockWidth(newWidth);
                } else {
                  setFloatingState({
                    width: newWidth,
                    height: newHeight,
                    ...position,
                  });
                }
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
                className={`${styles.windowFrame} ${
                  isInteracting ? styles.windowInteracting : ""
                }`}
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
