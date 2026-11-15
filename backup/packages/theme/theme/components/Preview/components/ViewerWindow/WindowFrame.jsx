import React from "react";
import styles from "../../styles.module.css";
import PreviewHeader from "../PreviewHeader";
import FileTabs from "../FileTabs";
import PreviewContent from "../PreviewContent";
import { usePinchZoom } from "../../hooks/usePinchZoom";

export default function WindowFrame({
  displayTitle,
  fileType,
  fileUrl,
  mode,
  zoomLevel,
  setZoomLevel,
  setMode,
  closePreview,
  handleDownload,
  isDownloading,
  modeSwitch,
  sources,
  activeIndex,
  setActiveIndex,
  currentFile,
  isOnline,
  fetchErrors,
  textLoading,
  textContent,
  ext,
  retryFetch,
  setError,
  popupBodyRef,
  isOpen,
  handlePeekPointerDown,
  isMobileDock,
  isPipMode,
  handleHidePip,
}) {
  usePinchZoom(popupBodyRef, zoomLevel, setZoomLevel, fileType === "web");

  return (
    <div
      className={styles.windowFrame}
      style={{ width: "100%", height: "100%", position: "relative" }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Mobile Dock drag pill */}
      {isMobileDock && (
        <div
          className={styles.peekHandle}
          onPointerDown={handlePeekPointerDown}
        />
      )}

      {/* Header */}
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
          isPipMode={isPipMode}
          handleHidePip={handleHidePip}
          isMobileDock={isMobileDock}
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
          className={`${styles.popupBody} ${fileType === "text" ? styles.isText : ""}`}
          ref={(el) => {
            if (popupBodyRef) popupBodyRef.current = el;
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
  );
}
