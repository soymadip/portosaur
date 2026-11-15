import { useState, useEffect, useCallback } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { resolveUrl } from "../utils";

export function useFileFetch(path, fileType, isActive) {
  const { siteConfig } = useDocusaurusContext();
  const timeoutMs = siteConfig.customFields.preview?.timeout ?? 15000;

  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Incremented by `retry()` to re-trigger the effect after a failure.
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!isActive || !path || fileType !== "text") return;

    // Skip only if content is already cached — errors are cleared before retryCount increments.
    if (cache[path]) return;

    setLoading(true);

    fetch(resolveUrl(path), { signal: AbortSignal.timeout(timeoutMs) })
      .then((r) => {
        if (!r.ok) {
          // HTTP/2 servers often return an empty statusText — always produce a non-empty message.
          const msg =
            r.statusText ||
            (r.status === 404
              ? "The preview resource not found (404)"
              : `Got HTTP error ${r.status}`);
          throw new Error(msg);
        }
        return r.text();
      })
      .then((text) => setCache((prev) => ({ ...prev, [path]: text })))
      .catch((err) => {
        let msg = err.message || "Failed to fetch preview resource";
        if (
          err.name === "TimeoutError" ||
          msg.toLowerCase().includes("timeout")
        ) {
          msg = `Request timed out after ${timeoutMs / 1000}s`;
        }
        setErrors((prev) => ({
          ...prev,
          [path]: msg,
        }));
      })
      .finally(() => setLoading(false));
  }, [isActive, path, fileType, retryCount, timeoutMs]);

  const retry = useCallback(() => {
    // Clear the error first, then bump retryCount to re-trigger the effect.
    setErrors((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
    setRetryCount((c) => c + 1);
  }, [path]);

  const setError = useCallback((p, msg) => {
    setErrors((prev) => ({ ...prev, [p]: msg }));
  }, []);

  return {
    content: cache[path] || null,
    loading,
    error: errors[path] || null,
    errors,
    retry,
    setError,
  };
}
