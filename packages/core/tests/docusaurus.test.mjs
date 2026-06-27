import { expect, test, describe } from "bun:test";
import path from "path";
import { buildDocuConfig } from "../src/generators/docusaurusConfig.mjs";
import { resolveBasePath } from "../src/utils/docusaurus.mjs";

const projectRoot = process.cwd();
const portoPaths = {
  root: projectRoot,
  assets: path.join(projectRoot, "packages/theme/assets"),
  theme: path.join(projectRoot, "packages/theme/theme"),
  plugins: path.join(projectRoot, "packages/theme/src/plugins"),
};

describe("resolveBasePath", () => {
  test("resolves GitHub user Pages repositories to root", () => {
    const basePath = resolveBasePath("auto", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "soymadip/soymadip.github.io",
    });

    expect(basePath).toBe("/");
  });

  test("resolves GitHub project Pages repositories to repository path", () => {
    const basePath = resolveBasePath("auto", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "soymadip/portosaur",
    });

    expect(basePath).toBe("/portosaur/");
  });

  test("keeps explicit base paths unchanged", () => {
    const basePath = resolveBasePath("/portfolio/", {
      GITHUB_ACTIONS: "true",
      GITHUB_REPOSITORY: "soymadip/soymadip.github.io",
    });

    expect(basePath).toBe("/portfolio/");
  });
});

describe("buildDocuConfig", () => {
  test("auto-resolves GitHub user Pages URL and base path from build env", () => {
    const config = buildDocuConfig(
      {
        site: {
          url: "auto",
          base_url: "auto",
        },
        home_page: {
          hero: {
            title: "Soymadip",
          },
        },
      },
      process.cwd(),
      {
        gitDate: "June 26, 2026",
        portoPaths,
        env: {
          GITHUB_ACTIONS: "true",
          GITHUB_REPOSITORY_OWNER: "soymadip",
          GITHUB_REPOSITORY: "soymadip/soymadip.github.io",
        },
      },
    );

    expect(config.url).toBe("https://soymadip.github.io");
    expect(config.baseUrl).toBe("/");
  });

  test("auto-resolves GitHub project Pages URL and base path from build env", () => {
    const config = buildDocuConfig(
      {
        site: {
          url: "auto",
          base_url: "auto",
        },
        home_page: {
          hero: {
            title: "Portosaur",
          },
        },
      },
      process.cwd(),
      {
        gitDate: "June 26, 2026",
        portoPaths,
        env: {
          GITHUB_ACTIONS: "true",
          GITHUB_REPOSITORY_OWNER: "soymadip",
          GITHUB_REPOSITORY: "soymadip/portosaur",
        },
      },
    );

    expect(config.url).toBe("https://soymadip.github.io");
    expect(config.baseUrl).toBe("/portosaur/");
  });
});
