/**
 * gh-info
 *
 * Fetches a GitHub repository's star and fork counts for the
 * GhInfo component. The fetch runs at build time (the
 * component is a server component, and the site is statically
 * exported), so the counts are baked into the page — a rebuild
 * refreshes them.
 *
 * A `GITHUB_TOKEN` environment variable raises the API rate
 * limit (60 requests an hour without one, shared across the
 * build machine's IP). Any failure — unreachable API, rate
 * limit, unknown repo — warns and returns null, so a bad fetch
 * never breaks the build: the card renders without counts.
 */

export interface RepositoryInfo {
  stars: number;
  forks: number;
  /** The repo's description, or null when it has none. */
  description: string | null;
}

/** One fetch per repo per build, shared across pages. */
const cache = new Map<string, Promise<RepositoryInfo | null>>();

/** Compact counts (1.5K, 2.3M), like Fumadocs. */
const formatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatCount(count: number): string {
  return formatter.format(count);
}

async function fetchOnce(
  owner: string,
  repo: string,
): Promise<RepositoryInfo | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  let response: Response;
  try {
    response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    });
  } catch (error) {
    console.warn(
      `[Portosaur] GhInfo: could not reach the GitHub API for "${owner}/${repo}" — the card renders without counts. (${error})`,
    );
    return null;
  }
  if (!response.ok) {
    console.warn(
      `[Portosaur] GhInfo: the GitHub API returned ${response.status} for "${owner}/${repo}" — the card renders without counts.`,
    );
    return null;
  }
  const data = await response.json();
  if (
    typeof data.stargazers_count !== "number" ||
    typeof data.forks_count !== "number"
  ) {
    console.warn(
      `[Portosaur] GhInfo: the GitHub API returned an unexpected shape for "${owner}/${repo}" — the card renders without counts.`,
    );
    return null;
  }
  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    // The description is optional — a missing or non-string one
    // just means the card shows no description.
    description:
      typeof data.description === "string" ? data.description : null,
  };
}

export function fetchRepositoryInfo(
  owner: string,
  repo: string,
): Promise<RepositoryInfo | null> {
  const key = `${owner}/${repo}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = fetchOnce(owner, repo);
  cache.set(key, promise);
  return promise;
}
