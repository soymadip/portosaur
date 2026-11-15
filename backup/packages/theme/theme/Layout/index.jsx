import clsx from "clsx";
import ErrorBoundary from "@docusaurus/ErrorBoundary";
import {
  PageMetadata,
  SkipToContentFallbackId,
  ThemeClassNames,
} from "@docusaurus/theme-common";
import SkipToContent from "@theme/SkipToContent";
import AnnouncementBar from "@theme/AnnouncementBar";
import Navbar from "@theme/Navbar";
import Footer from "@theme/Footer";
import LayoutProvider from "@theme/Layout/Provider";
import ErrorPageContent from "@theme/ErrorPageContent";

// Preview imports
import BrowserOnly from "@docusaurus/BrowserOnly";
import {
  PreviewProvider,
  ViewerWindow,
  PreviewDock,
  ViewerRoot,
} from "../components/Preview/index.jsx";

import styles from "./styles.module.css";

/**
 * Wrapper that mounts preview logic + dock on the client only.
 * Keeps the outer layout SSR-compatible.
 */
function ClientPreview({ children }) {
  return (
    <ViewerRoot>
      {/* Horizontal row: main content + dock as a sticky flex sibling */}
      <div className={styles.contentRow}>
        {children}

        {/* Desktop dock — sticky right column, no fixed positioning */}
        <PreviewDock />
      </div>

      {/* Popup, PiP, MobileDock — rendered via portal */}
      <ViewerWindow />
    </ViewerRoot>
  );
}

export default function Layout(props) {
  const {
    children,
    noFooter,
    wrapperClassName,
    // Not really layout-related, but kept for convenience/retro-compatibility
    title,
    description,
  } = props;

  const mainContent = (
    <div
      id={SkipToContentFallbackId}
      className={clsx(
        ThemeClassNames.wrapper.main,
        styles.mainWrapper,
        wrapperClassName,
      )}
    >
      <ErrorBoundary fallback={(params) => <ErrorPageContent {...params} />}>
        {children}
      </ErrorBoundary>
    </div>
  );

  return (
    <LayoutProvider>
      <PreviewProvider>
        <PageMetadata title={title} description={description} />

        <SkipToContent />

        <AnnouncementBar />

        <Navbar />

        {/* On client: wrap in ViewerRoot so dock + modal can mount.
            On server (SSR): just render main content directly in a contentRow-like div. */}
        <BrowserOnly
          fallback={<div className={styles.contentRow}>{mainContent}</div>}
        >
          {() => <ClientPreview>{mainContent}</ClientPreview>}
        </BrowserOnly>

        {!noFooter && <Footer />}
      </PreviewProvider>
    </LayoutProvider>
  );
}
