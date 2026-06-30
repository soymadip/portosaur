import styles from "../../../styles.module.css";
import { useViewer } from "../index.jsx";

export default function MobileDockLayout({ isVisible, children, peekHeight }) {
  const { mobileDockRef, handlePointerMove, handlePointerUp } = useViewer();

  return (
    <div
      ref={mobileDockRef}
      className={`${styles.previewSystem} ${styles.modeMobileDock} ${isVisible ? styles.pvVisible : ""}`}
      style={{
        "--mobile-dock-height": `${peekHeight}px`,
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: `${peekHeight}px`,
        zIndex: 90,
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {children}
    </div>
  );
}
