import React, { useState, useEffect, useRef } from "react";
import { LoadingState } from "../components/FeedbackStates";
import styles from "../styles.module.css";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Lazy-loaded PDF components
let PdfDocument, PdfPage, pdfjs;

/**
 * Renders a PDF document with continuous scrolling pages.
 * Dynamically imports react-pdf on first mount.
 */
export default function PdfRenderer({ fileUrl, zoomLevel, onError }) {
  const [pdfReady, setPdfReady] = useState(!!PdfDocument);
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(760);
  const wrapperRef = useRef(null);

  // Lazy-load react-pdf
  useEffect(() => {
    if (PdfDocument) return;
    import("react-pdf").then((mod) => {
      PdfDocument = mod.Document;
      PdfPage = mod.Page;
      pdfjs = mod.pdfjs;
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      setPdfReady(true);
    });
  }, []);

  // Track container width with debouncing and thresholding to prevent flickering
  useEffect(() => {
    if (!wrapperRef.current) return;
    let timeoutId = null;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width <= 0) return;

      // Hysteresis: Only re-render if the width has changed by more than 15px
      // This prevents flickering during tiny sub-pixel browser resizes
      const diff = Math.abs(width - containerWidth);
      if (diff < 15) return;

      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setContainerWidth(width);
      }, 150); // Slightly longer wait to ensure the 400ms transition has mostly finished
    });

    observer.observe(wrapperRef.current);
    return () => {
      observer.disconnect();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [pdfReady, containerWidth]);

  if (!pdfReady || !PdfDocument) {
    return <LoadingState />;
  }

  return (
    <div className={styles.pdfView} ref={wrapperRef}>
      <PdfDocument
        file={fileUrl}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(err) =>
          onError?.(err.message || "Invalid or missing PDF file.")
        }
        loading={<LoadingState />}
      >
        {Array.from({ length: numPages || 0 }, (_, i) => (
          <PdfPage
            key={i}
            pageNumber={i + 1}
            width={containerWidth}
            scale={zoomLevel}
            className={styles.pdfPage}
            renderTextLayer
            renderAnnotationLayer
          />
        ))}
      </PdfDocument>
    </div>
  );
}
