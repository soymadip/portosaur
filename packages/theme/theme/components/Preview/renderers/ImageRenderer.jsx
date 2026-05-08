import React, { useState } from "react";
import { LoadingState } from "../components/FeedbackStates";
import styles from "../styles.module.css";

export default function ImageRenderer({ fileUrl, label, zoomLevel, onError }) {
  const [loading, setLoading] = useState(true);

  return (
    <div
      className={styles.imageView}
      style={{ "--zoom": zoomLevel, position: "relative" }}
    >
      {loading && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 5, display: "flex" }}
        >
          <LoadingState />
        </div>
      )}
      <div
        className={styles.imageScrollArea}
        style={{ opacity: loading ? 0 : 1, transition: "opacity 0.3s ease" }}
      >
        <img
          src={fileUrl}
          alt={label || ""}
          className={styles.image}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            onError?.("Failed to load image.");
          }}
        />
      </div>
    </div>
  );
}
