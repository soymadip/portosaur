import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getGitDate } from "../utils/system.mjs";
import { porto } from "../app.mjs";
import { resolveVars, getNestedValue } from "../utils/config.mjs";
import { getPortoDotDir } from "../utils/fs.mjs";
import { resolveSiteUrl, resolveBasePath } from "../utils/site.mjs";
import { createAssetValidator } from "../utils/assets.mjs";
import { getDefaultColorScheme, resolveSiteCssFiles } from "../utils/css.mjs";

/**
 * Resolves a raw user config (`config.yml`) into a `PortosaurOptions` object.
 *
 * This is the engine's single config-resolution entry point (D13): it loads
 * the raw config, resolves vars/URLs, and returns plain resolved data. It
 * does no build-time work — no file generation, no asset processing.
 *
 * Every `get()`/`rawGet()` call in this file is parsed by the schema
 * generator (`porto schema`), which reads the key, the default, and the
 * attached comment (inline, or the comment block directly above). The calls
 * are ordered to match the discovery order of the original
 * `docusaurusConfig.mjs`, so the generated schema keeps its key order. Keep
 * the calls and their comments intact when editing; a comment directly above
 * a `get()` call becomes that key's schema description.
 *
 * The returned shape (documented in `src/engine/index.d.ts`):
 *
 * - `site` — identity, routing, markdown, feeds, PWA, preview, robots, build
 * - `theme` — color scheme, mode, navigation, footer
 * - `siteMode` — `"docs"` or `"portfolio"`
 * - `homePage`, `docsHome`, `tasks`, `tools` — page/section data
 * - `topicList` — notes topic-list gating
 * - `portoVersion`, `lastUpdated`, `projectDir`, `portoPaths`,
 *   `staticDirectories`, `cssFiles`, `extraHeadTags`, `userVars` — build
 *   context the adapter (Phase 1) and the integration (Phase 2) consume.
 *
 * @param {Object} rawUserConfig - The parsed `config.yml` (vars unresolved).
 * @param {string} projectDir - The user's project directory.
 * @param {Object} [context={}] - Build context: `portoPaths`, `gitDate`,
 *   `env`, `projectVersion`, `extraHeadTags` (generated asset head tags).
 * @returns {Object} The resolved `PortosaurOptions` object.
 */
