import { Suspense } from "react";
import type { PortosaurOptions } from "../../../lib/config.ts";
import { SearchPageBody } from "../SearchPageBody/index.tsx";
import { SiteShell } from "../frame/SiteShell/index.tsx";

/**
 * SearchPage — the search page (`/search`).
 *
 * The title is the bare string "Search the documentation" (no
 * `| Site` suffix — the golden title; the route's metadata sets
 * it). The interactive body (input + results) is a client
 * component wrapped in Suspense — `useSearchParams` requires
 * the boundary under static export.
 */
export function SearchPage({ config }: { config: PortosaurOptions }) {
  return (
    <SiteShell config={config}>
      <div className="porto-search-page">
        <h1>Search the documentation</h1>
        <Suspense>
          <SearchPageBody />
        </Suspense>
      </div>
    </SiteShell>
  );
}
