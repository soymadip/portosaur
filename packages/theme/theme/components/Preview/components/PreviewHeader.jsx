import React, { useState, useRef } from "react";
import styles from "../styles.module.css";
import IconDock from "../../../../assets/img/svg/icon-dock.svg";
import IconPopup from "../../../../assets/img/svg/icon-popup.svg";
import IconSave from "../../../../assets/img/svg/icon-save.svg";
import IconLink from "../../../../assets/img/svg/icon-link.svg";
import IconClose from "../../../../assets/img/svg/icon-close.svg";
import IconZoom from "../../../../assets/img/svg/icon-zoom.svg";

export default function PreviewHeader({
  displayTitle,
  fileType,
  fileUrl,
  mode,
  zoomLevel,
  onZoomChange,
  onChangeMode,
  onClose,
  onDownload,
  isDownloading,
  modeSwitch = true,
}) {
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const zoomMenuTimer = useRef(null);

  const [showModeMenu, setShowModeMenu] = useState(false);
  const modeMenuTimer = useRef(null);

  const isMobileSize =
    typeof window !== "undefined" && window.innerWidth <= 768;

  return (
    <>
      {/* Reveal header shown only in dock mode on desktop */}
      {mode === "dock" && !isMobileSize && (
        <div className={styles.revealHeader}>
          <h1 className={styles.popupTitle}>
            <span className={styles.primaryText}>Preview </span>
          </h1>
        </div>
      )}

      {/* Main header bar */}
      <div className={styles.popupHeader}>
        {/* Title */}
        <div className={styles.headerLeft}>
          <h4 className={styles.popupTitle}>
            <span className={styles.baseTitleText}>{displayTitle}</span>
          </h4>
        </div>

        {/* Controls */}
        <div className={styles.headerControls}>
          {/* Zoom picker (desktop, non-web, non-video) */}
          {!isMobileSize && fileType !== "web" && fileType !== "video" && (
            <div
              className={`${styles.dropdown} ${showZoomMenu ? styles.dropdownShow : ""}`}
              onMouseEnter={() => {
                if (zoomMenuTimer.current) clearTimeout(zoomMenuTimer.current);
                setShowZoomMenu(true);
              }}
              onMouseLeave={() => {
                zoomMenuTimer.current = setTimeout(
                  () => setShowZoomMenu(false),
                  150,
                );
              }}
            >
              <button
                onClick={() => setShowZoomMenu(!showZoomMenu)}
                className={styles.headerAction}
                title="Change Zoom"
              >
                <IconZoom className={styles.headerIconSmall} />
                <span className={styles.btnText}>
                  {Math.round(zoomLevel * 100)}%
                </span>
                <span className={styles.dropdownArrow}>▼</span>
              </button>

              <div className={styles.dropdownMenu}>
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((level) => (
                  <button
                    key={level}
                    className={`${styles.dropdownMenuItem} ${zoomLevel === level ? styles.dropdownMenuItemActive : ""}`}
                    onClick={() => {
                      onZoomChange(level);
                      setShowZoomMenu(false);
                    }}
                  >
                    {level === 1 ? "100% (Fit)" : `${Math.round(level * 100)}%`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode picker dropdown */}
          {modeSwitch &&
            (() => {
              const MODE_OPTIONS = [
                { id: "popup", label: "Popup", icon: IconPopup },
                { id: "dock", label: "Dock", icon: IconDock },
                { id: "pip", label: "PiP", icon: IconDock },
              ];
              const activeModeOption =
                MODE_OPTIONS.find((m) => m.id === mode) || MODE_OPTIONS[0];
              const ActiveModeIcon = activeModeOption.icon;

              return (
                <div
                  className={`${styles.dropdown} ${showModeMenu ? styles.dropdownShow : ""}`}
                  onMouseEnter={() => {
                    if (modeMenuTimer.current)
                      clearTimeout(modeMenuTimer.current);
                    setShowModeMenu(true);
                  }}
                  onMouseLeave={() => {
                    modeMenuTimer.current = setTimeout(
                      () => setShowModeMenu(false),
                      150,
                    );
                  }}
                >
                  <button
                    onClick={() => setShowModeMenu(!showModeMenu)}
                    className={styles.headerAction}
                    title="Change Preview Mode"
                  >
                    <ActiveModeIcon className={styles.headerIconSmall} />
                    <span className={styles.btnText}>
                      {activeModeOption.label}
                    </span>
                    <span className={styles.dropdownArrow}>▼</span>
                  </button>

                  <div className={styles.dropdownMenu}>
                    {MODE_OPTIONS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        className={`${styles.dropdownMenuItem} ${mode === id ? styles.dropdownMenuItemActive : ""}`}
                        onClick={() => {
                          onChangeMode(id);
                          setShowModeMenu(false);
                        }}
                      >
                        <Icon className={styles.headerIconSmall} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

          {/* Open/Download action */}
          {fileType === "web" ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.headerAction}
              title="Open externally"
            >
              <IconLink className={styles.headerIcon} />
              <span className={styles.btnText}>Visit</span>
            </a>
          ) : (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              className={`${styles.headerAction} ${styles.downloadButton} ${isDownloading ? styles.headerActionDisabled : ""}`}
              title={isDownloading ? "Downloading..." : "Download file"}
            >
              {isDownloading ? (
                <div className={styles.spinnerSmall} />
              ) : (
                <IconSave className={styles.headerIconSmall} />
              )}
              <span className={styles.btnText}>
                {isDownloading ? "Saving" : "Save"}
              </span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className={`${styles.headerAction} ${styles.headerActionClose}`}
            title="Close"
          >
            <IconClose className={styles.headerIconSmall} />
          </button>
        </div>
      </div>
    </>
  );
}
