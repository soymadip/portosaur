import { useState, useEffect } from "react";
import { Btn, Dropdown } from "../../UI/index.jsx";
import Hint from "../../Hint/index.jsx";
import styles from "../styles.module.css";
import IconDock from "../../../../assets/img/svg/icon-dock.svg";
import IconPopup from "../../../../assets/img/svg/icon-popup.svg";
import IconPip from "../../../../assets/img/svg/icon-pip.svg";
import IconSave from "../../../../assets/img/svg/icon-save.svg";
import IconLink from "../../../../assets/img/svg/icon-link.svg";
import IconClose from "../../../../assets/img/svg/icon-close.svg";
import IconZoom from "../../../../assets/img/svg/icon-zoom.svg";
import IconMinimize from "../../../../assets/img/svg/icon-minimize.svg";

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
  isPipMode = false,
  handleHidePip,
}) {
  const isMobileSize =
    typeof window !== "undefined" && window.innerWidth <= 768;

  const [displayZoom, setDisplayZoom] = useState(zoomLevel);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyLink = (e) => {
    e.stopPropagation();
    if (!fileUrl) {
      return;
    }
    navigator.clipboard.writeText(fileUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  useEffect(() => {
    setDisplayZoom(zoomLevel);
  }, [zoomLevel]);

  useEffect(() => {
    const handleZoomUpdate = (e) => setDisplayZoom(e.detail);
    window.addEventListener("pv-zoom-update", handleZoomUpdate);
    return () => window.removeEventListener("pv-zoom-update", handleZoomUpdate);
  }, []);

  return (
    <>
      {/* Reveal header shown only in dock mode on desktop */}
      {mode === "dock" && !isMobileSize && (
        <div className={styles.revealHeader}>
          <h1 className={styles.popupTitle}>
            <span className={styles.primaryText}>PREVIEW</span>
          </h1>
        </div>
      )}

      {/* Main header bar */}
      <div className={styles.popupHeader}>
        {/* Title — also the PiP drag zone in pip mode */}
        <div
          className={`${styles.headerLeft} ${isPipMode ? styles.pipDragZone : ""}`}
          onDoubleClick={isPipMode ? handleHidePip : undefined}
        >
          <h4 className={styles.popupTitle}>
            {fileUrl ? (
              <Hint
                msg={isCopied ? "Copied!" : `${fileUrl}\n\nClick to copy`}
                bottom
                noUl
                zIndex={9999}
              >
                <span
                  className={`${styles.baseTitleText} ${styles.baseTitleCopyable}`}
                  onClick={handleCopyLink}
                  role="button"
                  aria-label="Copy link"
                >
                  {displayTitle}
                </span>
              </Hint>
            ) : (
              <span className={styles.baseTitleText}>{displayTitle}</span>
            )}
          </h4>
        </div>

        {/* Controls */}
        <div className={styles.headerControls}>
          {/* Open/Download action */}
          {fileType === "web" ? (
            <Btn
              as="a"
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open externally"
              icon={<IconLink />}
            >
              {isMobileSize ? null : "Visit"}
            </Btn>
          ) : (
            <Btn
              onClick={onDownload}
              disabled={isDownloading}
              title={isDownloading ? "Downloading..." : "Download file"}
              icon={
                isDownloading ? (
                  <div className={styles.spinnerSmall} />
                ) : (
                  <IconSave />
                )
              }
              primary
            >
              {isMobileSize ? null : isDownloading ? "Saving" : "Save"}
            </Btn>
          )}

          {/* Zoom picker (desktop, non-web, non-video) */}
          {fileType !== "web" &&
            fileType !== "video" &&
            (() => {
              const presets = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5];
              const roundedZoom = Math.round(displayZoom * 100);
              const activePresetIndex = presets.findIndex(
                (level) => Math.round(level * 100) === roundedZoom,
              );

              const items = presets.map((level, idx) => ({
                id: level,
                label:
                  level === 1 ? "100% (Fit)" : `${Math.round(level * 100)}%`,
                active: idx === activePresetIndex,
                onClick: () => onZoomChange(level),
              }));

              if (activePresetIndex === -1) {
                const insertIndex = presets.findIndex(
                  (level) => level > displayZoom,
                );
                const customItem = {
                  id: "custom",
                  label: `${roundedZoom}% (Custom)`,
                  active: true,
                  onClick: () => {},
                };

                if (insertIndex === -1) {
                  items.push(customItem);
                } else {
                  items.splice(insertIndex, 0, customItem);
                }
              }

              return (
                <Dropdown
                  label={isMobileSize ? null : `${roundedZoom}%`}
                  primary
                  icon={<IconZoom />}
                  title="Change Zoom"
                  items={items}
                />
              );
            })()}

          {/* Mode picker dropdown */}
          {modeSwitch &&
            (() => {
              const MobileAwareDockIcon = (props) => (
                <IconDock
                  {...props}
                  style={{
                    transform: isMobileSize ? "rotate(90deg)" : "none",
                    ...props.style,
                  }}
                />
              );

              const MODE_OPTIONS = [
                { id: "popup", label: "Popup", icon: IconPopup },
                { id: "dock", label: "Dock", icon: MobileAwareDockIcon },
                { id: "pip", label: "PiP", icon: IconPip },
              ];
              const activeModeOption =
                MODE_OPTIONS.find((m) => m.id === mode) || MODE_OPTIONS[0];
              const ActiveModeIcon = activeModeOption.icon;

              return (
                <Dropdown
                  label={isMobileSize ? null : activeModeOption.label}
                  primary
                  icon={<ActiveModeIcon />}
                  title="Change Preview Mode"
                  items={MODE_OPTIONS.map((m) => ({
                    id: m.id,
                    label: m.label,
                    icon: m.icon,
                    active: mode === m.id,
                    onClick: () => onChangeMode(m.id),
                  }))}
                />
              );
            })()}

          <div className={styles.headerDivider} />

          {/* Minimize PiP */}
          {isPipMode && (
            <Btn
              onClick={(e) => {
                e.stopPropagation();
                handleHidePip();
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                handleHidePip();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              title="Minimize PiP"
              icon={<IconMinimize className={styles.headerIcon} />}
            />
          )}

          {/* Close */}
          <Btn onClick={onClose} title="Close" danger icon={<IconClose />} />
        </div>
      </div>
    </>
  );
}
