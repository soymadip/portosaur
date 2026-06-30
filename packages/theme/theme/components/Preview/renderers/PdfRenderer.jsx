import { useState, useEffect } from "react";
import { PDFViewer, ZoomMode } from "@embedpdf/react-pdf-viewer";
import { useColorMode } from "@docusaurus/theme-common";
import { LoadingState } from "../components/FeedbackStates";

export default function PdfRenderer({ fileUrl, onError }) {
  const [loaded, setLoaded] = useState(false);
  const { colorMode } = useColorMode();

  useEffect(() => {
    const handleUnhandledRejection = (event) => {
      const isFullscreenDenial =
        event.reason &&
        (event.reason.message === "Fullscreen request denied" ||
          (event.reason.name === "TypeError" &&
            event.reason.message.toLowerCase().includes("fullscreen")));
      if (isFullscreenDenial) {
        event.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    const handleFullscreenKeys = (e) => {
      if (e.key === "F11") {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleFullscreenKeys, { capture: true });

    return () => {
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
      window.removeEventListener("keydown", handleFullscreenKeys, {
        capture: true,
      });
      delete window.__pdfViewerExport;
    };
  }, []);

  const handleReady = (registry) => {
    const plugin = registry.getPlugin("document-manager");

    if (!plugin) return;

    const documentManager = plugin.provides();
    const annotationPlugin = registry.getPlugin("annotation")?.provides();
    let isDocLoaded = false;

    const loadAnnotations = () => {
      if (!annotationPlugin) {
        return;
      }

      const cached = localStorage.getItem(`pdf_annotations_${fileUrl}`);
      if (cached) {
        setTimeout(() => {
          try {
            annotationPlugin.importAnnotations(JSON.parse(cached));
          } catch (e) {
            console.error("Failed to load cached annotations", e);
          }
        }, 800);
      }
    };

    // Check if it's already loaded
    const activeDocId = documentManager.getActiveDocumentId();
    if (activeDocId) {
      const state = documentManager.getDocumentState(activeDocId);
      if (state?.status === "loaded") {
        setLoaded(true);
        isDocLoaded = true;
        loadAnnotations();
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
          isDocLoaded = true;
          loadAnnotations();
        }
      }
    });

    // Save on any change
    if (annotationPlugin) {
      annotationPlugin.onAnnotationEvent(() => {
        if (!isDocLoaded) {
          return;
        }
        annotationPlugin.exportAnnotations().wait(
          (items) => {
            if (items && items.length > 0) {
              localStorage.setItem(
                `pdf_annotations_${fileUrl}`,
                JSON.stringify(items),
              );
            } else {
              localStorage.removeItem(`pdf_annotations_${fileUrl}`);
            }
            window.dispatchEvent(new CustomEvent("pdf-annotations-changed"));
          },
          (err) => console.error("Failed to export annotations", err),
        );
      });
    }

    // Expose export API to window so the preview header can trigger it
    const exportPlugin = registry.getPlugin("export")?.provides();
    if (exportPlugin) {
      window.__pdfViewerExport = async () => {
        try {
          exportPlugin.download();
        } catch (e) {
          console.error("Export failed", e);
        }
      };
    }
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
