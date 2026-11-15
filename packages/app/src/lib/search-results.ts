import type { SearchResultItem } from "fumadocs-core/search/client";

/**
 * Shared search-result shape for the search dialog and the search
 * page: ZBSearch items flattened so table rows become one entry
 * each.
 */

export interface FlatResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
  breadcrumbs?: string[];
}

/** Flattens search items: table rows become one entry each. */
export function flattenResults(items: SearchResultItem[]): FlatResult[] {
  const flat: FlatResult[] = [];
  for (const item of items) {
    if (item.type === "table") {
      for (const row of item.rows) {
        flat.push({
          id: row.id,
          url: row.url,
          type: row.type,
          content: row.content,
          breadcrumbs: row.breadcrumbs,
        });
      }
      continue;
    }
    flat.push({
      id: item.id,
      url: item.url,
      type: item.type,
      content: item.content,
      breadcrumbs: item.breadcrumbs,
    });
  }
  return flat;
}
