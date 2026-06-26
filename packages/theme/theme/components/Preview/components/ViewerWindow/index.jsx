import {
  useState,
  useEffect,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import { useLocation } from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { usePreview } from "../../state/index.jsx";
import { classify, getExt, resolveUrl } from "../../utils/index.jsx";
import { useFileFetch } from "../../hooks/useFileFetch.jsx";
import { useDeepLinkHash } from "../../hooks/useDeepLinkHash.jsx";
import { useAdaptiveSizing } from "../../hooks/useAdaptiveSizing.jsx";
import { useTouchZoom } from "../../hooks/useTouchZoom.jsx";
import { useGlobalZoomDisable } from "../../hooks/useGlobalZoomDisable.jsx";

// Import Layouts and Frame
import WindowFrame from "./WindowFrame.jsx";
import DockLayout from "./layouts/DockLayout.jsx";
import MobileDockLayout from "./layouts/MobileDockLayout.jsx";
import PopupLayout from "./layouts/PopupLayout.jsx";
import PipLayout from "./layouts/PipLayout.jsx";

// Internal context to share computed viewer state between ViewerWindow and PreviewDock
// without double-mounting effects
const ViewerContext = createContext(null);

/**
 * ViewerRoot — a context-only provider that mounts all the preview state logic once.
 * Both ViewerWindow and PreviewDock consume this context.
 * Rendered at the Layout level so it's always alive regardless of open/mode state.
 */
export function ViewerRoot({ children }) {
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

  useGlobalZoomDisable(isOpen);

  const [mounted, setMounted] = useState(typeof window !== "undefined");
  const [isOnline, setIsOnline] = useState(
    typeof window !== "undefined" ? window.navigator.onLine : true,
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? document.documentElement.clientWidth : 1200,
  );
  const [windowHeight, setWindowHeight] = useState(
    typeof window !== "undefined" ? document.documentElement.clientHeight : 800,
  );

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

  // --- Display Mode State for Cross-fade ---
  const [displayMode, setDisplayMode] = useState(mode);
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const closeTimerRef = useRef(null);
  const switchTimerRef = useRef(null);
  const isVisibleRef = useRef(isVisible);

  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  // Handle Mode Switching with Cross-fade
  useEffect(() => {
    if (displayMode !== mode) {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);

      if (isOpen && isVisibleRef.current) {
        setIsVisible(false); // Fade out old mode
        switchTimerRef.current = setTimeout(() => {
          setDisplayMode(mode); // Swap tree
          switchTimerRef.current = setTimeout(() => {
            setIsVisible(true); // Fade in new mode
            switchTimerRef.current = null;
          }, 30);
        }, 150);
      } else {
        setDisplayMode(mode);
      }
    }
  }, [mode, isOpen]);

  // Handle Open/Close Lifecycle
  useEffect(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

    if (isOpen) {
      setIsMounted(true);
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      closeTimerRef.current = setTimeout(() => setIsMounted(false), 250);
    }
  }, [isOpen]);

  // --- Layout Engine ---
  const layout = useAdaptiveSizing({
    mode: displayMode,
    windowWidth,
    windowHeight,
    floatingState,
    setFloatingState,
  });

  const {
    isPopupMode,
    isDockMode,
    isMobileDock,
    isPipMode,
    isMobile,
    isTabletPortrait,
  } = layout;

  // --- Global Keyboard & Router Bindings ---
  const prevPathRef = useRef(location.pathname);
  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      if (isOpen) closePreview();
    }
  }, [location.pathname, isOpen, closePreview]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") closePreview();
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () =>
      window.removeEventListener("keydown", handler, { capture: true });
  }, [isOpen, closePreview]);

  // --- Sidebar Collapse Sync ---
  const weCollapsedSidebar = useRef(false);
  useEffect(() => {
    if (typeof document === "undefined") return;

    const sidebarContainer = document.querySelector(
      ".theme-doc-sidebar-container",
    );
    if (!sidebarContainer) return;

    const collapseBtn = sidebarContainer.querySelector(
      "button[class*='collapseSidebarButton'], button[title*='collapse' i]",
    );
    const expandBtn = sidebarContainer.querySelector(
      "[class*='expandButton'], [title*='expand' i]",
    );

    if (isDockMode && isOpen) {
      const isCollapsed =
        sidebarContainer.className.includes("Hidden") || !!expandBtn;

      if (!isCollapsed && collapseBtn) {
        collapseBtn.click();
        weCollapsedSidebar.current = true;
      }
    } else {
      if (weCollapsedSidebar.current) {
        if (expandBtn) {
          expandBtn.click();
        } else if (collapseBtn) {
          collapseBtn.click();
        }
        weCollapsedSidebar.current = false;
      }
    }
  }, [isDockMode, isOpen]);

  // --- Mobile dock height CSS var ---
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isMobileDock && isOpen) {
      document.body.style.setProperty(
        "--mobile-dock-height",
        `${peekHeight}px`,
      );
    } else {
      document.body.style.removeProperty("--mobile-dock-height");
    }
  }, [isMobileDock, isOpen, peekHeight]);

  // --- Dock-active body class (hides desktop TOC, shows mobile TOC button) ---
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isDockMode && isOpen) {
      document.body.classList.add("pv-dock-active");
      document.body.style.setProperty("--pv-dock-width", `${dockWidth}px`);
    } else {
      document.body.classList.remove("pv-dock-active");
      document.body.style.removeProperty("--pv-dock-width");
    }

    return () => {
      document.body.classList.remove("pv-dock-active");
      document.body.style.removeProperty("--pv-dock-width");
    };
  }, [dockWidth, isDockMode, isOpen]);

  // --- Scroll & Global Zoom Lock ---
  useEffect(() => {
    if (typeof document === "undefined" || !isOpen) return;

    const handleGlobalWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: false });

    let originalOverflow = "";
    if (isPopupMode) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      if (isPopupMode) {
        document.body.style.overflow = originalOverflow;
      }
    };
  }, [isOpen, isPopupMode, isMobileDock]);

  // --- Data Fetching & State ---
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

  // --- UI Controls ---
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const popupBodyRef = useRef(null);

  useEffect(() => {
    if (isOpen) setZoomLevel(1);
  }, [displayMode, isOpen]);

  useTouchZoom({ containerRef: popupBodyRef, isOpen, zoomLevel, setZoomLevel });
  useDeepLinkHash(isOpen, sources, activeIndex, displayMode, baseSlug);

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
    } catch (e) {
      console.error("Download failed:", e);
    } finally {
      setIsDownloading(false);
    }
  }, [fileUrl, currentFile, corsProxyList]);

  const displayTitle =
    currentFile?.title || currentFile?.url?.split("/").pop() || "Preview";

  const frame = (
    <WindowFrame
      displayTitle={displayTitle}
      fileType={fileType}
      fileUrl={fileUrl}
      mode={displayMode}
      zoomLevel={zoomLevel}
      setZoomLevel={setZoomLevel}
      setMode={setMode}
      closePreview={closePreview}
      handleDownload={handleDownload}
      isDownloading={isDownloading}
      modeSwitch={modeSwitch}
      sources={sources}
      activeIndex={activeIndex}
      setActiveIndex={setActiveIndex}
      currentFile={currentFile}
      isOnline={isOnline}
      fetchErrors={fetchErrors}
      textLoading={textLoading}
      textContent={textContent}
      ext={ext}
      retryFetch={retryFetch}
      setError={setError}
      popupBodyRef={popupBodyRef}
      isOpen={isOpen}
      isMobileDock={isMobileDock}
      isPipMode={isPipMode}
    />
  );

  const ctx = {
    mounted,
    isMounted,
    isVisible,
    isOpen,
    isDockMode,
    isMobileDock,
    isPopupMode,
    isPipMode,
    isMobile,
    isTabletPortrait,
    dockWidth,
    setDockWidth,
    peekHeight,
    setPeekHeight,
    closePreview,
    setFloatingState,
    layout,
    frame,
  };

  return (
    <ViewerContext.Provider value={ctx}>{children}</ViewerContext.Provider>
  );
}

