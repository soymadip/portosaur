import React, { useState, useEffect, useRef } from "react";
import { LoadingState } from "../components/FeedbackStates";
import styles from "../styles.module.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

let PdfDocument, PdfPage, pdfjs;

function VirtualPdfPage({
  pageNumber,
  containerWidth,
  zoomLevel,
  onRenderSuccess,
  renderedCount,
}) {
  // Eagerly mount the first two pages to bypass IntersectionObserver layout delay
  // This guarantees they are first in the PDF worker's render queue!
  const shouldBackgroundLoad = pageNumber <= renderedCount + 2;
  const [isVisible, setIsVisible] = useState(
    pageNumber <= 2 || shouldBackgroundLoad,
  );
  const [isRendered, setIsRendered] = useState(false);
  const ref = useRef(null);

  // Background loading cascade
  useEffect(() => {
    if (shouldBackgroundLoad && !isVisible) {
      setIsVisible(true);
    }
  }, [shouldBackgroundLoad, isVisible]);

  useEffect(() => {
    if (isRendered) return; // Never unmount once fully rendered!

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else {
          // If it leaves the viewport AND hasn't finished rendering,
          // AND it's not part of the active background load cascade,
          // unmount it to cancel the render request and prioritize the active page!
          if (!shouldBackgroundLoad && pageNumber > 2) {
            setIsVisible(false);
          }
        }
      },
      { rootMargin: "1500px 0px" }, // Large pre-load buffer
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [isRendered, shouldBackgroundLoad, pageNumber]);

  // Approximate A4 ratio to prevent scroll jumping before render
  const approxHeight = containerWidth * zoomLevel * 1.414;

  return (
    <div
      ref={ref}
      style={{
        minHeight: `${approxHeight}px`,
        width: "100%",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {isVisible ? (
        <PdfPage
          pageNumber={pageNumber}
          width={containerWidth}
          scale={zoomLevel}
          className={`${styles.pdfPage} ${zoomLevel > 1 ? styles.isGrabbable : ""}`}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          loading={
            <div
              style={{
                height: `${approxHeight}px`,
                width: `${containerWidth * zoomLevel}px`,
                background: "white",
              }}
            />
          }
          onRenderSuccess={() => {
            setIsRendered(true);
            onRenderSuccess?.();
          }}
        />
      ) : (
        <div
          className={`${styles.pdfPage} ${zoomLevel > 1 ? styles.isGrabbable : ""}`}
          style={{
            height: `${approxHeight}px`,
            width: `${containerWidth * zoomLevel}px`,
            background: "white",
          }}
        />
      )}
    </div>
  );
}

export default function PdfRenderer({ fileUrl, zoomLevel, onError }) {
  const [pdfReady, setPdfReady] = useState(!!PdfDocument);
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(760);
  const [renderedCount, setRenderedCount] = useState(0);
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
          <VirtualPdfPage
            key={i}
            pageNumber={i + 1}
            containerWidth={containerWidth}
            zoomLevel={zoomLevel}
            renderedCount={renderedCount}
            onRenderSuccess={() => {
              // Update rendered count to trigger the next page to load in the background
              setRenderedCount((prev) => Math.max(prev, i + 1));

              if (wrapperRef.current) {
                wrapperRef.current.style.transform = "";
                wrapperRef.current.style.transformOrigin = "";
                wrapperRef.current.style.transition = "";
              }
            }}
          />
        ))}
      </PdfDocument>
    </div>
  );
}
