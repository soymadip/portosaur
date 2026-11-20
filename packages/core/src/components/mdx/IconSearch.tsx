"use client";

import { useEffect, useRef, useState } from "react";
import { getIconData, iconToSVG } from "@iconify/utils";
import { Dropdown } from "../Dropdown.tsx";
import { iconPacks } from "../../lib/iconPrefixes.ts";

/**
 * IconSearch — a live Iconify icon search (OG's component, ported).
 * Queries `api.iconify.design/search` as the user types (300ms
 * debounce), restricted to the icon packs the site actually
 * bundles, so every result is an icon the site can render. The
 * result icons arrive as inline SVGs, fetched one request per
 * pack instead of one image request per icon, and clicking a
 * result copies its shorthand id (`lu:search`). Up to 48 results
 * per query.
 */

const PREFIXES = Object.keys(iconPacks).join(",");

const PREFIX_OPTIONS = [
  { label: "All", value: "all" },
  ...Object.entries(iconPacks).map(([canonical, data]) => ({
    label: data.name,
    value: canonical,
  })),
];

/* Canonical prefix -> primary shorthand (`lucide` -> `lu`), for
   the ids users copy and the labels under the results. */
function getShorthand(canonical: string) {
  return iconPacks[canonical]?.shorthands[0] || canonical;
}

function shortId(iconId: string) {
  const [prefix, name] = iconId.split(":");
  if (!prefix || !name) {
    return iconId;
  }
  return `${getShorthand(prefix)}:${name}`;
}

