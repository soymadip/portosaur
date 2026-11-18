"use client";

import { useStaticSearch } from "fumadocs-core/search/client";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { usePortoConfig } from "../../../lib/porto-context.tsx";
import {
  flattenGroups,
  flattenResults,
  groupResults,
} from "../../../lib/search-results.ts";
import { SearchResults, SearchSectionFilter } from "../SearchResults/index.tsx";

/**
 * The interactive search-page body (input + results). A separate
 * client component: the page itself is a server component (it
 * renders SiteShell), and `useSearchParams` needs the Suspense
 * boundary the page wraps this in.
 *
 * Reads `?q=` as the initial query and runs it on mount; typing
 * debounces 200ms before searching. The search index downloads
 * on the first keystroke, never on page load. Results are the same
 * Starlight-style grouped cards the dialog shows, with a Filter
 * row narrowing by docs section and a result count above them.
 */

export function SearchPageBody() {
  const config = usePortoConfig();
  const base = config.site.baseUrl ?? "/";
  const basePrefix = base === "/" ? "" : base.replace(/\/+$/, "");
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const [section, setSection] = useState("All");
  const { onSearchChange, isLoading, data } = useStaticSearch({
    from: `${basePrefix}/api/search`,
  });
  const groups = useMemo(
    () => (data ? groupResults(flattenResults(data.items)) : []),
    [data],
  );

  // The sections the current results span, in first-seen order —
  // the filter's options.
  const sections = useMemo(() => {
    const seen = new Set<string>();
    for (const group of groups) {
      if (group.section) {
        seen.add(group.section);
      }
    }
    return [...seen];
  }, [groups]);

  // A section that no longer has results (the query changed) falls
  // back to All instead of filtering everything away.
  useEffect(() => {
    if (section !== "All" && !sections.includes(section)) {
      setSection("All");
    }
  }, [sections, section]);

  const filteredGroups = useMemo(
    () =>
      section === "All"
        ? groups
        : groups.filter((group) => group.section === section),
    [groups, section],
  );

  const navList = useMemo(
    () => flattenGroups(filteredGroups),
    [filteredGroups],
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

  const showFilteredEmpty =
    query && !isLoading && data && groups.length > 0 && navList.length === 0;

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
      {sections.length > 1 && (
        <div className="porto-search-page__filter">
          <SearchSectionFilter
            sections={sections}
            value={section}
            onChange={setSection}
          />
        </div>
      )}
      <div role="status">
        {!query && (
          <p className="porto-search-page__hint">
            Type to search the documentation.
          </p>
        )}
        {query && isLoading && (
          <p className="porto-search-page__hint">Searching…</p>
        )}
        {query && !isLoading && data && groups.length === 0 && (
          <p className="porto-search-page__hint">
            No results found for “{query}”.
          </p>
        )}
        {showFilteredEmpty && (
          <p className="porto-search-page__hint">
            No results in “{section}” for “{query}”.
          </p>
        )}
        {navList.length > 0 && (
          <>
            <p className="porto-search-page__count">
              {navList.length} result{navList.length === 1 ? "" : "s"} for “
              {query}”.
            </p>
            <SearchResults groups={filteredGroups} query={query} />
          </>
        )}
      </div>
    </>
  );
}
