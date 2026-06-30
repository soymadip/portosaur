import { useEffect, useState } from "react";
import { FaBell, FaBellSlash } from "react-icons/fa";
import styles from "./styles.module.css";

// States the button can be in.
const STATE = {
  UNSUPPORTED: "unsupported", // browser/OS doesn't support the API
  DEFAULT: "default", // permission not yet decided
  GRANTED: "granted", // user already allowed
  DENIED: "denied", // user blocked notifications
};

function getInitialState() {
  // SSR guard
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return STATE.UNSUPPORTED;
  }

  if (!("periodicSync" in ServiceWorkerRegistration.prototype)) {
    return STATE.UNSUPPORTED;
  }

  if (Notification.permission === "granted") {
    return STATE.GRANTED;
  }
  if (Notification.permission === "denied") {
    return STATE.DENIED;
  }

  return STATE.DEFAULT;
}

/**
 * A small "Notify me of new posts" button shown on the blog list page.
 * Only rendered when the browser supports Periodic Background Sync.
 */
export default function NotifyButton() {
  const [state, setState] = useState(STATE.UNSUPPORTED);

  useEffect(() => {
    setState(getInitialState());
  }, []);

  // Don't render anything if the API is unsupported or denied.
  if (state === STATE.UNSUPPORTED || state === STATE.DENIED) {
    return null;
  }

  async function handleClick() {
    if (state === STATE.GRANTED) {
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      setState(STATE.GRANTED);
    } else if (permission === "denied") {
      setState(STATE.DENIED);
    }
  }

  const isSubscribed = state === STATE.GRANTED;

  return (
    <button
      className={styles.notifyBtn}
      onClick={handleClick}
      disabled={isSubscribed}
      title={
        isSubscribed
          ? "You'll be notified of new posts"
          : "Get notified when new posts arrive"
      }
      aria-label={
        isSubscribed ? "Notifications enabled" : "Enable post notifications"
      }
    >
      {isSubscribed ? (
        <>
          <FaBell aria-hidden="true" /> Subscribed
        </>
      ) : (
        <>
          <FaBell aria-hidden="true" /> Notify me of new posts
        </>
      )}
    </button>
  );
}
