import React, { useState, useEffect, useRef } from "react";
import { LoadingState } from "../components/FeedbackStates";
import styles from "../styles.module.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

let PdfDocument, PdfPage, pdfjs;

export default function PdfRenderer({ fileUrl, zoomLevel, onError }) {
  const [pdfReady, setPdfReady] = useState(!!PdfDocument);
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(760);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (PdfDocument) return;
    import("react-pdf").then((mod) => {
      PdfDocument = mod.Document;
      PdfPage = mod.Page;
      pdfjs = mod.pdfjs;
      pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      setPdfReady(true);
    });
  }, []);

  useEffect(() => {
    if (!wrapperRef.current) return;
    let timeoutId = null;
    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width <= 0) return;
      const diff = Math.abs(width - containerWidth);
      if (diff < 15) return;
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setContainerWidth(width), 150);
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
            renderTextLayer={true}
            renderAnnotationLayer={true}
          />
        ))}
      </PdfDocument>
    </div>
  );
}
