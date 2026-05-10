import { useState, useEffect, useRef } from "react";
import { LoadingState } from "../components/FeedbackStates";
import styles from "../styles.module.css";

/**
 * Renders a web page inside an iframe with a loading overlay
 * and a timeout-based failure detector.
 */
export default function WebRenderer({ fileUrl, label, onError }) {
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const timeoutRef = useRef(null);

  // Reset loading state and start timeout on URL change
  useEffect(() => {
    setLoaded(false);
    loadedRef.current = false;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (!loadedRef.current) {
        onError?.(
          "The page took too long to respond. It may block embedding or you may be offline.",
        );
      }
    }, 10000);

    return () => clearTimeout(timeoutRef.current);
  }, [fileUrl]);

  const handleLoad = () => {
    setLoaded(true);
    loadedRef.current = true;
    clearTimeout(timeoutRef.current);
  };

  return (
    <div className={styles.webView}>
      {!loaded && <LoadingState />}
      <iframe
        src={fileUrl}
        title={label}
        className={styles.webFrame}
        onLoad={handleLoad}
        style={{
          opacity: loaded ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
      />
    </div>
  );
}
