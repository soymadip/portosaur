import { expect, test, describe } from "bun:test";
import path from "node:path";
import { buildSiteConfig } from "../src/engine/generators/siteConfig.ts";

const projectRoot = process.cwd();
const portoPaths = {
  root: projectRoot,
  assets: path.join(projectRoot, "packages/theme/assets"),
  theme: path.join(projectRoot, "packages/theme/theme"),
  themeRoot: path.join(projectRoot, "packages/theme"),
  plugins: path.join(projectRoot, "packages/theme/src/plugins"),
};

function userPagesEnv() {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY_OWNER: "soymadip",
    GITHUB_REPOSITORY: "soymadip/soymadip.github.io",
  };
}

function projectPagesEnv() {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_REPOSITORY_OWNER: "soymadip",
    GITHUB_REPOSITORY: "soymadip/portosaur",
  };
}

describe("buildSiteConfig", () => {
  test("auto-resolves GitHub user Pages URL and base path from build env", () => {
    const options = buildSiteConfig(
      {
        site: { url: "auto", base_url: "auto" },
        home_page: { hero: { title: "Soymadip" } },
      },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: userPagesEnv() },
    );

    expect(options.site.url).toBe("https://soymadip.github.io");
    expect(options.site.baseUrl).toBe("/");
    expect(options.site.title).toBe("Soymadip");
    expect(options.siteMode).toBe("portfolio");
  });

  test("auto-resolves GitHub project Pages URL and base path from build env", () => {
    const options = buildSiteConfig(
      {
        site: { url: "auto", base_url: "auto" },
        home_page: { hero: { title: "Portosaur" } },
      },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: projectPagesEnv() },
    );

    expect(options.site.url).toBe("https://soymadip.github.io");
    expect(options.site.baseUrl).toBe("/portosaur/");
  });

  test("detects docs mode from docs_home", () => {
    const options = buildSiteConfig(
      { docs_home: { title: "My Docs" } },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );

    expect(options.siteMode).toBe("docs");
    expect(options.site.notesDir).toBe("docs");
    expect(options.site.notesRoute).toBe("docs");
    expect(options.docsHome.title).toBe("My Docs");
  });

  test("defaults the output dir to build and honors site.build.output_dir", () => {
    const defaults = buildSiteConfig(
      {},
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );
    expect(defaults.site.build.outputDir).toBe("build");

    const custom = buildSiteConfig(
      { site: { build: { output_dir: "dist" } } },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );
    expect(custom.site.build.outputDir).toBe("dist");
  });

  test("has no markdown.format key (MDX-only)", () => {
    const options = buildSiteConfig(
      { site: { markdown: { format: "md", mermaid: false } } },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );

    expect(options.site.markdown).not.toHaveProperty("format");
    expect(options.site.markdown.mermaid).toBe(false);
  });

  test("passes custom_css through as string or array", () => {
    const single = buildSiteConfig(
      { theme: { custom_css: "static/custom.css" } },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );
    expect(single.theme.customCss).toBe("static/custom.css");

    const multiple = buildSiteConfig(
      { theme: { custom_css: ["a.css", "b.css"] } },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );
    expect(multiple.theme.customCss).toEqual(["a.css", "b.css"]);
  });

  test("converts preview timeout seconds to milliseconds", () => {
    const options = buildSiteConfig(
      { site: { preview: { timeout: 30 } } },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );

    expect(options.site.preview.timeout).toBe(30000);
  });

  test("resolves home page sections and tasks", () => {
    const options = buildSiteConfig(
      {
        home_page: {
          hero: { title: "Ada", profession: "Engineer" },
          about: { enable: false },
        },
        tasks: {
          enable: true,
          list: [{ title: "Ship it", status: "doing" }],
        },
      },
      process.cwd(),
      { gitDate: "June 26, 2026", portoPaths, env: {} },
    );

    expect(options.homePage.heroSection.title).toBe("Ada");
    expect(options.homePage.heroSection.profession).toBe("Engineer");
    expect(options.homePage.aboutSection.enable).toBe(false);
    expect(options.tasks.enable).toBe(true);
    expect(options.tasks.list).toEqual([{ title: "Ship it", status: "doing" }]);
  });
});
