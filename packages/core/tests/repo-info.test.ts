import { describe, test, expect, spyOn, afterEach } from "bun:test";
import {
  fetchRepositoryInfo,
  formatCount,
  getRepoDisplayName,
  getRepoUrl,
} from "../src/lib/repo-info.ts";

/**
 * `repo-info` fetches a repo's star and fork counts for the
 * RepoInfo component, from GitHub, GitLab, Codeberg, Forgejo,
 * Gitea or SourceHut. The fetch is cached per repo, and any
 * failure warns and returns null instead of throwing, so a bad
 * fetch never breaks the build.
 */

const realFetch = globalThis.fetch;
const realTokens = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  GITLAB_TOKEN: process.env.GITLAB_TOKEN,
  CODEBERG_TOKEN: process.env.CODEBERG_TOKEN,
  FORGEJO_TOKEN: process.env.FORGEJO_TOKEN,
  GITEA_TOKEN: process.env.GITEA_TOKEN,
  SOURCEHUT_TOKEN: process.env.SOURCEHUT_TOKEN,
};

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [key, value] of Object.entries(realTokens)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

/**
 * Run a function with console.warn spied on, restoring it after.
 * Returns the warn calls alongside the function's result, so warn
 * tests stay quiet and can assert on the printed warning.
 */
async function captureWarn<T>(fn: () => Promise<T>): Promise<{
  result: T;
  warns: any[][];
}> {
  // spyOn calls through to the real console.warn by default, so
  // silence it — otherwise warn tests print into the suite output.
  const spy = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const result = await fn();
    return { result, warns: spy.mock.calls };
  } finally {
    spy.mockRestore();
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("formatCount", () => {
  test("small counts stay plain", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(3)).toBe("3");
    expect(formatCount(999)).toBe("999");
  });

  test("large counts compact", () => {
    expect(formatCount(1500)).toBe("1.5K");
    expect(formatCount(2300000)).toBe("2.3M");
  });
});

describe("getRepoUrl", () => {
  test("links to the repo on its provider", () => {
    expect(getRepoUrl("github", "owner", "repo")).toBe(
      "https://github.com/owner/repo",
    );
    expect(getRepoUrl("gitlab", "owner", "repo")).toBe(
      "https://gitlab.com/owner/repo",
    );
    expect(getRepoUrl("codeberg", "owner", "repo")).toBe(
      "https://codeberg.org/owner/repo",
    );
    expect(getRepoUrl("sourcehut", "owner", "repo")).toBe(
      "https://git.sr.ht/~owner/repo",
    );
  });

  test("Forgejo and Gitea link to the given host", () => {
    expect(getRepoUrl("forgejo", "owner", "repo", "git.example.com")).toBe(
      "https://git.example.com/owner/repo",
    );
    expect(
      getRepoUrl("gitea", "owner", "repo", "https://git.example.com/"),
    ).toBe("https://git.example.com/owner/repo");
  });

  test("a missing host throws, since there is no URL to link to", () => {
    expect(() => getRepoUrl("forgejo", "owner", "repo")).toThrow(
      'provider "forgejo" needs a host',
    );
  });
});

describe("getRepoDisplayName", () => {
  test("SourceHut names carry the tilde, with or without one given", () => {
    expect(getRepoDisplayName("sourcehut", "owner", "repo")).toBe(
      "~owner/repo",
    );
    expect(getRepoDisplayName("sourcehut", "~owner", "repo")).toBe(
      "~owner/repo",
    );
    expect(getRepoDisplayName("github", "owner", "repo")).toBe("owner/repo");
  });
});

