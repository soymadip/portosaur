"use client";

import { useEffect, useRef, useState } from "react";

/**
 * IconSearch — a live Iconify icon search (OG's component, ported).
 * Queries `api.iconify.design/search` as the user types (300ms
 * debounce), renders results as SVG images from the Iconify CDN,
 * and copies the icon id on click. Up to 48 results per query.
 */
export function IconSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(trimmed)}&limit=48`,
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Iconify search failed (${response.status})`);
          }
          return response.json() as Promise<{ icons?: string[] }>;
        })
        .then((data) => {
          if (requestId.current !== id) {
            return;
          }
          setResults(data.icons ?? []);
          setError(null);
          setLoading(false);
        })
        .catch((err: unknown) => {
          if (requestId.current !== id) {
            return;
          }
          setError(err instanceof Error ? err.message : "Icon search failed");
          setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const copyId = (iconId: string) => {
    void navigator.clipboard.writeText(iconId).then(() => {
      setCopied(iconId);
      window.setTimeout(() => {
        setCopied((current) => (current === iconId ? null : current));
      }, 1500);
    });
  };

  return (
    <div className="porto-icon-search">
      <input
        type="search"
        className="porto-icon-search__input"
        placeholder="Search icons…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Search icons"
      />
      {loading && <p className="porto-icon-search__status">Searching…</p>}
      {error && <p className="porto-icon-search__status">{error}</p>}
      {!loading && !error && query.trim() && results.length === 0 && (
        <p className="porto-icon-search__status">
          No icons found for “{query.trim()}”.
        </p>
      )}
      {copied && <p className="porto-icon-search__status">Copied {copied}</p>}
      {results.length > 0 && (
        <ul className="porto-icon-search__results">
          {results.map((iconId) => (
            <li key={iconId}>
              <button
                type="button"
                className="porto-icon-search__result"
                onClick={() => copyId(iconId)}
                title={iconId}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Iconify CDN SVGs, not Next-optimized images */}
                <img
                  src={`https://api.iconify.design/${iconId.replace(":", "/")}.svg`}
                  alt={iconId}
                  width={24}
                  height={24}
                  loading="lazy"
                />
                <span>{iconId}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
