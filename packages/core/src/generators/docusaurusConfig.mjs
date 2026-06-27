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
  createSidebarItemsGenerator,
  cleanFrontMatterSlug,
  getThemeColorSyncScript,
  resolveSiteCssFiles,
  DEFAULT_COLOR_SCHEME,
} from "../utils/docusaurus.mjs";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { prismThemeMap } from "../config/prism.mjs";

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
  const portoStaticDir = portoPaths.static ?? "";

  const siteUrl = resolveSiteUrl(rawGet("site.url", "auto"), env);
  const sitePath = resolveBasePath(rawGet("site.base_url", "auto"), env);

  const resolveAsset = createStaticAssetResolver(
    projectDir,
    staticDir,
    portoStaticDir,
  );

  const userConfig = resolveVars(rawUserConfig, rawUserConfig, {
    site_root: projectDir,
    porto_static: portoStaticDir,
    compile_year: new Date().getFullYear(),
    compile_date: new Date().toLocaleDateString(),
    porto_version: portoVersion,
    project_version: context.projectVersion ?? "0.0.0",
    site_url: siteUrl,
    base_url: sitePath,
    last_updated: lastUpdated,
    is_prod: env.NODE_ENV === "production",
    is_dev: env.NODE_ENV === "development",
    node_env: env.NODE_ENV ?? "development",
    vars: rawGet("vars", {}),
  });

  const get = (key, ...fallbacks) =>
    getNestedValue(userConfig, key, ...fallbacks);

  const defaultTheme =
    get("theme.default_mode", "dark") === "light" ? "light" : "dark"; // Default theme mode (light or dark).

  const colorScheme = get("theme.color_scheme", DEFAULT_COLOR_SCHEME); // The site's color scheme. Can be a built-in theme ("nord", "dracula", "github", "catppuccin", "gruvbox", "portosaur") or a path to a custom .css file.
  const selectedPrism = prismThemeMap[colorScheme] || prismThemeMap.nord;

  const titleName = get("home_page.hero.title", "Your Name"); // Main title or name in the hero section.
  const siteName = get("site.title", titleName); // Global site title.
  const siteFavicon = resolveAsset(
    get("site.favicon", ""), // Path to site's favicon (Default: home_page.hero.profile_pic).
    resolveAsset(get("home_page.hero.profile_pic", ""), "img/icon.png"), // Path/URL to profile picture in the hero section.
  );

  const siteTagline = get(
    "home_page.hero.desc", // Short description about You.
    "site.tagline", // Global site tagline.
    "Short description about you, your passion, your goals etc.",
  );

  // Collect static directories: local site static/, theme static/, and portosaur dot dir.
  const staticDirectories = [
    "static",
    portoStaticDir,
    path.join(getPortoDotDir(projectDir), "static"),
  ].filter((dir) => dir && fs.existsSync(dir));

  // Process generated favicon/manifest head tags
  const extraHeadTags = buildHeadTags(context.extraHeadTags || []).filter(
    (t) =>
      !(
        t.tagName === "meta" &&
        t.attributes &&
        t.attributes.name === "theme-color"
      ),
  );
  const userHeadTags = buildHeadTags(get("site.head_tags", [])); // Custom head tags to inject into the document.

  // Regular and meta tags for user-defined tags
  const regularUserHeadTags = userHeadTags.filter((t) => t.tagName !== "meta");
  const customUserMetaTags = userHeadTags
    .filter((t) => t.tagName === "meta")
    .map((t) => t.attributes);

  const notesDir = get("site.notes.dir", "notes"); // Notes directory name. Relative to project root.
  const notesRoute = get("site.notes.route", "notes"); // Notes Route (eg, my-notes -> my-website.in/my-notes)

  const blogDir = get("site.blog.dir", "blog"); // Blog directory name. Relative to project root.
  const blogRoute = get("site.blog.route", "blog"); // Blog Route (eg, my-blog -> my-website.in/my-blog)

  // ------- Configuration Setup -------

  return {
    projectName: siteName,
    title: siteName,
    tagline: siteTagline,
    url: siteUrl,
    baseUrl: sitePath,
    favicon: "/favicon/favicon.ico",
    organizationName: siteName,
    onBrokenAnchors: get("site.on_broken_anchors", "throw"), // Behavior when a link anchor (#) is missing.
    onBrokenLinks: get("site.on_broken_links", "throw"), // Behavior when a link is broken.
    i18n: { defaultLocale: "en", locales: ["en"] },

    staticDirectories,

    headTags: [
      ...regularUserHeadTags,
      ...(env.NODE_ENV !== "production"
        ? extraHeadTags.filter((t) => t.tagName !== "meta")
        : []),
      {
        tagName: "script",
        attributes: {},
        innerHTML: `window.process = window.process || { env: { NODE_ENV: '${process.env.NODE_ENV || "production"}' } };`,
      },
      {
        tagName: "script",
        attributes: {},
        innerHTML: getThemeColorSyncScript(),
      },
    ],

    markdown: {
      format: get("site.markdown.format", "mdx"), // Markdown parser format (mdx, md, detect).
      mermaid: get("site.markdown.mermaid", true), // Enable support for Mermaid.js diagrams.
      emoji: get("site.markdown.render_emoji_shortcodes", true), // Render emoji shortcodes like :smile:.
      parseFrontMatter: async ({
        filePath,
        fileContent,
        defaultParseFrontMatter,
      }) => {
        const result = await defaultParseFrontMatter({ filePath, fileContent });
        result.frontMatter = cleanFrontMatterSlug({
          filePath,
          frontMatter: result.frontMatter,
          projectDir,
          contentDirName: notesDir,
        });
        return result;
      },
      hooks: {
        onBrokenMarkdownLinks: get("site.markdown.on_broken_links", "throw"), // Broken link behavior.
        onBrokenMarkdownImages: get("site.markdown.on_broken_images", "throw"), // Broken image behavior.
      },
    },

    themeConfig: {
      image: resolveAsset(get("site.social_card", "")) || undefined, // Preview image used when sharing your site on social media.
      metadata: [
        { name: "generator", content: `Portosaur v${porto.version}` },
        ...customUserMetaTags,
        ...(env.NODE_ENV !== "production"
          ? extraHeadTags
              .filter((t) => t.tagName === "meta")
              .map((t) => t.attributes)
          : []),
      ],
      colorMode: {
        defaultMode: defaultTheme,
        disableSwitch: !get("theme.appearance.show_theme_switch", true), // Show the dark/light mode toggle.
        respectPrefersColorScheme: false,
      },

      navbar: {
        title: siteName,
        logo: {
          alt: `${siteName} logo`,
          src: siteFavicon,
        },
        hideOnScroll: get("theme.navigation.hide_navbar_on_scroll", true), // Automatically hide the navbar when scrolling down.
        items: [
          {
            type: "search",
            position: "right",
            className: "navbar-search-bar",
          },
          ...(get("home_page.about.enable", true) // Toggle the About Me section.
            ? [
                {
                  label: "About Me",
                  to: "/#about",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(get("home_page.project_shelf.enable", true) // Toggle the Project Shelf section.
            ? [
                {
                  label: "Projects",
                  to: "/#projects",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(get("home_page.experience.enable", false) // Toggle the Experience section.
            ? [
                {
                  label: "Experience",
                  to: "/#experience",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(get("home_page.social.enable", true) // Toggle the Social Links section.
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
              { label: "Notes", to: `/${notesRoute}` },
              { label: "Blog", to: `/${blogRoute}` },
              ...(get("tasks.enable", false) // Toggle the Tasks page.
                ? [{ label: "Tasks", to: "/tasks" }]
                : []),
              ...(!get("theme.appearance.disable_project_link", false) // Hide the Project link in the navbar.
                ? [
                    {
                      label: `Portosaur v${portoVersion}`,
                      className:
                        "_nav-portosaur-version desktop-only-portosaur-version",
                      href: porto?.homepage ?? "#",
                    },
                  ]
                : []),
            ],
          },
          ...(!get("theme.appearance.disable_project_link", false) // Hide the Project link in the navbar.
            ? [
                {
                  label: `Portosaur v${portoVersion}`,
                  className:
                    "_nav-portosaur-version mobile-only-portosaur-version",
                  href: porto?.homepage ?? "#",
                  position: "right",
                },
              ]
            : []),
        ],
      },

      docs: {
        sidebar: {
          hideable: get("theme.navigation.collapsable_sidebar", true), // Enable collapsable sidebar navigation.
        },
      },

      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 3,
      },

      prism: {
        theme: selectedPrism.light,
        darkTheme: selectedPrism.dark,
        additionalLanguages: [
          "asciidoc",
          "awk",
          "bash",
          "batch",
          "c",
          "clike",
          "cmake",
          "cpp",
          "csharp",
          "csv",
          "dart",
          "diff",
          "docker",
          "go",
          "go-module",
          "gradle",
          "ini",
          "java",
          "kotlin",
          "lua",
          "markdown",
          "nix",
          "php",
          "python",
          "qml",
          "rust",
          "toml",
          "yaml",
        ],
        magicComments: [
          {
            line: "highlight-next-line",
            className: "theme-code-block-highlighted-line",
            block: { start: "highlight-start", end: "highlight-end" },
          },
          {
            line: "error-next-line",
            className: "code-block-error-line",
            block: { start: "error-start", end: "error-end" },
          },
          {
            line: "success-next-line",
            className: "code-block-success-line",
            block: { start: "success-start", end: "success-end" },
          },
        ],
      },

      ...(get("theme.footer.enable", true) // Toggle the footer section.
        ? {
            footer: {
              copyright: get(
                "theme.footer.message", // Custom copyright message.
                `Copyright © ${new Date().getFullYear()} ${titleName}.${
                  !get("theme.footer.disable_project_link", false) // Hide the Project link in the footer.
                    ? ` Built with <a href="${porto?.homepage ?? "#"}" target="_blank" rel="noopener noreferrer">Portosaur.</a>`
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

      preview: {
        timeout: get("site.preview.timeout", 15) * 1000, // Timeout in seconds for fetching preview content (default: 15s).
      },

      topicList: {
        enableByDefaults: get("site.notes.topic_list", true), // Toggle automatically adding topic lists to notes pages.
      },

      heroSection: {
        profilePic: resolveAsset(
          get("home_page.hero.profile_pic", ""),
          "img/icon.png",
        ),

        intro: get("home_page.hero.intro", "Hello there, I'm"), // Intro text before name.
        title: titleName,
        subtitle: get("home_page.hero.subtitle", "I am a"), // Subtitle text after name.
        profession: get("home_page.hero.profession", "Your Profession"),
        desc: get("home_page.hero.desc", "Welcome to my portfolio."),
        learnMoreButtonTxt: get(
          "home_page.hero.learn_more_button_txt", // Text for the call-to-action button.
          "Learn More",
        ),
        social: get("home_page.hero.social", []), // List of social links. @items { name: string, url: string, icon?: string }
      },

      aboutSection: {
        enable: get("home_page.about.enable", true),
        heading: get("home_page.about.heading", "About Me"), // Heading for the About Me section.
        name: get("site.title", "Your Name"), // Global site title.
        image: resolveAsset(
          get(
            "home_page.about.image", // Image used in the About Me section.
            "home_page.hero.profile_pic",
            "img/icon.png",
          ),
        ),
        bio: get("home_page.about.bio", []), // Paragraphs for your biography.
        skills: get("home_page.about.skills", []),
        skillsHeading: get("home_page.about.skills_heading", "My Skills"), // Heading for the skills list.
        resume: get("home_page.about.resume", "none"),
      },

      projectShelf: {
        enable: get("home_page.project_shelf.enable", true),
        heading: get("home_page.project_shelf.heading", "My Projects"), // Heading for the projects section.
        subheading: get(
          "home_page.project_shelf.subheading", // Subheading for the projects section.
          "A collection of all my works, with featured projects highlighted",
        ),
        autoplay: get("home_page.project_shelf.autoplay", true), // Autoplay the project carousel.
        projects: get("home_page.project_shelf.projects", []), // @items { title: string, icon?: string|null, bg?: string, state?: enum[active|completed|maintenance|paused|archived|planned], desc?: string, tags?: array, featured?: boolean, website?: string, repo?: string, demo?: string }
      },

      experienceSection: {
        enable: get("home_page.experience.enable", false),
        heading: get("home_page.experience.heading", "Experience"), // Heading for the experience section.
        subheading: get(
          "home_page.experience.subheading", // Subheading for the experience section.
          "My professional journey, in a glance",
        ),
        list: get("home_page.experience.list", []), // @items { company: string, role: string, duration?: string, desc?: string }
      },

      socialSection: {
        enable: get("home_page.social.enable", true),
        heading: get("home_page.social.heading", "Get In Touch"), // Heading for the social links section.
        subheading: get(
          "home_page.social.subheading", // Subheading for the social links section.
          "Feel free to reach out for collaborations, questions, or just to say hello!",
        ),
        links: get("home_page.social.links", []), // @items { name: string, url: string, icon?: string, desc?: string }
      },

      tasks: {
        enable: get("tasks.enable", false),
        title: get("tasks.title", "Tasks"), // Title for the tasks page.
        subtitle: get("tasks.subtitle", "My current focus"),
        list: get("tasks.list", []), // @items { title: string, status: string, desc?: string }
      },

      toolsConfig: {
        linkShortener: {
          enable: get("tools.link_shortener.enable", false), // Toggle the internal link shortener.
          deployPath: get("tools.link_shortener.deploy_path", "/l"), // URL base path for redirects.
          shortLinks: get("tools.link_shortener.short_links", {}), // Key-value map of slugs to target URLs.
        },
      },

      // site.robots_txt is consumed in build.mjs, but we pass it through here
      // so the schema generator discovers it without hardcoding.
      robotsTxt: {
        enable: rawGet("site.robots_txt.enable", true), // Toggle robots.txt file generation.
        rules: rawGet("site.robots_txt.rules", []), // List of rules (e.g., user_agent, allow, disallow).
        customLines: rawGet("site.robots_txt.custom_lines", []), // Extra raw lines to append to robots.txt.
      },
    },

    // ------- Presets -------

    presets: [
      [
        "@docusaurus/preset-classic",
        {
          docs: {
            routeBasePath: notesRoute,
            path: notesDir,
            breadcrumbs: get("theme.navigation.breadcrumbs", true), // Show breadcrumbs in the notes pages.
            sidebarPath: path.resolve(
              portoPaths.theme ?? context.portoRoot ?? "",
              "config/sidebar.jsx",
            ),
            ...(get("site.edit_url", "") // Base URL for Edit this page links.
              ? { editUrl: get("site.edit_url", "") }
              : {}),
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
            sidebarItemsGenerator: createSidebarItemsGenerator(),
          },
          blog: {
            routeBasePath: blogRoute,
            path: blogDir,
            showReadingTime: false,
            ...(get("site.edit_url", "")
              ? { editUrl: get("site.edit_url", "") }
              : {}),
            remarkPlugins: [remarkMath],
            rehypePlugins: [rehypeKatex],
            feedOptions: {
              type: get("site.rss.enable", true) ? "all" : null, // Toggle RSS feed generation for the blog.
              copyright: get(
                "site.rss.copyright", // Custom copyright string for the feed.
                `Copyright © ${new Date().getFullYear()} ${siteName}.`,
              ),
              description: get("site.rss.desc", siteTagline), // Description for the feed.
            },
          },
          theme: {
            customCss: resolveSiteCssFiles(
              projectDir,
              userConfig,
              portoPaths.theme ?? context.portoRoot ?? "",
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
          docsDir: notesDir,
          docsRouteBasePath: notesRoute,
          blogDir: blogDir,
          blogRouteBasePath: blogRoute,
          searchContextByPaths: [notesRoute, blogRoute],
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

          hasSymlinkedContent: [notesDir, blogDir].some((dir) => {
            try {
              return fs
                .lstatSync(path.resolve(projectDir, dir))
                .isSymbolicLink();
            } catch {
              return false;
            }
          }),
        },
      ],
    ],

    // ------- Plugins -------

    plugins: [
      () => ({
        name: "portosaur-aliases",
        configureWebpack() {
          return {
            resolve: {
              alias: {
                "@portosaur-notes": path.resolve(projectDir, notesDir),
                "@portosaur-blog": path.resolve(projectDir, blogDir),
              },
            },
          };
        },
      }),
      ...(env.NODE_ENV === "production"
        ? [
            [
              "@docusaurus/plugin-pwa",
              {
                offlineModeActivationStrategies: [
                  "appInstalled",
                  "standalone",
                  "queryString",
                  "saveData",
                ],
                pwaHead: extraHeadTags.map((t) => ({
                  tagName: t.tagName,
                  ...t.attributes,
                })),
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
