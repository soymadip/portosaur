import { catppuccinMocha, catppuccinLatte } from "./src/config/prism.js";
import { appVersion } from "./src/utils/appVersion.js";
import { metaTags } from "./src/config/metaTags.js";
import { usrConf } from "./src/utils/compileConfig.js";
import { useEnabled } from "./src/utils/filterEnabledItems.js";

const projectName = "Portosaurus";
const projectVersion = appVersion();
const faviconPath = "favicon/favicon.ico";
const iconPicPath = "static/img/icon.png";

const config = {
  projectName: `${projectName}`,

  title: usrConf.hero_section.title || `${projectName}`,

  tagline: usrConf.hero_section.tagline || "Your complete portfolio solution",

  favicon: usrConf.favicon || `${faviconPath}`,

  url: usrConf.site_url,
  baseUrl: usrConf.site_path || "/",

  // GH Pages config
  organizationName: usrConf.hero_section.title || `${projectName} `,
  deploymentBranch: "gh-pages",

  onBrokenAnchors: "ignore",
  onBrokenLinks: "warn",
  // onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  headTags: metaTags,

  customFields: {
    version: `${projectVersion}`,

    heroSection: {
      profilePic: usrConf.hero_section.profile_pic || `${iconPicPath}`,
      intro: usrConf.hero_section.intro || "Hello there, I'm",
      title: usrConf.hero_section.title || "Your Name",
      subtitle: usrConf.hero_section.subtitle || "I am a",
      profession: usrConf.hero_section.profession || "Your Profession",
      description:
        usrConf.hero_section.description ||
        "Short description about your profession, passion, goals.",
      learnMoreButtonTxt:
        usrConf.hero_section.learn__more_button_txt || "Learn More",
    },

    aboutMe: {
      enable: usrConf.about_me.enable || true,

      image: usrConf.about_me.image || `${iconPicPath}`,
      description: usrConf.about_me.description || [
        "I'm a passionate FOSS developer with expertise in designing and building solutions for real-world problems.",
        "My journey in software development started with a simple desire to automate repetitive tasks, specially in my PC.",
      ],
      skills: usrConf.about_me.skills || ["skill 1", "Skill 2"],
      resumeLink: usrConf.about_me.resume_link || "https://example.com/resume",
    },

    projects: usrConf.project_shelf,

    experience: usrConf.experience,

    socialLinks: {
      enable: usrConf.social_links.enable || true,

      links: usrConf.social_links.links || [
        {
          name: "Your Instagram",
          icon: "instagram",
          desc: "Your Instagram profile link",
          url: "https://instagram.com/yourprofile",
        },
      ],
    },

    robotsTxt: {
      enable: usrConf.robots_txt || true,
      rules: [
        {
          disallow: ["/notes/", "/tasks/"],
        },
      ],
      customLines: [],
    },

    tasksPage: {
      enable: usrConf.tasks_page.enable || true,
      title: usrConf.tasks_page.title || "Tasks",
      description:
        usrConf.tasks_page.description || "Track your tasks and projects here.",
      taskList: usrConf.tasks_page.tasks || [
        {
          title: "Example Tasks",
          description: "Description of the task",
          status: "active",
          priority: "high",
        },
      ],
    },

    corsProxyList: [
      usrConf.cors_proxy,
      "https://cors-proxy.soymadip.workers.dev/?url=",
      "https://api.allorigins.win/raw?url=",
    ].filter(Boolean),
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "notes",
          path: "notes",
          sidebarPath: "./src/config/sidebar.js",
          editUrl: usrConf.editUrl || "#",

          admonitions: {
            keywords: ["note", "tip", "info", "warning", "danger", "question"],
            extendDefaults: true,
          },
        },

        blog: {
          feedOptions: usrConf.rss
            ? {
                type: ["rss", "atom"],
                xslt: true,
              }
            : undefined,

          showReadingTime: false,

          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },

        theme: {
          customCss: "./src/css/custom.css",
        },
      },
    ],
  ],

  // themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  themeConfig: {
    // Social card
    image: usrConf.social_card || "img/social-card.jpeg",

    docs: {
      sidebar: {
        hideable: usrConf.collapsable_sidebar || true,
      },
    },

    imageZoom: {
      options: {
        margin: 2,
        background: "rgba(var(--ifm-background-color-rgb), 0.9)",
      },
    },

    // Default: Dark mode
    colorMode: {
      defaultMode: usrConf.dark_mode ? "dark" : "light",
      disableSwitch: usrConf.disable_theme_switch || false,
    },

    navbar: {
      title: usrConf.hero_section.title || `${projectName} `,
      hideOnScroll: usrConf.hide_navbar_on_scroll || true,

      logo: {
        alt: "Site Logo",
        src: usrConf.favicon || `${faviconPath}`,
      },

      items: useEnabled([
        {
          type: "search",
          position: "right",
          className: "navbar-search-bar",
        },
        {
          enable: usrConf.about_me?.enable || true,
          value: {
            label: "About Me",
            to: "/#about",
            position: "right",
            activeBaseRegex: "^/#about",
          },
        },
        {
          enable: usrConf.project_shelf?.enable || true,
          value: {
            label: "Projects",
            to: "/#projects",
            position: "right",
            activeBaseRegex: "^/#projects",
          },
        },
        {
          enable: usrConf.experience?.enable || false,
          value: {
            label: "Experience",
            to: "/#experience",
            position: "right",
            activeBaseRegex: "^/#experience",
          },
        },
        {
          enable: usrConf.social_links?.enable || true,
          value: {
            label: "Contact",
            to: "/#contact",
            position: "right",
            activeBaseRegex: "^/$contact",
          },
        },
        {
          type: "dropdown",
          label: "More",
          position: "right",
          className: "_navbar-more-items",
          items: useEnabled([
            { label: "Notes", to: "/notes" },
            { label: "Blog", to: "/blog" },
            { label: "Tasks", to: "/tasks" },
            {
              enable: usrConf.disable_branding ? false : true,
              value: {
                label: `Portosaurus v${projectVersion}`,
                className: "_nav-protosaurus-version",
                to: "https://github.com/soymadip/portosaurus",
              },
            },
          ]),
        },
      ]),
    },

    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 4,
    },

    prism: {
      theme: catppuccinLatte,
      darkTheme: catppuccinMocha,
      additionalLanguages: ["java", "php", "bash"],
    },

    footer: {
      /* links: [
        {
            label: 'GitHub',
            href: 'https://github.com/',
          }
        ],
        copyright: `Copyright © ${new Date().getFullYear()} ` + ownerName,
      */
    },
  },

  plugins: [
    require.resolve("./src/utils/generateFavicon"),
    require.resolve("./src/utils/generateRobotsTxt"),
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        indexDocs: true,
        docsDir: "notes",
        docsRouteBasePath: "notes",
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        hideSearchBarWithNoSearchContext: true,
        searchContextByPaths: ["notes", "blog"],
        language: ["en"],
      },
    ],
    "plugin-image-zoom",
  ],
};

export default config;
