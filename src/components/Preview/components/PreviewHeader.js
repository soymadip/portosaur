import React, { useState, useRef } from "react";
import Tooltip from "@site/src/components/Tooltip";
import styles from "../styles.module.css";

import IconDock from "@site/static/img/svg/icon-dock.svg";
import IconPopup from "@site/static/img/svg/icon-popup.svg";
import IconSave from "@site/static/img/svg/icon-save.svg";
import IconLink from "@site/static/img/svg/icon-link.svg";
import IconClose from "@site/static/img/svg/icon-close.svg";

/**
 * Preview window header with title, zoom controls, dock/popup toggle, and close button.
 */
export default function PreviewHeader({
  displayTitle,
  fileType,
  fileUrl,
  isDocked,
  zoomLevel,
  onZoomChange,
  onToggleDock,
  onClose,
  onDownload,
  isDownloading,
  showDockLabel = true,
}) {
  const [showZoomMenu, setShowZoomMenu] = useState(false);
  const zoomMenuRef = useRef(null);
  const zoomMenuTimer = useRef(null);

  const isMobileSize =
    typeof window !== "undefined" && window.innerWidth <= 768;

  return (
    <>
      {/* Dock-mode "PREVIEW" label pinned behind navbar */}
      {isDocked && !isMobileSize && (
        <div className={styles.revealHeader}>
          <h1 className={styles.modalTitle}>
            <span className={styles.primaryText}>Preview </span>
          </h1>
        </div>
      )}

      <div className={styles.modalHeader}>
        {/* Left: file title */}
        <div className={styles.headerLeft}>
          <h4 className={styles.modalTitle}>
            <span className={styles.baseTitleText}>{displayTitle}</span>
          </h4>
        </div>

        {/* Right: controls */}
        <div className={styles.headerControls}>
          {/* Zoom dropdown (desktop only) */}
          {!isMobileSize && (
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
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((level) => (
                    <button
                      key={level}
                      className={`${styles.zoomMenuItem} ${
                        zoomLevel === level ? styles.zoomMenuItemActive : ""
                      }`}
                      onClick={() => {
                        onZoomChange(level);
                        setShowZoomMenu(false);
                      }}
                    >
                      {level === 1.0
                        ? "100% (Fit)"
                        : `${Math.round(level * 100)}%`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Visit / Download */}
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
            <Tooltip msg={isDownloading ? "Downloading..." : "Download file"} position="bottom" underline={false}>
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
                <span className={styles.btnText}>{isDownloading ? "Saving" : "Save"}</span>
              </button>
            </Tooltip>
          )}

          {/* Dock / Popup toggle */}
          <Tooltip
            msg={isDocked ? "Open as popup" : "Dock to side"}
            position="bottom"
            underline={false}
          >
            <button
              onClick={onToggleDock}
              className={`${styles.headerAction} ${styles.dockToggle}`}
            >
              {isDocked ? (
                <IconPopup
                  className={`${styles.headerIcon} ${styles.iconPopupTweak}`}
                />
              ) : (
                <IconDock className={styles.headerIcon} />
              )}
              {showDockLabel && (
                <span className={styles.btnText}>
                  {isDocked ? "Popup" : "Dock"}
                </span>
              )}
            </button>
          </Tooltip>

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
