import styles from "../styles.module.css";

export function LoadingState() {
  return (
    <div className={styles.loading}>
      <div className={styles.loadingIcon}>
        <div className={styles.spinner} />
      </div>
      <div className={styles.loadingText}>
        <p>Preparing preview...</p>
        <span>Fetching content from source</span>
      </div>
    </div>
  );
}

export function ErrorState({ path, message, fileType, fileUrl, onRetry }) {
  return (
    <div className={styles.errorState}>
      <div className={styles.errorIcon}>⚠️</div>
      <p>
        Could not load: <code>{path?.split("/").pop()}</code>
      </p>
      <p className={styles.errorMsg}>{message}</p>
      <div className={styles.errorActions}>
        <button onClick={onRetry} className={styles.retryButton}>
          Retry
        </button>
        {fileType === "web" && (
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener"
            className={styles.visitButton}
          >
            Visit Website
          </a>
        )}
      </div>
    </div>
  );
}

export function OfflineState({ onRetry }) {
  return (
    <div className={styles.errorState}>
      <div className={styles.errorIcon}>📡</div>
      <h3>No Connection</h3>
      <p>This resource requires an active internet connection.</p>
      <button onClick={onRetry} className={styles.retryButton}>
        Try Again
      </button>
    </div>
  );
}
