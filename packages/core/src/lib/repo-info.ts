/**
 * repo-info
 *
 * Fetches a repository's star and fork counts and description
 * for the RepoInfo component, from GitHub, GitLab, Codeberg,
 * Forgejo, Gitea or SourceHut. The fetch runs at build time
 * (the component is a server component, and the site is
 * statically exported), so the numbers are baked into the page
 * — a rebuild refreshes them.
 *
 * Each VCS provider has its own token environment variable
 * (GITHUB_TOKEN, GITLAB_TOKEN, CODEBERG_TOKEN, FORGEJO_TOKEN,
 * GITEA_TOKEN, SOURCEHUT_TOKEN) to raise its rate limit.
 * SourceHut needs a token for any fetch at all — without one
 * the card renders without a description. Any failure —
 * unreachable API, rate limit, unknown repo — warns and
 * returns null, so a bad fetch never breaks the build: the
 * card renders without counts.
 *
 * Forgejo and Gitea are self-hosted, so they need a `host`
 * (the instance the repo lives on, like `git.example.com`).
 * Without one the build fails with a clear message — there is
 * no URL to fetch or link to.
 */

export type RepoProvider =
  | "github"
  | "gitlab"
  | "codeberg"
  | "forgejo"
  | "gitea"
  | "sourcehut";

export interface RepositoryInfo {
  /** Null when the provider has no star count (SourceHut). */
  stars: number | null;
  /** Null when the provider has no fork count (SourceHut). */
  forks: number | null;
  /** The repo's description, or null when it has none. */
  description: string | null;
}

interface ProviderConfig {
  apiUrl: (owner: string, repo: string, host?: string) => string;
  siteUrl: (owner: string, repo: string, host?: string) => string;
  /** Extra request headers, beyond the auth token. */
  headers: Record<string, string>;
  tokenEnv: string;
  /** The auth scheme the provider's API expects. */
  authScheme: "Bearer" | "token";
  /** The response keys holding the counts, or null when the provider has none. */
  starsKey: string | null;
  forksKey: string | null;
  /** True when the author must pass a host (self-hosted forges). */
  needsHost: boolean;
}

/** Forgejo and Gitea share one API shape, so they share one config. */
function giteaConfig(tokenEnv: string): ProviderConfig {
  return {
    apiUrl: (_owner, repo, host) =>
      `https://${host}/api/v1/repos/${_owner}/${repo}`,
    siteUrl: (owner, repo, host) => `https://${host}/${owner}/${repo}`,
    headers: {},
    tokenEnv,
    authScheme: "token",
    starsKey: "stars_count",
    forksKey: "forks_count",
    needsHost: true,
  };
}

const PROVIDERS: Record<RepoProvider, ProviderConfig> = {
  github: {
    apiUrl: (owner, repo) => `https://api.github.com/repos/${owner}/${repo}`,
    siteUrl: (owner, repo) => `https://github.com/${owner}/${repo}`,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    tokenEnv: "GITHUB_TOKEN",
    authScheme: "Bearer",
    starsKey: "stargazers_count",
    forksKey: "forks_count",
    needsHost: false,
  },
  gitlab: {
    // The whole path is one segment of the URL, so a GitLab
    // owner can itself be a group path (group/subgroup).
    apiUrl: (owner, repo) =>
      `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}`,
    siteUrl: (owner, repo) => `https://gitlab.com/${owner}/${repo}`,
    headers: {},
    tokenEnv: "GITLAB_TOKEN",
    authScheme: "Bearer",
    starsKey: "star_count",
    forksKey: "forks_count",
    needsHost: false,
  },
  codeberg: {
    apiUrl: (owner, repo) =>
      `https://codeberg.org/api/v1/repos/${owner}/${repo}`,
    siteUrl: (owner, repo) => `https://codeberg.org/${owner}/${repo}`,
    headers: {},
    tokenEnv: "CODEBERG_TOKEN",
    authScheme: "token",
    starsKey: "stars_count",
    forksKey: "forks_count",
    needsHost: false,
  },
  forgejo: giteaConfig("FORGEJO_TOKEN"),
  gitea: giteaConfig("GITEA_TOKEN"),
  sourcehut: {
    // SourceHut's REST API is gone; the description comes from
    // its GraphQL API, which fetchSourceHut calls directly.
    // This URL is never fetched — it only exists so the config
    // stays complete.
    apiUrl: () => "https://git.sr.ht/query",
    siteUrl: (owner, repo) =>
      `https://git.sr.ht/${sourceHutUser(owner)}/${repo}`,
    headers: {},
    tokenEnv: "SOURCEHUT_TOKEN",
    authScheme: "Bearer",
    starsKey: null,
    forksKey: null,
    needsHost: false,
  },
};

/** SourceHut usernames carry a `~` prefix; accept it either way. */
function sourceHutUser(owner: string): string {
  return owner.startsWith("~") ? owner : `~${owner}`;
}