describe("fetchRepositoryInfo", () => {
  test("reads GitHub counts and the description", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: any) => {
      seenUrl = String(url);
      return jsonResponse({
        stargazers_count: 42,
        forks_count: 7,
        description: "A cool repo",
      });
    }) as any;
    const info = await fetchRepositoryInfo("owner-a", "repo-a");
    expect(seenUrl).toBe("https://api.github.com/repos/owner-a/repo-a");
    expect(info).toEqual({ stars: 42, forks: 7, description: "A cool repo" });
  });

  test("reads GitLab counts from its own keys", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: any) => {
      seenUrl = String(url);
      return jsonResponse({
        star_count: 10,
        forks_count: 2,
        description: "A GitLab repo",
      });
    }) as any;
    const info = await fetchRepositoryInfo("owner-b", "repo-b", "gitlab");
    expect(seenUrl).toBe("https://gitlab.com/api/v4/projects/owner-b%2Frepo-b");
    expect(info).toEqual({ stars: 10, forks: 2, description: "A GitLab repo" });
  });

  test("reads Codeberg counts from its own keys", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: any) => {
      seenUrl = String(url);
      return jsonResponse({
        stars_count: 5,
        forks_count: 1,
        description: null,
      });
    }) as any;
    const info = await fetchRepositoryInfo("owner-c", "repo-c", "codeberg");
    expect(seenUrl).toBe("https://codeberg.org/api/v1/repos/owner-c/repo-c");
    expect(info).toEqual({ stars: 5, forks: 1, description: null });
  });

  test("reads Forgejo counts from its host's Gitea API", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: any) => {
      seenUrl = String(url);
      return jsonResponse({
        stars_count: 9,
        forks_count: 3,
        description: "A Forgejo repo",
      });
    }) as any;
    const info = await fetchRepositoryInfo(
      "owner-m",
      "repo-m",
      "forgejo",
      "git.example.com",
    );
    expect(seenUrl).toBe("https://git.example.com/api/v1/repos/owner-m/repo-m");
    expect(info).toEqual({
      stars: 9,
      forks: 3,
      description: "A Forgejo repo",
    });
  });

  test("reads Gitea counts from its host's API", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        stars_count: 4,
        forks_count: 0,
        description: null,
      })) as any;
    const info = await fetchRepositoryInfo(
      "owner-n",
      "repo-n",
      "gitea",
      "git.example.com",
    );
    expect(info).toEqual({ stars: 4, forks: 0, description: null });
  });

  test("a missing host throws instead of fetching nowhere", async () => {
    expect(() => fetchRepositoryInfo("owner-o", "repo-o", "gitea")).toThrow(
      'provider "gitea" needs a host',
    );
  });

  test("reads a SourceHut description through its GraphQL API", async () => {
    process.env.SOURCEHUT_TOKEN = "sh-token";
    let seenUrl = "";
    let seenInit: any;
    globalThis.fetch = (async (url: any, init: any) => {
      seenUrl = String(url);
      seenInit = init;
      return jsonResponse({
        data: {
          user: { repository: { description: "A SourceHut repo" } },
        },
      });
    }) as any;
    const info = await fetchRepositoryInfo("owner-p", "repo-p", "sourcehut");
    expect(seenUrl).toBe("https://git.sr.ht/query");
    expect(seenInit.method).toBe("POST");
    expect(seenInit.headers.Authorization).toBe("Bearer sh-token");
    expect(JSON.parse(seenInit.body).variables).toEqual({
      username: "owner-p",
      name: "repo-p",
    });
    expect(info).toEqual({
      stars: null,
      forks: null,
      description: "A SourceHut repo",
    });
  });

  test("SourceHut without a token warns and fetches nothing", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse({});
    }) as any;
    const { result, warns } = await captureWarn(() =>
      fetchRepositoryInfo("owner-q", "repo-q", "sourcehut"),
    );
    expect(result).toBeNull();
    expect(calls).toBe(0);
    expect(warns).toHaveLength(1);
    expect(String(warns[0][0])).toContain("SOURCEHUT_TOKEN");
  });

  test("a SourceHut repo that does not exist warns and returns null", async () => {
    process.env.SOURCEHUT_TOKEN = "sh-token";
    globalThis.fetch = (async () =>
      jsonResponse({ data: { user: { repository: null } } })) as any;
    const { result, warns } = await captureWarn(() =>
      fetchRepositoryInfo("owner-r", "repo-r", "sourcehut"),
    );
    expect(result).toBeNull();
    expect(warns).toHaveLength(1);
    expect(String(warns[0][0])).toContain("no repo");
  });

  test("a missing description becomes null, not a failure", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        stargazers_count: 1,
        forks_count: 0,
        description: null,
      })) as any;
    const info = await fetchRepositoryInfo("owner-g", "repo-g");
    expect(info).toEqual({ stars: 1, forks: 0, description: null });
  });

  test("sends the token when GITHUB_TOKEN is set", async () => {
    process.env.GITHUB_TOKEN = "test-token";
    let seenHeaders: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: any, init: any) => {
      seenHeaders = init?.headers;
      return jsonResponse({ stargazers_count: 1, forks_count: 0 });
    }) as any;
    await fetchRepositoryInfo("owner-h", "repo-h");
    expect(seenHeaders?.Authorization).toBe("Bearer test-token");
  });

  test("sends the GitLab token as a Bearer token", async () => {
    process.env.GITLAB_TOKEN = "gl-token";
    let seenHeaders: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: any, init: any) => {
      seenHeaders = init?.headers;
      return jsonResponse({ star_count: 1, forks_count: 0 });
    }) as any;
    await fetchRepositoryInfo("owner-i", "repo-i", "gitlab");
    expect(seenHeaders?.Authorization).toBe("Bearer gl-token");
  });

  test("sends the Codeberg token the way its API expects", async () => {
    process.env.CODEBERG_TOKEN = "cb-token";
    let seenHeaders: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: any, init: any) => {
      seenHeaders = init?.headers;
      return jsonResponse({ stars_count: 1, forks_count: 0 });
    }) as any;
    await fetchRepositoryInfo("owner-j", "repo-j", "codeberg");
    expect(seenHeaders?.Authorization).toBe("token cb-token");
  });

  test("a failed response warns and returns null", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ message: "Not Found" }, 404)) as any;
    const { result, warns } = await captureWarn(() =>
      fetchRepositoryInfo("owner-k", "repo-k"),
    );
    expect(result).toBeNull();
    expect(warns).toHaveLength(1);
    expect(String(warns[0][0])).toContain("404");
  });

  test("a network error warns and returns null", async () => {
    globalThis.fetch = (async () => {
      throw new Error("boom");
    }) as any;
    const { result, warns } = await captureWarn(() =>
      fetchRepositoryInfo("owner-d", "repo-d"),
    );
    expect(result).toBeNull();
    expect(warns).toHaveLength(1);
    expect(String(warns[0][0])).toContain("could not reach");
  });

  test("an unexpected shape warns and returns null", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ stargazers_count: "many" })) as any;
    const { result, warns } = await captureWarn(() =>
      fetchRepositoryInfo("owner-e", "repo-e"),
    );
    expect(result).toBeNull();
    expect(warns).toHaveLength(1);
    expect(String(warns[0][0])).toContain("unexpected shape");
  });

  test("the same repo is fetched once", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse({ stargazers_count: 5, forks_count: 1 });
    }) as any;
    await fetchRepositoryInfo("owner-f", "repo-f");
    await fetchRepositoryInfo("owner-f", "repo-f");
    expect(calls).toBe(1);
  });

  test("the same name on two providers fetches twice", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse({ stargazers_count: 5, forks_count: 1 });
    }) as any;
    await fetchRepositoryInfo("owner-l", "repo-l", "github");
    await fetchRepositoryInfo("owner-l", "repo-l", "gitlab");
    expect(calls).toBe(2);
  });
});
