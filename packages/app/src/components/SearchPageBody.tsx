"use client";

import {
  useHighlightQuery,
  useStaticSearch,
} from "fumadocs-core/search/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePortoConfig } from "../lib/porto-context.tsx";
import { flattenResults, type FlatResult } from "../lib/search-results.ts";

/**
 * The interactive search-page body (input + results). A separate
 * client component: the page itself is a server component (it
 * renders SiteShell), and `useSearchParams` needs the Suspense
 * boundary the page wraps this in.
 *
 * Reads `?q=` as the initial query and runs it on mount; typing
 * debounces 200ms before searching. The search index downloads
 * on the first keystroke, never on page load.
 */

/** One result entry — its own component so it can call
 * `useHighlightQuery` (one ref callback per element). */
function SearchPageResult({
  result,
  query,
}: {
  result: FlatResult;
  query: string;
}) {
  const highlightRef = useHighlightQuery(query);
  return (
    <li>
      <Link href={result.url} className="porto-search-result">
        {result.breadcrumbs && result.breadcrumbs.length > 0 && (
          <span className="porto-search-result__breadcrumbs">
            {result.breadcrumbs.join(" › ")}
          </span>
        )}
        <span className="porto-search-result__excerpt" ref={highlightRef}>
          {result.type === "heading" ? "# " : ""}
          {result.content}
        </span>
      </Link>
    </li>
  );
}

export function SearchPageBody() {
  const config = usePortoConfig();
  const base = config.site.baseUrl ?? "/";
  const basePrefix = base === "/" ? "" : base.replace(/\/+$/, "");
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const { onSearchChange, isLoading, data } = useStaticSearch({
    from: `${basePrefix}/api/search`,
  });
  const results = useMemo(
    () => (data ? flattenResults(data.items) : []),
    [data],
  );

  // Run the initial `?q=` query on mount.
  useEffect(() => {
    if (initialQuery) {
      onSearchChange(initialQuery);
    }
    // Runs once, on mount — `initialQuery` is the mount-time value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce typing 200ms before searching.
  useEffect(() => {
    if (query === initialQuery) {
      return;
    }
    const timer = window.setTimeout(() => {
      onSearchChange(query);
    }, 200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query, initialQuery, onSearchChange]);

  return (
    <>
      <input
        id="porto-search-input"
        type="search"
        placeholder="Search the documentation…"
        aria-label="Search the documentation"
        autoComplete="off"
        className="porto-search-page__input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div role="status">
        {!query && (
          <p className="porto-search-page__hint">
            Type to search the documentation.
          </p>
        )}
        {query && isLoading && (
          <p className="porto-search-page__hint">Searching…</p>
        )}
        {query && !isLoading && data && results.length === 0 && (
          <p className="porto-search-page__hint">
            No results found for “{query}”.
          </p>
        )}
        {results.length > 0 && (
          <ul className="porto-search-results">
            {results.map((result) => (
              <SearchPageResult key={result.id} result={result} query={query} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
