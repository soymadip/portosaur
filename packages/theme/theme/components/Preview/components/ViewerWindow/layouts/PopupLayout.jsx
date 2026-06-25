import { useEffect } from "react";
import styles from "../../../styles.module.css";

export default function PopupLayout({
  isVisible,
  children,
  closePreview,
  isMobileOrTablet,
}) {
  // Lock body scroll when popup is open
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isVisible]);

  return (
    <>
      <div
        className={`${styles.previewBackdrop} ${isVisible ? styles.pvVisible : ""}`}
        onClick={closePreview}
      />
      <div
        className={`${styles.previewSystem} ${styles.modePopup} ${isMobileOrTablet ? styles.modePopupPhone : ""} ${isVisible ? styles.pvVisible : ""}`}
      >
        {children}
      </div>
    </>
  );
}
