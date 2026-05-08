import React, { useState, useRef } from "react";
import Tooltip from "../../Tooltip/index.jsx";
import styles from "../styles.module.css";
import { PreviewMode } from "../state/index.jsx";
import IconDock from "../../../../assets/img/svg/icon-dock.svg";
import IconPopup from "../../../../assets/img/svg/icon-popup.svg";
import IconSave from "../../../../assets/img/svg/icon-save.svg";
import IconLink from "../../../../assets/img/svg/icon-link.svg";
import IconClose from "../../../../assets/img/svg/icon-close.svg";

export default function PreviewHeader({
  displayTitle,
  fileType,
  fileUrl,
  mode,
  zoomLevel,
  onZoomChange,
  onToggleMode,
  onClose,
  onDownload,
  isDownloading,
  modeSwitch = true,
  showDockLabel = true,
}) {
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const zoomMenuRef = useRef(null);
  const zoomMenuTimer = useRef(null);
  const isMobileSize =
    typeof window !== "undefined" && window.innerWidth <= 768;
  const toggleLabel =
    mode === "popup" ? "Dock" : mode === "dock" ? "PiP" : "Dock";
  const toggleTooltip =
    mode === "popup"
      ? "Dock to side"
      : mode === "dock"
        ? "Open as PiP"
        : "Dock to side";

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
          {/* Zoom picker (desktop, non-web) */}
          {!isMobileSize && fileType !== "web" && (
            <div
              className={styles.zoomDropdown}
              ref={zoomMenuRef}
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
                className={styles.zoomVal}
                title="Change Zoom"
              >
                {Math.round(zoomLevel * 100)}%
                <span className={styles.dropdownArrow}>▼</span>
              </button>

              {showZoomMenu && (
                <div className={styles.zoomMenu}>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((level) => (
                    <button
                      key={level}
                      className={`${styles.zoomMenuItem} ${zoomLevel === level ? styles.zoomMenuItemActive : ""}`}
                      onClick={() => {
                        onZoomChange(level);
                        setShowZoomMenu(false);
                      }}
                    >
                      {level === 1
                        ? "100% (Fit)"
                        : `${Math.round(level * 100)}%`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Open/Download action */}
          {fileType === "web" ? (
            <Tooltip msg="Open externally" position="bottom" underline={false}>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.headerAction}
              >
                <IconLink className={styles.headerIcon} />
                <span className={styles.btnText}>Visit</span>
              </a>
            </Tooltip>
          ) : (
            <Tooltip
              msg={isDownloading ? "Downloading..." : "Download file"}
              position="bottom"
              underline={false}
            >
              <button
                onClick={onDownload}
                disabled={isDownloading}
                className={`${styles.headerAction} ${styles.downloadButton} ${isDownloading ? styles.headerActionDisabled : ""}`}
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
            </Tooltip>
          )}

          {/* Mode toggle */}
          {modeSwitch && (
            <Tooltip msg={toggleTooltip} position="bottom" underline={false}>
              <button
                onClick={onToggleMode}
                className={`${styles.headerAction} ${styles.dockToggle}`}
              >
                {mode === "popup" || mode === "pip" ? (
                  <IconDock className={styles.headerIcon} />
                ) : (
                  <IconPopup
                    className={`${styles.headerIcon} ${styles.iconPopupTweak}`}
                  />
                )}
                {showDockLabel && (
                  <span className={styles.btnText}>{toggleLabel}</span>
                )}
              </button>
            </Tooltip>
          )}

          {/* Close */}
          <Tooltip msg="Close" position="bottom" underline={false}>
            <button
              onClick={onClose}
              className={`${styles.headerAction} ${styles.headerActionClose}`}
            >
              <IconClose className={styles.headerIconSmall} />
            </button>
          </Tooltip>
        </div>
      </div>
    </>
  );
}
