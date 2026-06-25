import styles from "../styles.module.css";
import { Btn } from "../../UI/index.jsx";
import IconWarning from "../../../../assets/img/svg/icon-warning.svg";
import IconOffline from "../../../../assets/img/svg/icon-offline.svg";
import IconRetry from "../../../../assets/img/svg/icon-retry.svg";

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

function BaseErrorState({ icon, title, description, actions }) {
  return (
    <div className={styles.errorState}>
      <div className={styles.errorIcon}>{icon}</div>
      <h3>{title}</h3>
      {description}
      {actions && <div className={styles.errorActions}>{actions}</div>}
    </div>
  );
}

export function ErrorState({ path, message, fileType, fileUrl, onRetry }) {
  return (
    <BaseErrorState
      icon={<IconWarning className={styles.warningIcon} />}
      title="Failed to Load"
      description={
        <>
          <p>
            Could not load: <code>{path?.split("/").pop()}</code>
          </p>
          {message && message !== "Failed to load image." && (
            <p className={styles.errorMsg}>{message}</p>
          )}
        </>
      }
      actions={
        <>
          <Btn primary onClick={onRetry} icon={<IconRetry />}>
            Try Again
          </Btn>
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
        </>
      }
    />
  );
}

export function OfflineState({ onRetry }) {
  return (
    <BaseErrorState
      icon={<IconOffline className={styles.offlineIcon} />}
      title="No Connection"
      description={<p>This resource requires an active internet connection.</p>}
      actions={
        <Btn primary onClick={onRetry} icon={<IconRetry />}>
          Try Again
        </Btn>
      }
    />
  );
}
