import { withMermaid } from "vitepress-plugin-mermaid";
import taskLists from "markdown-it-task-lists";
import { readFileSync } from "fs";
import { resolve } from "path";
import { resolveVars } from "./plugins/resolveVars.js";
import { autoRedirects } from "./plugins/autoRedirects.js";
import { searchLinks } from "./plugins/searchLinks.js";
import { nav, baseSidebar } from "./navigation.mjs";
import yaml from "js-yaml";

// Read package.json metadata
const portoPkgPath = resolve(process.cwd(), "..", "package.json");
const portoPkgJson = JSON.parse(readFileSync(portoPkgPath, "utf-8"));

// Read Registry to get dynamic defaults
const registryPath = resolve(
  process.cwd(),
  "..",
  "packages/cli/src/templates/registry.yml",
);
const registry = yaml.load(readFileSync(registryPath, "utf-8"));

const metadata = {
  project: {
    title:
      portoPkgJson.name.charAt(0).toUpperCase() + portoPkgJson.name.slice(1),
    desc: "for your digital personality",
    tagLine: portoPkgJson.description,
    repo: (portoPkgJson.repository?.url || "#").replace(/\.git$/, ""),
  },

  // Package Information
  pkg: {
    name: portoPkgJson.name,
    bin: "porto",
  },

  // Versions & Requirements
  versions: {
    porto: portoPkgJson.version || "0.0.0",
    node_min: (portoPkgJson.engines?.node || "24.0+").replace(/>=?\s*/, ""),
  },

  // Dynamic Defaults & Lists
  defaults: {
    vcs: Object.keys(registry.vcs_providers)[0],
    vcsList: Object.keys(registry.vcs_providers).join(", "),
    hostingList: Object.keys(registry.hosting_platforms).join(", "),
  },

  // Tools & Ecosystem
  tools: {
    bun: "https://bun.sh/",
    docusaurus: "https://docusaurus.io/",
    vitepress: "https://vitepress.dev/",
    yaml: "https://yaml.org/",
    staticShort: "https://github.com/soymadip/staticshort",
    git: "https://git-scm.com/",
  },
};

const dynamicNav = [...nav];

const base = process.env.GITHUB_REPOSITORY
  ? `/${process.env.GITHUB_REPOSITORY.split("/")[1]}/`
  : "/";

export default withMermaid({
  base: base,

  vite: {
    publicDir: resolve(process.cwd(), "../packages/theme/assets"),
    plugins: [autoRedirects({ srcDir: "md", base: base })],

    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.message.includes("Rollup cannot interpret")) return;
          warn(warning);
        },
      },
    },
  },

  markdown: {
    config: (md) => {
      md.use((mdInstance) => resolveVars(mdInstance, metadata));
      md.use((mdInstance) => searchLinks(mdInstance));
      md.use(taskLists);
    },
  },

  srcDir: "md",
  cleanUrls: true,

  head: [
    [
      "link",
      { rel: "icon", type: "image/svg+xml", href: `${base}img/svg/icon.svg` },
    ],
  ],

  title: metadata.project.title,
  description: metadata.project.desc,

  transformPageData(pageData) {
    resolveVars(pageData, metadata);
  },

  themeConfig: {
    logo: `${base}img/svg/icon.svg`,
    outline: [2, 3],
    metadata: metadata,

    banner: {
      enabled: true,
      text: "⚠️ Portosaur & This docs is Work In Progress!",
    },

    search: {
      provider: "local",
      options: {
        detailedView: true,
        miniSearch: {},
      },
    },

    nav: dynamicNav,
    sidebar: baseSidebar,

    socialLinks: [{ icon: "github", link: metadata.project.repo }],
  },
});
