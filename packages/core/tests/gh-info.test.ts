import { describe, test, expect, spyOn, afterEach } from "bun:test";
import {
  fetchRepositoryInfo,
  formatCount,
} from "../src/lib/gh-info.ts";

/**
 * `gh-info` fetches a repo's star and fork counts for the
 * GhInfo component. The fetch is cached per repo, and any
 * failure warns and returns null instead of throwing, so a bad
 * fetch never breaks the build.
 */

const realFetch = globalThis.fetch;
const realToken = process.env.GITHUB_TOKEN;

afterEach(() => {
  globalThis.fetch = realFetch;
  if (realToken === undefined) {
    delete process.env.GITHUB_TOKEN;
  } else {
    process.env.GITHUB_TOKEN = realToken;
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

describe("fetchRepositoryInfo", () => {
  test("returns the star and fork counts and the description", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        stargazers_count: 42,
        forks_count: 7,
        description: "A cool repo",
      })) as any;
    const info = await fetchRepositoryInfo("owner-a", "repo-a");
    expect(info).toEqual({ stars: 42, forks: 7, description: "A cool repo" });
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
    await fetchRepositoryInfo("owner-b", "repo-b");
    expect(seenHeaders?.Authorization).toBe("Bearer test-token");
  });

  test("a failed response warns and returns null", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({ message: "Not Found" }, 404)) as any;
    const { result, warns } = await captureWarn(() =>
      fetchRepositoryInfo("owner-c", "repo-c"),
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
});
