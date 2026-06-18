import styles from "../styles.module.css";

export default function VideoRenderer({ fileUrl, onError }) {
  return (
    <div className={styles.videoView}>
      <video
        src={fileUrl}
        controls
        autoPlay
        playsInline
        onError={() =>
          onError?.(
            "Failed to load video. The format may not be supported by your browser.",
          )
        }
        className={styles.videoPlayer}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          background: "var(--ifm-background-color)",
        }}
      />
    </div>
  );
}
