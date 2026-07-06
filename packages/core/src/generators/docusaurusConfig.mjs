import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { getGitDate } from "../utils/system.mjs";
import { porto } from "../app.mjs";
import { resolveVars, getNestedValue } from "../utils/config.mjs";
import { getPortoDotDir } from "../utils/fs.mjs";
import {
  resolveSiteUrl,
  resolveBasePath,
  createAssetValidator,
  buildHeadTags,
  createSidebarItemsGenerator,
  cleanFrontMatterSlug,
  getThemeColorSyncScript,
  resolveSiteCssFiles,
  getDefaultColorScheme,
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

  const validateAsset = createAssetValidator(
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

  const genFallback = (img) => {
    if (img && /^https?:\/\//.test(img)) {
      const hash = crypto.createHash("md5").update(img).digest("hex");
      return {
        src: img,
        fallback: `/fallbacks/${hash}.png`,
      };
    }
    return img;
  };

  const defaultTheme =
    get("theme.default_mode", "dark") === "light" ? "light" : "dark"; // Default theme mode (light or dark).

  const siteMode = rawGet("docs_home") ? "docs" : "portfolio";

  const colorScheme = get(
    "theme.color_scheme",
    getDefaultColorScheme(userConfig),
  ); // The site's color scheme.

  const selectedPrism = prismThemeMap[colorScheme] || prismThemeMap.nord;
  const titleName =
    siteMode === "docs"
      ? get("docs_home.title", "Your Name") // Your project's title
      : get("home_page.hero.title", "Your Name"); // Main title or name in the hero section.
  const siteName = get("site.title", titleName); // Global site title.

  const siteTagline = get(
    "site.tagline", // Global site tagline.
    "My Digital space, personal knowledge base & blogging platform",
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

  const notesDir =
    siteMode === "docs"
      ? get("site.docs.dir", "docs") // Docs directory name for docs mode. Relative to project Root.
      : get("site.notes.dir", "notes"); // Notes directory name. Relative to project root.

  const notesRoute =
    siteMode === "docs"
      ? get("site.docs.route", "docs") // Docs route for docs mode.
      : get("site.notes.route", "notes"); // Notes Route (eg, my-notes -> my-website.in/my-notes)

  const blogDir = get("site.blog.dir", "blog"); // Blog directory name. Relative to project root.
  const blogRoute = get("site.blog.route", "blog"); // Blog Route (eg, my-blog -> my-website.in/my-blog)

  const customNavbarItems = get("theme.navigation.navbar_items", []); // List of custom navbar items. @items { label: string, to?: string, href?: string, position?: string }

  const require = createRequire(import.meta.url);
  const remarkIconsPlugin = require(
    path.resolve(
      portoPaths.themeRoot ?? context.portoRoot ?? "",
      "src/plugins/remarkIcons.cjs",
    ),
  );

  // ------- Configuration Setup -------

  return {
    projectName: siteName,
    title: siteName,
    tagline: siteTagline,
    url: siteUrl,
    baseUrl: sitePath,
    favicon: "/favicon/favicon.ico",
    organizationName: siteName,
    onBrokenAnchors: get("site.on_broken_anchors", "warn"), // Behavior when a link anchor (#) is missing.
    onBrokenLinks: get("site.on_broken_links", "throw"), // Behavior when a link is broken.
    i18n: { defaultLocale: "en", locales: ["en"] },

    staticDirectories,

    // Client module that registers the Periodic Background Sync from the main thread.
    // Only included in production (service worker is only active in production).
    clientModules:
      env.NODE_ENV === "production" &&
      get("site.pwa.enable", true) &&
      get("site.pwa.notifications", false)
        ? [
            path.resolve(
              portoPaths.theme ?? context.portoRoot ?? "",
              "src/clientModules/periodicSync.js",
            ),
          ]
        : [],

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
        let contentToParse = fileContent;
        const filename = path.basename(filePath).toLowerCase();
        const dir = path.dirname(filePath);

        const isRootIndex =
          dir === path.resolve(projectDir, notesDir) &&
          (filename === "index.md" ||
            filename === "index.mdx" ||
            filename === "readme.md" ||
            filename === "readme.mdx");

        if (isRootIndex) {
          // Change actual # README or # Index markdown headings to # Docs so the page renders it correctly
          contentToParse = contentToParse.replace(
            /^#\s+(?:README|Index)\s*$/im,
            "# Docs",
          );
        }

        const result = await defaultParseFrontMatter({
          filePath,
          fileContent: contentToParse,
        });

        if (isRootIndex && !result.frontMatter.title) {
          // Force the metadata title to "Docs" if the user hasn't explicitly set one
          result.frontMatter.title = "Docs";
        }

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
      image: validateAsset(get("site.social_card", "")) || undefined, // Preview image used when sharing your site on social media.
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
          src: "/favicon/favicon.ico",
        },
        hideOnScroll: get("theme.navigation.hide_navbar_on_scroll", true), // Automatically hide the navbar when scrolling down.
        items: [
          {
            type: "search",
            position: "right",
            className: "navbar-search-bar",
          },
          ...(siteMode === "docs"
            ? [
                {
                  label: "Docs",
                  to: `/${notesRoute}`,
                  position: "right",
                  activeBasePath: notesRoute,
                },
              ]
            : []),
          ...(siteMode === "portfolio" && get("home_page.about.enable", true) // Toggle the About Me section.
            ? [
                {
                  label: "About Me",
                  to: "/#about",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(siteMode === "portfolio" &&
          get("home_page.project_shelf.enable", true) // Toggle the Project Shelf section.
            ? [
                {
                  label: "Projects",
                  to: "/#projects",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(siteMode === "portfolio" &&
          get("home_page.experience.enable", false) // Toggle the Experience section.
            ? [
                {
                  label: "Experience",
                  to: "/#experience",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...(siteMode === "portfolio" && get("home_page.social.enable", true) // Toggle the Social Links section.
            ? [
                {
                  label: "Contact",
                  to: "/#contact",
                  position: "right",
                  activeBasePath: "/never-match",
                },
              ]
            : []),
          ...customNavbarItems.map((item) => ({
            label: item.label,
            to: item.to || undefined,
            href: item.href || undefined,
            position: item.position || "right",
          })),
          {
            type: "dropdown",
            label: "More",
            position: "right",
            className: "_navbar-more-items",
            items: [
              ...(siteMode !== "docs"
                ? [{ label: "Notes", to: `/${notesRoute}` }]
                : []),
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

      // Dummy property so the schema generator discovers it
      _schemaSiteFavicon: get("site.favicon", ""), // Path to site's favicon.

      preview: {
        timeout: get("site.preview.timeout", 15) * 1000, // Timeout in seconds for fetching preview content (default: 15s).
      },

      topicList: {
        enableByDefaults: get("site.notes.topic_list", true), // Toggle automatically adding topic lists to notes pages.
      },

      siteMode,

      homePage: {
        heroSection: {
          profilePic: genFallback(
            validateAsset(
              get("home_page.hero.profile_pic", ""), // Path/URL to profile picture in the hero section.
              "img/icon.png",
            ),
          ),
          intro: get("home_page.hero.intro", "Hello there, I'm"), // Intro text before name.
          title: titleName,
          subtitle: get("home_page.hero.subtitle", "I am a"), // Subtitle text after name.
          profession: get("home_page.hero.profession", "Your Profession"),
          desc: get(
            "home_page.hero.desc", // Short description about you, your passion, goals etc.
            "Short description about you, your passion, your goals etc.",
          ),
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
          image: genFallback(
            validateAsset(
              get("home_page.about.image", "home_page.hero.profile_pic", ""),
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
          // @items { title: string, icon?: string|null, bg?: string, state?: enum[active|completed|maintenance|paused|archived|planned], desc?: string, tags?: array, featured?: boolean, website?: string, repo?: string, demo?: string }
          projects: get("home_page.project_shelf.projects", []).map(
            (project) => ({
              ...project,
              icon: genFallback(
                validateAsset(project.icon, "img/project-blank.png"),
              ),
            }),
          ),
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
      },

      docsHome: {
        icon: genFallback(
          validateAsset(get("docs_home.icon", ""), "img/icon.png"), // Project icon.
        ),
        title: titleName,
        tagline: get("docs_home.tagline", "this is my awsome project"), // Your project's tagline
        desc: get(
          "docs_home.desc", // Short description about the project
          "A awsome project for solving this practical projblem",
        ),
        actions: get("docs_home.actions", []).map((a) => {
          const isFilePath =
            a.icon && (a.icon.includes(".") || a.icon.includes("/"));
          return {
            ...a,
            icon: a.icon
              ? isFilePath
                ? genFallback(validateAsset(a.icon, ""))
                : a.icon
              : undefined,
          };
        }), // Action buttons. @items { text: string, link: string, icon?: string }

        features: get("docs_home.features", []).map((f) => {
          const isFilePath =
            f.icon && (f.icon.includes(".") || f.icon.includes("/"));
          return {
            ...f,
            icon: f.icon
              ? isFilePath
                ? genFallback(validateAsset(f.icon, ""))
                : f.icon
              : undefined,
          };
        }), // Project Features. @items { title: string, desc: string, icon?: string, link?: string }
      },

      tasks: {
        enable: get("tasks.enable", false),
        title: get("tasks.title", "Tasks"), // Title for the tasks page.
        subtitle: get("tasks.subtitle", "My current focus"),
        list: get("tasks.list", []), // @items { title: string, status: string, desc?: string }
      },

      pwa: {
        enable: get("site.pwa.enable", true), // enable/disable PWA support
        notifications: get("site.pwa.notifications", false), // toggle background sync for new blog posts
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
            remarkPlugins: [remarkMath, remarkIconsPlugin],
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
            remarkPlugins: [remarkMath, remarkIconsPlugin],
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
          pages: {
            exclude: siteMode === "docs" ? ["**/notes.jsx"] : [],
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

      // Run the Build-Time Icon Scanner plugin
      [
        path.resolve(
          portoPaths.themeRoot ?? context.portoRoot ?? "",
          "src/plugins/iconsPlugin.mjs",
        ),
        {
          portoRoot: portoPaths.themeRoot ?? context.portoRoot ?? "",
          projectDir: projectDir,
        },
      ],

      ...(get("site.pwa.enable", true)
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
                swCustom: path.resolve(
                  context.portoRoot ?? "",
                  "src/sw-custom.js",
                ),
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
