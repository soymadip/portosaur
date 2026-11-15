import { expect, test, describe } from "bun:test";
import {
  getPlatformUserGuess,
  resolvePlatformKey,
} from "../src/utils/index.mjs";

describe("resolvePlatformKey", () => {
  const hostingPlatforms = {
    GitHub: { name: "GitHub Pages" },
    GitLab: { name: "GitLab Pages" },
    CodeBerg: { name: "CodeBerg Pages" },
  };

  test("resolves exact platform keys", () => {
    expect(resolvePlatformKey(hostingPlatforms, "GitHub")).toBe("GitHub");
  });

  test("resolves lowercase platform keys", () => {
    expect(resolvePlatformKey(hostingPlatforms, "github")).toBe("GitHub");
  });

  test("resolves uppercase platform keys", () => {
    expect(resolvePlatformKey(hostingPlatforms, "GITHUB")).toBe("GitHub");
  });

  test("trims platform keys before matching", () => {
    expect(resolvePlatformKey(hostingPlatforms, "  codeberg  ")).toBe(
      "CodeBerg",
    );
  });

  test("returns null for unknown platform keys", () => {
    expect(resolvePlatformKey(hostingPlatforms, "forgejo")).toBeNull();
  });
});

describe("getPlatformUserGuess", () => {
  test("uses GitHub-specific Git config", () => {
    expect(getPlatformUserGuess("GitHub", { "github.user": "octocat" })).toBe(
      "octocat",
    );
  });

  test("uses GitHub remote owner when explicit Git config is missing", () => {
    expect(
      getPlatformUserGuess("GitHub", {
        "remote.origin.url": "git@github.com:soymadip/portosaur.git",
      }),
    ).toBe("soymadip");
  });

  test("uses GitLab-specific Git config", () => {
    expect(getPlatformUserGuess("GitLab", { "gitlab.user": "tanuki" })).toBe(
      "tanuki",
    );
  });

  test("uses GitLab remote owner when explicit Git config is missing", () => {
    expect(
      getPlatformUserGuess("GitLab", {
        "remote.origin.url": "https://gitlab.com/tanuki/project.git",
      }),
    ).toBe("tanuki");
  });

  test("uses Codeberg-specific Git config with Forgejo fallback", () => {
    expect(
      getPlatformUserGuess("CodeBerg", { "forgejo.user": "berg-user" }),
    ).toBe("berg-user");
  });

  test("uses Codeberg remote owner when explicit Git config is missing", () => {
    expect(
      getPlatformUserGuess("CodeBerg", {
        "remote.origin.url": "ssh://git@codeberg.org/berg-user/pages.git",
      }),
    ).toBe("berg-user");
  });

  test("returns empty string when no platform-specific Git config exists", () => {
    expect(getPlatformUserGuess("GitHub", { "user.name": "Octo Cat" })).toBe(
      "",
    );
  });
});

import { isInteractive } from "../src/utils/index.mjs";

describe("isInteractive", () => {
  test("returns true when no options are provided", () => {
    expect(isInteractive({})).toBe(true);
  });

  test("returns true when only install flag is provided", () => {
    expect(isInteractive({ install: false })).toBe(true);
    expect(isInteractive({ install: true })).toBe(true);
  });

  test("returns false when any config flag is provided", () => {
    expect(isInteractive({ projectName: "my-project" })).toBe(false);
    expect(isInteractive({ vcsProvider: "github" })).toBe(false);
    expect(isInteractive({ hosting: "github-pages" })).toBe(false);
    expect(isInteractive({ username: "octocat" })).toBe(false);
    expect(isInteractive({ name: "Octo Cat" })).toBe(false);
  });

  test("returns false when mixed flags are provided", () => {
    expect(isInteractive({ install: false, projectName: "my-project" })).toBe(
      false,
    );
  });
});
