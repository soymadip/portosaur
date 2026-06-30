import { useState, useEffect } from "react";
import { PDFViewer, ZoomMode } from "@embedpdf/react-pdf-viewer";
import { useColorMode } from "@docusaurus/theme-common";
import { LoadingState } from "../components/FeedbackStates";

export default function PdfRenderer({ fileUrl, onError }) {
  const [loaded, setLoaded] = useState(false);
  const { colorMode } = useColorMode();

  const handleReady = (registry) => {
    const plugin = registry.getPlugin("document-manager");
    if (!plugin) return;
    const documentManager = plugin.provides();

    // Check if it's already loaded
    const activeDocId = documentManager.getActiveDocumentId();
    if (activeDocId) {
      const state = documentManager.getDocumentState(activeDocId);
      if (state?.status === "loaded") {
        setLoaded(true);
      }
    }

    // Listen for future load events via the central store
    const store = registry.getStore();
    const unsubscribe = store.subscribe(() => {
      const activeId = documentManager.getActiveDocumentId();
      if (activeId) {
        const state = documentManager.getDocumentState(activeId);
        if (state?.status === "loaded") {
          setLoaded(true);
          unsubscribe();
        }
      }
    });
  };

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {!loaded && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 10,
            backgroundColor: "var(--ifm-color-emphasis-200)",
          }}
        >
          <LoadingState />
        </div>
      )}
      <PDFViewer
        onReady={handleReady}
        style={{ width: "100%", height: "100%" }}
        config={{
          src: fileUrl,
          theme: { preference: colorMode },
          zoom: { defaultZoomLevel: ZoomMode.FitWidth },
          disabledCategories: [
            "document-open",
            "document-close",
            "document-export",
            "security",
            "comment",
            "panel-comment",
          ],
        }}
      />
    </div>
  );
}
