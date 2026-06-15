import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { getGitDate } from "../utils/system.mjs";
import { porto } from "../app.mjs";
import { resolveVars, getNestedValue } from "../utils/config.mjs";
import { getPortoDotDir } from "../utils/fs.mjs";
import {
  resolveSiteUrl,
  resolveBasePath,
  createStaticAssetResolver,
  buildHeadTags,
} from "../utils/docusaurus.mjs";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// ------- Main Configuration Generator -------

/**
 * Generates a Docusaurus configuration object from raw user config
 */
export function buildDocuConfig(rawUserConfig, projectDir, context = {}) {
  const { portoPaths = {}, gitDate = null, env = process.env } = context;

  const rawGet = (key, ...fallbacks) =>
    getNestedValue(rawUserConfig, key, ...fallbacks);

  const portoVersion = porto.version ?? "0.0.0";
  const lastUpdated = gitDate ?? getGitDate(projectDir);

  const staticDir = path.resolve(projectDir, "static");
  const assetsDir = portoPaths.assets ?? "";

  const siteUrl = resolveSiteUrl(rawGet("site.url", "auto"), env);
  const sitePath = resolveBasePath(rawGet("site.path", "auto"), env);

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
    vars: rawGet("vars", {}),
  });

  const get = (key, ...fallbacks) =>
    getNestedValue(userConfig, key, ...fallbacks);

  const defaultTheme =
    get("theme.appearance.default_mode", "dark") === "light" ? "light" : "dark";

  const titleName = get("home_page.hero.title", "Your Name");
  const siteName = get("site.title", titleName);
  const siteFavicon = resolveAsset(
    get("site.favicon", ""),
    resolveAsset(get("home_page.hero.profile_pic", ""), "img/icon.png"),
  );

  const siteTagline = get(
    "home_page.hero.desc",
    "site.tagline",
    "Short description about you, your passion, your goals etc.",
  );

  // Collect static directories: local site static/, theme assets/, and portosaur dot-dir.
  const staticDirectories = [
    "static",
    assetsDir,
    getPortoDotDir(projectDir),
  ].filter((dir) => dir && fs.existsSync(dir));

  // Process all head tags (from plugins and user config)
  const allHeadTags = buildHeadTags([
    ...(context.extraHeadTags || []),
    ...get("site.head_tags", []),
  ]);

  // Separate regular head tags from meta tags
  const regularHeadTags = allHeadTags.filter((t) => t.tagName !== "meta");
  const customMetaTags = allHeadTags
    .filter((t) => t.tagName === "meta")
    .map((t) => t.attributes);

  // ------- Configuration Setup -------

  return {
    projectName: siteName,
    title: siteName,
    tagline: siteTagline,
    url: siteUrl,
    baseUrl: sitePath,
    favicon: siteFavicon,
    organizationName: siteName,
    onBrokenAnchors: get("site.on_broken_anchors", "throw"),
    onBrokenLinks: get("site.on_broken_links", "throw"),
    i18n: { defaultLocale: "en", locales: ["en"] },

    staticDirectories,

    headTags: regularHeadTags,

    themeConfig: {
      image: resolveAsset(get("site.social_card", "")) || undefined,
      metadata: [
        { name: "generator", content: `Portosaur v${porto.version}` },
        { name: "theme-color", content: "var(--ifm-background-color)" },
        ...customMetaTags,
      ],
      colorMode: {
        defaultMode: defaultTheme,
        disableSwitch: !get("theme.appearance.show_theme_switch", true),
        respectPrefersColorScheme: false,
      },

      navbar: {
        title: siteName,
        logo: {
          alt: `${siteName} logo`,
          src: siteFavicon,
        },
        hideOnScroll: get("theme.navigation.hide_navbar_on_scroll", true),
        items: [
          {
            type: "search",
            position: "right",
            className: "navbar-search-bar",
          },
          ...(get("home_page.about.enable", true)
            ? [
                {
                  label: "About Me",
                  to: "/#about",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(get("home_page.project_shelf.enable", true)
            ? [
                {
                  label: "Projects",
                  to: "/#projects",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(get("home_page.experience.enable", false)
            ? [
                {
                  label: "Experience",
                  to: "/#experience",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(get("home_page.social.enable", true)
            ? [
                {
                  label: "Contact",
                  to: "/#contact",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          {
            type: "dropdown",
            label: "More",
            position: "right",
            className: "_navbar-more-items",
            items: [
              { label: "Notes", to: "/notes" },
              { label: "Blog", to: "/blog" },
              ...(get("tasks.enable", false)
                ? [{ label: "Tasks", to: "/tasks" }]
                : []),
              ...(!get("theme.appearance.disable_project_link", false)
                ? [
                    {
                      label: `Portosaur v${portoVersion}`,
                      className: "_nav-portosaur-version",
                      href: porto?.homepage ?? "#",
                    },
                  ]
                : []),
            ],
          },
        ],
      },

      docs: {
        sidebar: {
          hideable: get("theme.navigation.collapsable_sidebar", true),
        },
      },

      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },

      markdown: {
        mermaid: get("theme.markdown.mermaid", true),
        emoji: get("theme.markdown.render_emoji_shortcodes", true),
        on_broken_links: get("theme.markdown.on_broken_links", "throw"),
        on_broken_images: get("theme.markdown.on_broken_images", "throw"),
      },

      ...(get("theme.footer.enable", true)
        ? {
            footer: {
              copyright: get(
                "theme.footer.message",
                `© Copyright ${new Date().getFullYear()} ${titleName}.${
                  !get("theme.footer.disable_project_link", false)
                    ? ` | Built with <a href="${porto?.homepage ?? "#"}" target="_blank" rel="noopener noreferrer">Portosaur.</a>`
                    : ""
                }`,
              ),
            },
          }
        : {}),
    },

    // ------- Custom Fields -------

    customFields: {
      portoVersion,

      heroSection: {
        profilePic: resolveAsset(
          get("home_page.hero.profile_pic", ""),
          "img/icon.png",
        ),

        intro: get("home_page.hero.intro", "Hello there, I'm"),
        title: titleName,
        subtitle: get("home_page.hero.subtitle", "I am a"),
        profession: get("home_page.hero.profession", "Your Profession"),
        desc: get("home_page.hero.desc", "Welcome to my portfolio."),
        learnMoreButtonTxt: get(
          "home_page.hero.learn_more_button_txt",
          "Learn More",
        ),
        social: get("home_page.hero.social", []), // @items { name: string, url: string, icon?: string }
      },

      aboutSection: {
        enable: get("home_page.about.enable", true),
        heading: get("home_page.about.heading", "About Me"),
        name: get("site.title", "Your Name"),
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
        // @items { title: string, icon?: string|null, bg?: string, state?: enum[active|completed|maintenance|paused|archived|planned], desc?: string, tags?: array, featured?: boolean, website?: string, repo?: string, demo?: string }
        projects: get("home_page.project_shelf.projects", []),
      },

      experienceSection: {
        enable: get("home_page.experience.enable", false),
        heading: get("home_page.experience.heading", "Experience"),
        subheading: get(
          "home_page.experience.subheading",
          "My professional journey",
        ),
        list: get("home_page.experience.list", []), // @items { company: string, role: string, duration?: string, desc?: string }
      },

      socialSection: {
        enable: get("home_page.social.enable", true),
        heading: get("home_page.social.heading", "Get In Touch"),
        subheading: get(
          "home_page.social.subheading",
          "Feel free to reach out",
        ),
        links: get("home_page.social.links", []), // @items { name: string, url: string, icon?: string, desc?: string }
      },

      tasks: {
        enable: get("tasks.enable", false),
        title: get("tasks.title", "Tasks"),
        subtitle: get("tasks.subtitle", "My current focus"),
        list: get("tasks.list", []), // @items { title: string, status: string, desc?: string, link?: string }
      },

      toolsConfig: {
        linkShortener: {
          enable: get("tools.link_shortener.enable", false),
          deployPath: get("tools.link_shortener.deploy_path", "/l"),
          shortLinks: get("tools.link_shortener.short_links", {}),
        },
      },

      // site.robots_txt is consumed in build.mjs, but we pass it through here
      // so the schema generator discovers it without hardcoding.
      robotsTxt: {
        enable: rawGet("site.robots_txt.enable", true),
        rules: rawGet("site.robots_txt.rules", []),
        customLines: rawGet("site.robots_txt.custom_lines", []),
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
            breadcrumbs: get("theme.navigation.breadcrumbs", true),
            sidebarPath: path.resolve(
              portoPaths.theme ?? context.portoRoot ?? "",
              "config/sidebar.jsx",
            ),
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
          },
          blog: {
            path: "blog",
            showReadingTime: false,
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
            feedOptions: {
              type: get("site.rss.enable", true) ? "all" : null,
              copyright: get(
                "site.rss.copyright",
                `© Copyright ${new Date().getFullYear()} ${siteName}.`,
              ),
              description: get("site.rss.desc", siteTagline),
            },
          },
          theme: {
            customCss: path.resolve(
              portoPaths.theme ?? context.portoRoot ?? "",
              "css/custom.css",
            ),
          },
        },
      ],
    ],

    // ------- Themes -------

    themes: [
      [
        (() => {
          const require = createRequire(import.meta.url);
          return require.resolve("@easyops-cn/docusaurus-search-local", {
            paths: [projectDir, portoPaths.theme ?? context.portoRoot ?? ""],
          });
        })(),
        {
          hashed: true,
          indexDocs: true,
          indexBlog: true,
          indexPages: true,
          docsDir: "notes",
          docsRouteBasePath: "notes",
          searchContextByPaths: ["notes", "blog"],
          highlightSearchTermsOnTargetPage: true,
          explicitSearchResultPath: true,
          hideSearchBarWithNoSearchContext: true,
          searchBarShortcutHint: false,
          language: ["en"],
        },
      ],
      [
        path.join(portoPaths.plugins, "theme.mjs"),
        {
          themeDir: portoPaths.theme,
        },
      ],
    ],

    // ------- Plugins -------

    stylesheets: [
      {
        href: "https://cdn.jsdelivr.net/npm/katex@0.17.0/dist/katex.min.css",
        type: "text/css",
        integrity:
          "sha384-vlBdW0r3AcZO/HboRPznQNowvexd3fY8qHOWkBi5q7KGgqJ+F48+DceybYmrVbmB",
        crossorigin: "anonymous",
      },
    ],

    plugins: [
      ...(env.NODE_ENV === "production"
        ? [
            [
              "@docusaurus/plugin-pwa",
              {
                debug: false,
                offlineModeActivationStrategies: [
                  "appInstalled",
                  "standalone",
                  "queryString",
                  "mobile",
                  "saveData",
                ],
              },
            ],
          ]
        : []),

      // Serve the theme's pages/ directory as page routes.
      // This registers pages/index.jsx → / and pages/tasks.jsx → /tasks etc.
      [
        "@docusaurus/plugin-content-pages",
        {
          id: "portosaur-pages",
          path: path.resolve(
            portoPaths.theme ?? context.portoRoot ?? "",
            "pages",
          ),
        },
      ],
    ],
  };
}