export function buildSiteConfig(rawUserConfig, projectDir, context = {}) {
  const { portoPaths = {}, gitDate = null, env = process.env } = context;

  const themeRoot = portoPaths.themeRoot ?? context.portoRoot ?? "";

  const rawGet = (key, ...fallbacks) =>
    getNestedValue(rawUserConfig, key, ...fallbacks);

  const portoVersion = porto.version ?? "0.0.0";
  const lastUpdated = gitDate ?? getGitDate(projectDir);

  const siteUrl = resolveSiteUrl(rawGet("site.url", "auto"), env);
  const sitePath = resolveBasePath(rawGet("site.base_url", "auto"), env);
  const staticDir = path.resolve(projectDir, "static");
  const portoStaticDir = portoPaths.static ?? "";

  const validateAsset = createAssetValidator(
    projectDir,
    staticDir,
    portoStaticDir,
  );

  const userVars = rawGet("vars", {});

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
    vars: userVars,
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

  const titleName =
    siteMode === "docs"
      ? get("docs_home.title", "Your Name") // Your project's title
      : get("home_page.hero.title", "Your Name"); // Main title or name in the hero section.
  const siteName = get("site.title", titleName); // Global site title.

  const siteTagline = get(
    "site.tagline", // Global site tagline.
    "My Digital space, personal knowledge base & blogging platform",
  );

  const headTags = get("site.head_tags", []); // Custom head tags to inject into the document.

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

  const onBrokenAnchors = get("site.on_broken_anchors", "warn"); // Behavior when a link anchor (#) is missing.
  const onBrokenLinks = get("site.on_broken_links", "throw"); // Behavior when a link is broken.

  const pwaEnable = get("site.pwa.enable", true);
  const pwaNotifications = get("site.pwa.notifications", false);

  const mermaid = get("site.markdown.mermaid", true); // Enable support for Mermaid.js diagrams.
  const renderEmojiShortcodes = get(
    "site.markdown.render_emoji_shortcodes",
    true,
  ); // Render emoji shortcodes like :smile:.
  const markdownOnBrokenLinks = get("site.markdown.on_broken_links", "throw"); // Broken link behavior.
  const markdownOnBrokenImages = get("site.markdown.on_broken_images", "throw"); // Broken image behavior.

  const socialCard = validateAsset(get("site.social_card", "")) || undefined; // Preview image used when sharing your site on social media.

  const showThemeSwitch = get("theme.appearance.show_theme_switch", true); // Show the dark/light mode toggle.
  const hideNavbarOnScroll = get(
    "theme.navigation.hide_navbar_on_scroll",
    true,
  ); // Automatically hide the navbar when scrolling down.

  const aboutEnable = get("home_page.about.enable", true); // Toggle the About Me section.
  const projectShelfEnable = get("home_page.project_shelf.enable", true); // Toggle the Project Shelf section.
  const experienceEnable = get("home_page.experience.enable", false); // Toggle the Experience section.
  const socialEnable = get("home_page.social.enable", true); // Toggle the Social Links section.

  const tasksEnable = get("tasks.enable", false); // Toggle the Tasks page.
  const disableProjectLink = get(
    "theme.appearance.disable_project_link",
    false,
  ); // Hide the Project link in the navbar.

  const collapsableSidebar = get("theme.navigation.collapsable_sidebar", true); // Enable collapsable sidebar navigation.

  const footerEnable = get("theme.footer.enable", true); // Toggle the footer section.
  const footerMessage = get(
    "theme.footer.message", // Custom copyright message.
    `Copyright © ${new Date().getFullYear()} ${titleName}.${
      !get("theme.footer.disable_project_link", false) // Hide the Project link in the footer.
        ? ` Built with <a href="${porto?.homepage ?? "#"}" target="_blank" rel="noopener noreferrer">Portosaur.</a>`
        : ""
    }`,
  );
  const footerDisableProjectLink = get(
    "theme.footer.disable_project_link",
    false,
  );

  const favicon = get("site.favicon", ""); // Path to site's favicon.

  const previewTimeout = get("site.preview.timeout", 15) * 1000; // Timeout in seconds for fetching preview content (default: 15s).

  const topicListEnable = get("site.notes.topic_list", true); // Toggle automatically adding topic lists to notes pages.

  const heroSection = {
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
  };

  const aboutSection = {
    enable: aboutEnable,
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
  };

  const projectShelf = {
    enable: projectShelfEnable,
    heading: get("home_page.project_shelf.heading", "My Projects"), // Heading for the projects section.
    subheading: get(
      "home_page.project_shelf.subheading", // Subheading for the projects section.
      "A collection of all my works, with featured projects highlighted",
    ),
    autoplay: get("home_page.project_shelf.autoplay", true), // Autoplay the project carousel.
    // @items { title: string, icon?: string|null, bg?: string, state?: enum[active|completed|maintenance|paused|archived|planned], desc?: string, tags?: array, featured?: boolean, website?: string, repo?: string, demo?: string }
    projects: get("home_page.project_shelf.projects", []).map((project) => ({
      ...project,
      icon: genFallback(validateAsset(project.icon, "img/project-blank.png")),
    })),
  };

  const experienceSection = {
    enable: experienceEnable,
    heading: get("home_page.experience.heading", "Experience"), // Heading for the experience section.
    subheading: get(
      "home_page.experience.subheading", // Subheading for the experience section.
      "My professional journey, in a glance",
    ),
    list: get("home_page.experience.list", []), // @items { company: string, role: string, duration?: string, desc?: string }
  };

  const socialSection = {
    enable: socialEnable,
    heading: get("home_page.social.heading", "Get In Touch"), // Heading for the social links section.
    subheading: get(
      "home_page.social.subheading", // Subheading for the social links section.
      "Feel free to reach out for collaborations, questions, or just to say hello!",
    ),
    links: get("home_page.social.links", []), // @items { name: string, url: string, icon?: string, desc?: string }
  };

  const docsHome = {
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
  };

  const tasks = {
    enable: tasksEnable,
    title: get("tasks.title", "Tasks"), // Title for the tasks page.
    subtitle: get("tasks.subtitle", "My current focus"),
    list: get("tasks.list", []), // @items { title: string, status: string, desc?: string }
  };

  const linkShortener = {
    enable: get("tools.link_shortener.enable", false), // Toggle the internal link shortener.
    deployPath: get("tools.link_shortener.deploy_path", "/l"), // URL base path for redirects.
    shortLinks: get("tools.link_shortener.short_links", {}), // Key-value map of slugs to target URLs.
  };

  const robotsEnable = rawGet("site.robots_txt.enable", true); // Toggle robots.txt file generation.
  const robotsRules = rawGet("site.robots_txt.rules", []); // List of rules (e.g., user_agent, allow, disallow).
  const robotsCustomLines = rawGet("site.robots_txt.custom_lines", []); // Extra raw lines to append to robots.txt.

  const breadcrumbs = get("theme.navigation.breadcrumbs", true); // Show breadcrumbs in the notes pages.

  const editUrl = get("site.edit_url", ""); // Base URL for Edit this page link.

  const rssEnable = get("site.rss.enable", true); // Toggle RSS feed generation for the blog.
  const rssCopyright = get(
    "site.rss.copyright", // Custom copyright string for the feed.
    `Copyright © ${new Date().getFullYear()} ${siteName}.`,
  );
  const rssDesc = get("site.rss.desc", siteTagline); // Description for the feed.

  const outputDir = get("site.build.output_dir", "build"); // Directory name for the compiled site output. Relative to project root.

  const customCss = get("theme.custom_css", ""); // Custom CSS file(s) to load. @type {string|array}

  // Collect static directories: local site static/, theme static/, and portosaur dot dir.
  const staticDirectories = [
    "static",
    portoStaticDir,
    path.join(getPortoDotDir(projectDir), "static"),
  ].filter((dir) => dir && fs.existsSync(dir));

  const cssFiles = resolveSiteCssFiles(projectDir, userConfig, themeRoot);

  const extraHeadTags = context.extraHeadTags || [];

  return {
    site: {
      url: siteUrl,
      baseUrl: sitePath,
      title: siteName,
      tagline: siteTagline,
      favicon,
      socialCard,
      editUrl,
      headTags,
      notesDir,
      notesRoute,
      blogDir,
      blogRoute,
      onBrokenLinks,
      onBrokenAnchors,
      markdown: {
        mermaid,
        renderEmojiShortcodes,
        onBrokenLinks: markdownOnBrokenLinks,
        onBrokenImages: markdownOnBrokenImages,
      },
      rss: {
        enable: rssEnable,
        desc: rssDesc,
        copyright: rssCopyright,
      },
      pwa: {
        enable: pwaEnable,
        notifications: pwaNotifications,
      },
      preview: {
        // Milliseconds (the config value is seconds).
        timeout: previewTimeout,
      },
      robotsTxt: {
        enable: robotsEnable,
        rules: robotsRules,
        customLines: robotsCustomLines,
      },
      build: {
        outputDir,
      },
    },
    theme: {
      colorScheme,
      defaultMode: defaultTheme,
      customCss,
      showThemeSwitch,
      disableProjectLink,
      hideNavbarOnScroll,
      navbarItems: customNavbarItems,
      breadcrumbs,
      collapsableSidebar,
      footer: {
        enable: footerEnable,
        message: footerMessage,
        disableProjectLink: footerDisableProjectLink,
      },
    },
    siteMode,
    topicList: {
      enableByDefaults: topicListEnable,
    },
    homePage: {
      heroSection,
      aboutSection,
      projectShelf,
      experienceSection,
      socialSection,
    },
    docsHome,
    tasks,
    tools: {
      linkShortener,
    },
    portoVersion,
    lastUpdated,
    projectDir,
    portoPaths,
    staticDirectories,
    cssFiles,
    extraHeadTags,
    userVars,
  };
}