/** How the repo name shows on the card (`~user/repo` on SourceHut). */
export function getRepoDisplayName(
  provider: RepoProvider,
  owner: string,
  repo: string,
): string {
  if (provider === "sourcehut") {
    return `${sourceHutUser(owner)}/${repo}`;
  }
  return `${owner}/${repo}`;
}

/** Strips a protocol and trailing slashes from a host. */
function normalizeHost(host: string): string {
  return host.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/** Throws when a self-hosted provider has no host to talk to. */
function requireHost(
  provider: RepoProvider,
  host?: string,
): string | undefined {
  if (!PROVIDERS[provider].needsHost) {
    return undefined;
  }
  if (!host) {
    throw new Error(
      `[Portosaur] RepoInfo: provider "${provider}" needs a host, like host="git.example.com".`,
    );
  }
  return normalizeHost(host);
}

/** The public page of a repo on its VCS provider. */
export function getRepoUrl(
  provider: RepoProvider,
  owner: string,
  repo: string,
  host?: string,
): string {
  return PROVIDERS[provider].siteUrl(
    owner,
    repo,
    requireHost(provider, host),
  );
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

/** The description is optional — a missing or non-string one just means no description. */
function readDescription(data: any): string | null {
  return typeof data.description === "string" ? data.description : null;
}

/**
 * Fetches a SourceHut repo's description from the git.sr.ht
 * GraphQL API. SourceHut has no star or fork counts, so those
 * always come back null. The API needs a token for any query —
 * without one the card renders without a description.
 */
async function fetchSourceHut(
  owner: string,
  repo: string,
): Promise<RepositoryInfo | null> {
  const token = process.env.SOURCEHUT_TOKEN;
  if (!token) {
    console.warn(
      `[Portosaur] RepoInfo: SourceHut needs a SOURCEHUT_TOKEN to fetch the description — the card renders without one.`,
    );
    return null;
  }
  const user = sourceHutUser(owner).slice(1);
  let response: Response;
  try {
    response = await fetch("https://git.sr.ht/query", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query:
          "query($username: String!, $name: String!) { user(username: $username) { repository(name: $name) { description } } }",
        variables: { username: user, name: repo },
      }),
    });
  } catch (error) {
    console.warn(
      `[Portosaur] RepoInfo: could not reach the SourceHut API for "${sourceHutUser(owner)}/${repo}" — the card renders without a description. (${error})`,
    );
    return null;
  }
  if (!response.ok) {
    console.warn(
      `[Portosaur] RepoInfo: the SourceHut API returned ${response.status} for "${sourceHutUser(owner)}/${repo}" — the card renders without a description.`,
    );
    return null;
  }
  const data = await response.json();
  const repository = data?.data?.user?.repository;
  if (!repository) {
    console.warn(
      `[Portosaur] RepoInfo: the SourceHut API returned no repo for "${sourceHutUser(owner)}/${repo}" — the card renders without a description.`,
    );
    return null;
  }
  return {
    stars: null,
    forks: null,
    description: readDescription(repository),
  };
}

async function fetchOnce(
  owner: string,
  repo: string,
  provider: RepoProvider,
  host?: string,
): Promise<RepositoryInfo | null> {
  if (provider === "sourcehut") {
    return fetchSourceHut(owner, repo);
  }
  const config = PROVIDERS[provider];
  const headers: Record<string, string> = { ...config.headers };
  const token = process.env[config.tokenEnv];
  if (token) {
    headers.Authorization = `${config.authScheme} ${token}`;
  }
  let response: Response;
  try {
    response = await fetch(config.apiUrl(owner, repo, host), { headers });
  } catch (error) {
    console.warn(
      `[Portosaur] RepoInfo: could not reach the ${provider} API for "${owner}/${repo}" — the card renders without counts. (${error})`,
    );
    return null;
  }
  if (!response.ok) {
    console.warn(
      `[Portosaur] RepoInfo: the ${provider} API returned ${response.status} for "${owner}/${repo}" — the card renders without counts.`,
    );
    return null;
  }
  const data = await response.json();
  const stars = config.starsKey ? data[config.starsKey] : null;
  const forks = config.forksKey ? data[config.forksKey] : null;
  if (
    (config.starsKey && typeof stars !== "number") ||
    (config.forksKey && typeof forks !== "number")
  ) {
    console.warn(
      `[Portosaur] RepoInfo: the ${provider} API returned an unexpected shape for "${owner}/${repo}" — the card renders without counts.`,
    );
    return null;
  }
  return { stars, forks, description: readDescription(data) };
}

export function fetchRepositoryInfo(
  owner: string,
  repo: string,
  provider: RepoProvider = "github",
  host?: string,
): Promise<RepositoryInfo | null> {
  const normalizedHost = requireHost(provider, host);
  const key = `${provider}:${normalizedHost ?? ""}:${owner}/${repo}`;
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }
  const promise = fetchOnce(owner, repo, provider, normalizedHost);
  cache.set(key, promise);
  return promise;
}
