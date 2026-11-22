/**
 * GhInfo — a card linking to a GitHub repository, with its
 * star and fork counts. The counts are fetched from the GitHub
 * API at build time and baked into the page, so a rebuild
 * refreshes them. A `GITHUB_TOKEN` environment variable raises
 * the API rate limit; when the fetch fails the card renders
 * without counts and the build warns, never fails.
 */
import { fetchRepositoryInfo, formatCount } from "../../lib/gh-info.ts";
import { SiteIcon } from "../SiteIcon.tsx";
import { Link } from "./Link.tsx";

export async function GhInfo({
  owner,
  repo,
}: {
  /** The repository owner, like `soymadip`. */
  owner: string;
  /** The repository name, like `portosaur`. */
  repo: string;
}) {
  const info = await fetchRepositoryInfo(owner, repo);
  return (
    <Link
      href={`https://github.com/${owner}/${repo}`}
      className="porto-gh-info"
    >
      <span className="porto-gh-info__head">
        <SiteIcon icon="oc:mark-github-16" size="20px" />
        <span className="porto-gh-info__name">
          {owner}/{repo}
        </span>
      </span>
      {info ? (
        <span className="porto-gh-info__counts">
          <span className="porto-gh-info__count">
            <SiteIcon icon="lu:star" size="14px" />
            {formatCount(info.stars)}
          </span>
          <span className="porto-gh-info__count">
            <SiteIcon icon="lu:git-fork" size="14px" />
            {formatCount(info.forks)}
          </span>
        </span>
      ) : null}
    </Link>
  );
}