function useViewer() {
  return useContext(ViewerContext);
}

/**
 * PreviewDock — renders the desktop dock panel as a natural sticky flex sibling
 * in the Layout. No portal, no fixed positioning, no JS tracking.
 * Sticks to navbar, stops before footer, moves with navbar on hideOnScroll.
 */
export function PreviewDock() {
  const ctx = useViewer();

  // If ViewerRoot hasn't mounted yet (SSR or not yet rendered), render nothing
  if (!ctx || !ctx.mounted) return null;

  const { isMounted, isVisible, isDockMode, dockWidth, setDockWidth, frame } =
    ctx;

  // Non-dock modes are handled by ViewerWindow via portal
  if (!isDockMode) return null;

  return (
    <DockLayout
      isVisible={isVisible && isMounted}
      dockWidth={dockWidth}
      setDockWidth={setDockWidth}
    >
      {frame}
    </DockLayout>
  );
}

/**
 * ViewerWindow — handles Popup, PiP, and MobileDock modes via portal.
 * Desktop dock mode is handled by PreviewDock directly in the Layout.
 */
export default function PreviewViewer() {
  const ctx = useViewer();

  if (!ctx || !ctx.mounted) return null;

  const {
    isMounted,
    isVisible,
    isDockMode,
    isMobileDock,
    isPopupMode,
    isPipMode,
    isMobile,
    isTabletPortrait,
    peekHeight,
    setPeekHeight,
    closePreview,
    setFloatingState,
    layout,
    frame,
  } = ctx;

  const portalRoot = document.getElementById("pv-portal-root") || document.body;

  // Dock renders in Layout via PreviewDock — nothing to portal here
  if (isDockMode) return null;

  return createPortal(
    isMounted && (
      <>
        {isMobileDock && (
          <MobileDockLayout
            isVisible={isVisible}
            peekHeight={peekHeight}
            setPeekHeight={setPeekHeight}
            closePreview={closePreview}
          >
            {frame}
          </MobileDockLayout>
        )}

        {isPopupMode && (
          <PopupLayout
            isVisible={isVisible}
            closePreview={closePreview}
            isMobileOrTablet={isMobile || isTabletPortrait}
          >
            {frame}
          </PopupLayout>
        )}

        {isPipMode && (
          <PipLayout
            isVisible={isVisible}
            pipWidth={layout.pipWidth}
            pipHeight={layout.pipHeight}
            pipX={layout.pipX}
            pipY={layout.pipY}
            setFloatingState={setFloatingState}
            isMobile={isMobile}
          >
            {frame}
          </PipLayout>
        )}
      </>
    ),
    portalRoot,
  );
}
