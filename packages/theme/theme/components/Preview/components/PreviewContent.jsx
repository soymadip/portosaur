import React from "react";
import styles from "../styles.module.css";
import { LoadingState, ErrorState, OfflineState } from "./FeedbackStates";
import ImageRenderer from "../renderers/ImageRenderer";
import PdfRenderer from "../renderers/PdfRenderer";
import WebRenderer from "../renderers/WebRenderer";
import CodeRenderer from "../renderers/CodeRenderer";

export default function PreviewContent({
  currentFile,
  fileType,
  fileUrl,
  isOnline,
  fetchErrors,
  textLoading,
  textContent,
  zoomLevel,
  ext,
  retryFetch,
  setError,
}) {
  const path = currentFile?.path;
  const isExternal = path?.startsWith("http") || path?.startsWith("//");

  if (!isOnline && isExternal) {
    return <OfflineState onRetry={retryFetch} />;
  }

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

  if (textLoading && fileType === "text") {
    return <LoadingState />;
  }

  switch (fileType) {
    case "image":
      return (
        <ImageRenderer
          fileUrl={fileUrl}
          label={currentFile.label}
          zoomLevel={zoomLevel}
          onError={(msg) => setError(path, msg)}
        />
      );
    case "pdf":
      return (
        <PdfRenderer
          fileUrl={fileUrl}
          zoomLevel={zoomLevel}
          onError={(msg) => setError(path, msg)}
        />
      );
    case "web":
      return (
        <WebRenderer
          fileUrl={fileUrl}
          label={currentFile.label}
          onError={(msg) => setError(path, msg)}
        />
      );
    default: {
      if (!textContent) return <LoadingState />;
      return (
        <CodeRenderer code={textContent} language={ext} zoomLevel={zoomLevel} />
      );
    }
  }
}
