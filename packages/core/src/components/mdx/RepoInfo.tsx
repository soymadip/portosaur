/**
 * RepoInfo — a card linking to a repository on GitHub, GitLab,
 * Codeberg, Forgejo, Gitea or SourceHut, with its description,
 * star and fork counts. The counts are fetched from the
 * provider's API at build time and baked into the page, so a
 * rebuild refreshes them. A token environment variable
 * (GITHUB_TOKEN, GITLAB_TOKEN, CODEBERG_TOKEN, FORGEJO_TOKEN,
 * GITEA_TOKEN or SOURCEHUT_TOKEN) raises the API rate limit;
 * SourceHut needs one for any fetch at all. When the fetch
 * fails the card renders without counts and the build warns,
 * never fails.
 */
import {
  fetchRepositoryInfo,
  formatCount,
  getRepoDisplayName,
  getRepoUrl,
  type RepoProvider,
} from "../../lib/repo-info.ts";
import { SiteIcon } from "../SiteIcon.tsx";
import { Link } from "./Link.tsx";

/**
 * The provider's mark. The icon ids are literals so the build's
 * icon scan picks them up — a computed id would never reach the
 * generated icon module.
 */
function ProviderIcon({ provider }: { provider: RepoProvider }) {
  if (provider === "gitlab") {
    return <SiteIcon icon="si:gitlab" size="20px" />;
  }
  if (provider === "codeberg") {
    return <SiteIcon icon="si:codeberg" size="20px" />;
  }
  if (provider === "forgejo") {
    return <SiteIcon icon="si:forgejo" size="20px" />;
  }
  if (provider === "gitea") {
    return <SiteIcon icon="si:gitea" size="20px" />;
  }
  if (provider === "sourcehut") {
    return <SiteIcon icon="si:sourcehut" size="20px" />;
  }
  return <SiteIcon icon="oc:mark-github-16" size="20px" />;
}

export async function RepoInfo({
  owner,
  repo,
  provider = "github",
  host,
}: {
  /** The repository owner, like `soymadip`. */
  owner: string;
  /** The repository name, like `portosaur`. */
  repo: string;
  /** Where the repo lives: `github`, `gitlab`, `codeberg`, `forgejo`, `gitea` or `sourcehut` (default `github`). */
  provider?: RepoProvider;
  /** The instance the repo lives on, like `git.example.com`. Required for `forgejo` and `gitea`. */
  host?: string;
}) {
  const info = await fetchRepositoryInfo(owner, repo, provider, host);
  return (
    <Link
      href={getRepoUrl(provider, owner, repo, host)}
      className="porto-repo-info"
    >
      <span className="porto-repo-info__head">
        <ProviderIcon provider={provider} />
        <span className="porto-repo-info__name">
          {getRepoDisplayName(provider, owner, repo)}
        </span>
      </span>
      {info?.description ? (
        <span className="porto-repo-info__description">
          {info.description}
        </span>
      ) : null}
      {info && info.stars !== null && info.forks !== null ? (
        <span className="porto-repo-info__counts">
          <span className="porto-repo-info__count">
            <SiteIcon icon="lu:star" size="14px" />
            {formatCount(info.stars)}
          </span>
          <span className="porto-repo-info__count">
            <SiteIcon icon="lu:git-fork" size="14px" />
            {formatCount(info.forks)}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