/** Escapes a value for an HTML attribute (double-quoted). */
function escapeAttr(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* Renders one fetched icon as an inline SVG string, the way
   `SiteIcon` does — same `iconToSVG` call, same attributes.
   Returns "" when the data doesn't resolve. */
function renderFetchedIcon(collection: unknown, name: string): string {
  const iconData = getIconData(
    collection as Parameters<typeof getIconData>[0],
    name,
  );
  if (!iconData) {
    return "";
  }
  const rendered = iconToSVG(iconData, { height: "1em", width: "1em" });
  if (!rendered) {
    return "";
  }
  const attributes = Object.entries(rendered.attributes)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(" ");
  /* `fill="currentColor"` is the fallback color, same as
     `SiteIcon` — a bare path would otherwise render black on a
     dark background. */
  return `<svg ${attributes} fill="currentColor" aria-hidden="true">${rendered.body}</svg>`;
}

export function IconSearch({ dropUp = false }: { dropUp?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [results, setResults] = useState<string[]>([]);
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /* Escape dismisses the panel without clearing the query —
     typing or focusing the input opens it again. */
  const [dismissed, setDismissed] = useState(false);
  const requestId = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* A new query or filter reopens a dismissed panel. */
    setDismissed(false);
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSvgs({});
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      const activePrefixes = filter === "all" ? PREFIXES : filter;
      fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(trimmed)}&prefixes=${activePrefixes}&limit=48`,
      )
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Iconify search failed (${response.status})`);
          }
          return response.json() as Promise<{ icons?: string[] }>;
        })
        .then(async (data) => {
          if (requestId.current !== id) {
            return;
          }
          const icons = data.icons ?? [];
          setResults(icons);
          setError(null);
          setLoading(false);
          /* The icons themselves arrive separately, one request
             per pack — the search already told us which packs
             the results come from. A pack that fails to load
             just shows its results without a preview. The label
             and the copy still work. */
          const byPrefix = new Map<string, string[]>();
          for (const iconId of icons) {
            const [prefix, name] = iconId.split(":");
            if (!prefix || !name) {
              continue;
            }
            const names = byPrefix.get(prefix) ?? [];
            names.push(name);
            byPrefix.set(prefix, names);
          }
          const next: Record<string, string> = {};
          await Promise.all(
            [...byPrefix.entries()].map(async ([prefix, names]) => {
              try {
                const response = await fetch(
                  `https://api.iconify.design/${prefix}.json?icons=${names.map(encodeURIComponent).join(",")}`,
                );
                if (!response.ok) {
                  return;
                }
                const collection: unknown = await response.json();
                for (const name of names) {
                  const svg = renderFetchedIcon(collection, name);
                  if (svg) {
                    next[`${prefix}:${name}`] = svg;
                  }
                }
              } catch {
                /* A pack's icons failing to load must not wipe
                   out the results list. */
              }
            }),
          );
          if (requestId.current !== id) {
            return;
          }
          setSvgs(next);
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
  }, [query, filter]);

  /* Escape closes the panel while it is open. A search input
     clears itself on Escape, so the default is stopped — the
     query survives and only the panel closes. The listener runs
     in the capture phase, ahead of the filter menu's own Escape
     handler, so the menu gets the first Escape and the panel
     the next. */
  const panelOpen = !dismissed && query.trim() !== "";
  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      if (containerRef.current?.querySelector("details[open]")) {
        return;
      }
      setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [panelOpen]);

  const copyId = (iconId: string) => {
    void navigator.clipboard.writeText(shortId(iconId)).then(
      () => {
        setCopied(iconId);
        window.setTimeout(() => {
          setCopied((current) => (current === iconId ? null : current));
        }, 1500);
      },
      () => {
        /* Clipboard unavailable (permissions, insecure context) —
           the copy silently fails. Nothing to show for it. */
      },
    );
  };

  /* `not-content` opts the whole picker out of the markdown prose
     styles — without it the prose `ul` rules put bullets on the
     results list. */
  const containerClassName = [
    "porto-icon-search",
    "not-content",
    dropUp ? "porto-icon-search--drop-up" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClassName} ref={containerRef}>
      <div className="porto-icon-search__bar">
        <input
          type="search"
          className="porto-icon-search__input"
          placeholder="Search icons…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setDismissed(false)}
          aria-label="Search icons"
        />
        {query.trim() && !loading && (
          <span className="porto-icon-search__count">
            {results.length} {results.length === 1 ? "match" : "matches"}
          </span>
        )}
        <Dropdown
          label={
            PREFIX_OPTIONS.find((option) => option.value === filter)?.label ??
            "All"
          }
          items={PREFIX_OPTIONS.map((option) => ({
            label: option.label,
            onClick: () => setFilter(option.value),
            active: filter === option.value,
          }))}
          size="sm"
          align="right"
          dropUp={dropUp}
          ariaLabel="Filter icons by pack"
        />
      </div>
      {!dismissed && (
        <>
          {loading && results.length === 0 && (
            <p className="porto-icon-search__status">Searching…</p>
          )}
          {error && results.length === 0 && (
            <p className="porto-icon-search__status">{error}</p>
          )}
          {!loading && !error && query.trim() && results.length === 0 && (
            <p className="porto-icon-search__status">
              No icons found for “{query.trim()}”.
            </p>
          )}
          {results.length > 0 && (
            <ul className="porto-icon-search__results">
              {results.map((iconId) => (
                <li key={iconId}>
                  <button
                    type="button"
                    className="porto-icon-search__result"
                    onClick={() => copyId(iconId)}
                    title={`Copy ${shortId(iconId)}`}
                  >
                    <span className="porto-icon-search__preview">
                      {svgs[iconId] ? (
                        <span
                          dangerouslySetInnerHTML={{ __html: svgs[iconId] }}
                        />
                      ) : (
                        /* eslint-disable-next-line @next/next/no-img-element -- Iconify CDN SVGs, not Next-optimized images */
                        <img
                          src={`https://api.iconify.design/${iconId.replace(":", "/")}.svg`}
                          alt=""
                          width={24}
                          height={24}
                          loading="lazy"
                        />
                      )}
                    </span>
                    <span>
                      {copied === iconId ? "Copied!" : shortId(iconId)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
