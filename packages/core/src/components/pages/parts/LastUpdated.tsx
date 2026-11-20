/**
 * "Last updated {date}" — Portosaur passes a preformatted date
 * string (e.g. "November 14, 2026"), not a Date, so there is no
 * `<time datetime>` or locale formatting here — the string renders
 * as given.
 */
export function LastUpdated({ lastUpdated }: { lastUpdated?: string }) {
  if (!lastUpdated) {
    return null;
  }
  return <p>Last updated {lastUpdated}</p>;
}
