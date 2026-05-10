import { useState, useEffect, useCallback } from "react";
import { resolveUrl } from "../utils";

/**
 * Custom hook to fetch and cache text file content.
 * Returns { content, loading, error, retry }.
 */
export function useFileFetch(path, fileType, isActive) {
  const [cache, setCache] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isActive || !path || fileType !== "text") return;
    if (cache[path] || errors[path]) return;

    setLoading(true);
    fetch(resolveUrl(path))
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.text();
      })
      .then((text) => setCache((prev) => ({ ...prev, [path]: text })))
      .catch((err) => setErrors((prev) => ({ ...prev, [path]: err.message })))
      .finally(() => setLoading(false));
  }, [isActive, path, fileType]);

  const retry = useCallback(() => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[path];
      return next;
    });
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
