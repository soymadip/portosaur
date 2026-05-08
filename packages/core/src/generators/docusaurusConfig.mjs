import fs from "fs";
import path from "path";
import { getGitDate } from "../utils/system.mjs";
import { porto } from "../app.mjs";
import { resolveVars, getNestedValue } from "../utils/config.mjs";
import {
  resolveSiteUrl,
  resolveBasePath,
  createStaticAssetResolver,
  buildHeadTags,
} from "../utils/docusaurus.mjs";

// ------- Main Configuration Generator -------

/**
 * Generates a Docusaurus configuration object from raw user config
 */
export function generateDocusaurusConfig(
  rawUserConfig,
  projectDir,
  context = {},
) {
  const {
    portoPkg = {},
    portoPaths = {},
    gitDate = null,
    env = process.env,
  } = context;

  const portoVersion = portoPkg.version ?? "0.0.0";
  const lastUpdated = gitDate ?? getGitDate(projectDir);

  const staticDir = path.resolve(projectDir, "static");
  const assetsDir = portoPaths.assets ?? "";

  const siteUrl = resolveSiteUrl(rawUserConfig.site?.url ?? "auto", env);
  const sitePath = resolveBasePath(rawUserConfig.site?.path ?? "auto", env);

  const resolveAsset = createStaticAssetResolver(
    projectDir,
    staticDir,
    assetsDir,
  );

  const userConfig = resolveVars(rawUserConfig, rawUserConfig, {
    siteRoot: projectDir,
    portoRoot: context.portoRoot ?? "",
    compileYear: new Date().getFullYear(),
    compileDate: new Date().toLocaleDateString(),
    portoVersion,
    projectVersion: context.projectVersion ?? "0.0.0",
    siteUrl,
    baseUrl: sitePath,
    lastUpdated,
    isProd: env.NODE_ENV === "production",
    isDev: env.NODE_ENV === "development",
    nodeEnv: env.NODE_ENV ?? "development",
    custom: rawUserConfig.custom ?? {},
  });

  const get = (key, ...fallbacks) =>
    getNestedValue(userConfig, key, ...fallbacks);

  const siteName = get("site.title", "Your Name");

  // ------- Configuration Setup -------

  return {
    projectName: siteName,
    title: siteName,
    tagline: get(
      "site.tagline",
      "Short description about you, your passion, your goals etc.",
    ),
    url: siteUrl,
    baseUrl: sitePath,
    favicon: resolveAsset(
      get("site.favicon", ""),
      resolveAsset("favicon/favicon.ico", "img/icon.png"),
    ),
    organizationName: siteName,
    onBrokenAnchors: get("site.on_broken_anchors", "throw"),
    onBrokenLinks: get("site.on_broken_links", "throw"),
    i18n: { defaultLocale: "en", locales: ["en"] },

    headTags: buildHeadTags([
      { meta: { name: "generator", content: `Portosaur v${porto.version}` } },
      { meta: { name: "theme-color", content: "var(--ifm-background-color)" } },
      ...(context.extraHeadTags || []),
      ...get("site.head_tags", []),
    ]),

    // ------- Custom Fields -------

    customFields: {
      portoVersion,

      theme: {
        markdown: {
          mermaid: get("theme.markdown.mermaid", true),
          on_broken_links: get("theme.markdown.on_broken_links", "throw"),
          on_broken_images: get("theme.markdown.on_broken_images", "throw"),
        },

        navigation: {
          collapsable_sidebar: get(
            "theme.navigation.collapsable_sidebar",
            true,
          ),

          hide_navbar_on_scroll: get(
            "theme.navigation.hide_navbar_on_scroll",
            true,
          ),
        },

        appearance: {
          dark_mode: get("theme.appearance.dark_mode", true),
          disable_switch: get("theme.appearance.disable_switch", false),
          disable_branding: get("theme.appearance.disable_branding", false),
        },
      },

      heroSection: {
        profilePic: resolveAsset(
          get("home_page.hero.profile_pic", ""),
          "img/icon.png",
        ),

        intro: get("home_page.hero.intro", "Hello there, I'm"),
        title: get("home_page.hero.title", "site.title", "Your Name"),
        subtitle: get("home_page.hero.subtitle", "I am a"),
        profession: get("home_page.hero.profession", "Your Profession"),
        desc: get("home_page.hero.desc", "Welcome to my portfolio."),
      },

      aboutSection: {
        enable: get("home_page.about.enable", true),
        heading: get("home_page.about.heading", "About Me"),
        image: resolveAsset(get("home_page.about.image", "")),
        bio: get("home_page.about.bio", []),
        skills: get("home_page.about.skills", []),
        skillsHeading: get("home_page.about.skills_heading", "My Skills"),
        resume: get("home_page.about.resume", ""),
      },

      projectShelf: {
        enable: get("home_page.project_shelf.enable", true),
        heading: get("home_page.project_shelf.heading", "My Projects"),
        subheading: get(
          "home_page.project_shelf.subheading",
          "A collection of all my works",
        ),
        autoplay: get("home_page.project_shelf.autoplay", true),
        projects: get("home_page.project_shelf.projects", []),
      },

      experienceSection: {
        enable: get("home_page.experience.enable", false),
        heading: get("home_page.experience.heading", "Experience"),
        subheading: get(
          "home_page.experience.subheading",
          "My professional journey",
        ),
        list: get("home_page.experience.list", []),
      },

      socialSection: {
        enable: get("home_page.social.enable", true),
        heading: get("home_page.social.heading", "Get In Touch"),
        subheading: get(
          "home_page.social.subheading",
          "Feel free to reach out",
        ),
        links: get("home_page.social.links", []),
      },

      tasks: {
        enable: get("tasks.enable", false),
        title: get("tasks.title", "Tasks"),
        subtitle: get("tasks.subtitle", "My current focus"),
        list: get("tasks.list", []),
      },
    },

    // ------- Presets -------

    presets: [
      [
        "@docusaurus/preset-classic",
        {
          docs: {
            routeBasePath: "notes",
            path: "notes",
            sidebarPath: path.resolve(
              portoPaths.theme ?? context.portoRoot ?? "",
              "config/sidebar.jsx",
            ),
          },
          blog: { path: "blog", showReadingTime: false },
          theme: {
            customCss: path.resolve(
              portoPaths.theme ?? context.portoRoot ?? "",
              "css/custom.css",
            ),
          },
        },
      ],
    ],

    // ------- Plugins -------

    plugins: [
      [
        "@docusaurus/plugin-pwa",
        {
          debug: !env.NODE_ENV || env.NODE_ENV === "development",
          offlineModeActivationStrategies: [
            "always",
            "appInstalled",
            "queryString",
            "standalone",
          ],
        },
      ],
    ],
  };
}
