/**
 * Resolves site URL based on config or environment
 */
export function resolveSiteUrl(configValue, env = process.env) {
  if (configValue === "auto") {
    if (env.CI_PAGES_URL) {
      return new URL(env.CI_PAGES_URL).origin;
    }
    if (env.GITHUB_ACTIONS === "true") {
      return `https://${env.GITHUB_REPOSITORY_OWNER}.github.io`;
    }
    return "http://localhost";
  }
  return configValue;
}

/**
 * Resolves base path based on config or environment.
 * GitHub user/organization Pages repositories are served from root,
 * while project Pages repositories are served from the repository path.
 */
export function resolveBasePath(configValue, env = process.env) {
  if (configValue === "auto") {
    if (env.CI_PAGES_URL) {
      return new URL(env.CI_PAGES_URL).pathname;
    }
    if (env.GITHUB_ACTIONS === "true") {
      const repo = env.GITHUB_REPOSITORY ?? "";
      const [owner, name] = repo.split("/");
      const rootPagesRepo = `${owner}.github.io`;

      if (name === rootPagesRepo) {
        return "/";
      }

      return `/${name}/`;
    }
    return "/";
  }
  return configValue;
}
