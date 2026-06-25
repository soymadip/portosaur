import { Btn, Dropdown } from "../../UI/index.jsx";
import styles from "../styles.module.css";
import IconDock from "../../../../assets/img/svg/icon-dock.svg";
import IconPopup from "../../../../assets/img/svg/icon-popup.svg";
import IconPip from "../../../../assets/img/svg/icon-pip.svg";
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
              Visit
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
              {isDownloading ? "Saving" : "Save"}
            </Btn>
          )}

          {/* Zoom picker (desktop, non-web, non-video) */}
          {!isMobileSize && fileType !== "web" && fileType !== "video" && (
            <Dropdown
              label={`${Math.round(zoomLevel * 100)}%`}
              primary
              icon={<IconZoom />}
              title="Change Zoom"
              items={[0.5, 0.75, 1, 1.25, 1.5, 2].map((level) => ({
                id: level,
                label:
                  level === 1 ? "100% (Fit)" : `${Math.round(level * 100)}%`,
                active: zoomLevel === level,
                onClick: () => onZoomChange(level),
              }))}
            />
          )}

          {/* Mode picker dropdown */}
          {modeSwitch &&
            (() => {
              const MODE_OPTIONS = [
                { id: "popup", label: "Popup", icon: IconPopup },
                { id: "dock", label: "Dock", icon: IconDock },
                { id: "pip", label: "PiP", icon: IconPip },
              ];
              const activeModeOption =
                MODE_OPTIONS.find((m) => m.id === mode) || MODE_OPTIONS[0];
              const ActiveModeIcon = activeModeOption.icon;

              return (
                <Dropdown
                  label={activeModeOption.label}
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

          {/* Close */}
          <Btn onClick={onClose} title="Close" danger icon={<IconClose />} />
        </div>
      </div>
    </>
  );
}
