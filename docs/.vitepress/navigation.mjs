export const nav = [
  { text: "User Guide", link: "/user/getting-started" },
  { text: "Configuration", link: "/user/config/overview" },
  { text: "Roadmap", link: "/roadmap" },
];

export const baseSidebar = [
  {
    text: "User Guide",
    items: [
      { text: "Getting Started", link: "/user/getting-started" },
      {
        text: "Configuration",
        link: "/user/config/overview",
        collapsed: true,
        items: [
          { text: "Variables", link: "/user/config/variables" },
          { text: "Reference", link: "/user/config/reference" },
        ],
      },
      {
        text: "Markdown Features",
        link: "/user/markdown/overview",
        collapsed: true,
        items: [
          { text: "Interactive Previews", link: "/user/markdown/previews" },
          { text: "Code Blocks", link: "/user/markdown/code-blocks" },
          { text: "Tabs", link: "/user/markdown/tabs" },
          { text: "Details", link: "/user/markdown/details" },
          { text: "Tooltips", link: "/user/markdown/tooltips" },
          { text: "Note Cards", link: "/user/markdown/note-cards" },
        ],
      },
      {
        text: "Deployment",
        link: "/user/deploy/overview",
        collapsed: true,
        items: [
          { text: "GitHub Pages", link: "/user/deploy/github-pages" },
          { text: "GitLab Pages", link: "/user/deploy/gitlab-pages" },
          { text: "Codeberg Pages", link: "/user/deploy/codeberg-pages" },
          { text: "Surge", link: "/user/deploy/surge" },
          { text: "Other Providers", link: "/user/deploy/others" },
        ],
      },
    ],
  },
  {
    text: "Developer Guide",
    link: "/dev/overview",
    collapsed: false,
    items: [
      { text: "@portosaur/wizard", link: "/dev/wizard" },
      { text: "@portosaur/logger", link: "/dev/logger" },
      { text: "Templates", link: "/dev/templates" },
    ],
  },
  {
    text: "More",
    collapsed: true,
    items: [{ text: "Roadmap", link: "/roadmap" }],
  },
];
