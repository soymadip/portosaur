/**
 * Name -> icon id + brand color. Keys are lowercase; lookups
 * lowercase their input. Used for icon guessing (a note titled
 * "Python" gets the Python icon) and for card accent colors.
 * Plain data — no icon packs — so any component may import it.
 */

export interface TechMapEntry {
  icon: string;
  color: string;
}

export const techMap: Record<string, TechMapEntry> = {
  react: { icon: "si:react", color: "#61dafb" },
  reactjs: { icon: "si:react", color: "#61dafb" },
  javascript: { icon: "si:javascript", color: "#f7df1e" },
  js: { icon: "si:javascript", color: "#f7df1e" },
  typescript: { icon: "si:typescript", color: "#3178c6" },
  ts: { icon: "si:typescript", color: "#3178c6" },
  python: { icon: "si:python", color: "#3776ab" },
  py: { icon: "si:python", color: "#3776ab" },
  node: { icon: "si:nodedotjs", color: "#339939" },
  nodejs: { icon: "si:nodedotjs", color: "#339939" },
  html: { icon: "si:html5", color: "#e34f26" },
  css: { icon: "si:css3", color: "#1572b6" },
  git: { icon: "si:git", color: "#f05032" },
  linux: { icon: "si:linux", color: "#fcc624" },
  docker: { icon: "si:docker", color: "#2496ed" },
  java: { icon: "di:java", color: "#007396" },
  cpp: { icon: "si:cplusplus", color: "#00599c" },
  csharp: { icon: "si:csharp", color: "#239120" },
  go: { icon: "si:go", color: "#00add8" },
  rust: { icon: "si:rust", color: "#dea584" },
  ruby: { icon: "si:ruby", color: "#cc342d" },
  php: { icon: "si:php", color: "#777bb4" },
  sql: { icon: "si:mysql", color: "#003b57" },
  mysql: { icon: "si:mysql", color: "#4479a1" },
  postgres: { icon: "si:postgresql", color: "#336791" },
  mongodb: { icon: "si:mongodb", color: "#47a248" },
  aws: { icon: "si:amazonwebservices", color: "#ff9900" },
  bash: { icon: "lu:terminal", color: "#4eaa25" },
  terminal: { icon: "lu:terminal", color: "#4eaa25" },
  vue: { icon: "si:vuedotjs", color: "#4fc08d" },
  angular: { icon: "si:angular", color: "#dd0031" },
  nextjs: { icon: "si:nextdotjs", color: "#000000" },
  kubernetes: { icon: "si:kubernetes", color: "#326ce5" },
  tailwind: { icon: "si:tailwindcss", color: "#38bdf8" },
  graphql: { icon: "si:graphql", color: "#e10098" },
  redis: { icon: "si:redis", color: "#dc382d" },

  // Non-Tech / Generic Mappings
  guide: { icon: "md:book-open", color: "#3b82f6" },
  tutorial: { icon: "md:school", color: "#8b5cf6" },
  about: { icon: "md:information", color: "#10b981" },
  blog: { icon: "md:pencil", color: "#f59e0b" },
  "getting-started": { icon: "md:rocket-launch", color: "#ef4444" },
  setup: { icon: "md:cog", color: "#64748b" },
  faq: { icon: "md:help-circle", color: "#0ea5e9" },
  features: { icon: "md:star", color: "#eab308" },
  contact: { icon: "md:email", color: "#14b8a6" },
  portfolio: { icon: "md:briefcase", color: "#6366f1" },
  home: { icon: "md:home", color: "#3b82f6" },

  // Specific Topics
  "machine-learning": { icon: "md:robot", color: "#ec4863ff" },
  ml: { icon: "md:robot", color: "#ec4899" },
  economics: { icon: "md:chart-line", color: "#10b981" },
  dbms: { icon: "md:database", color: "#3b82f6" },
  entrepreneurship: { icon: "md:lightbulb", color: "#f59e0b" },
  "data-mining": { icon: "md:database-search", color: "#8b5cf6" },
  warehouse: { icon: "md:warehouse", color: "#64748b" },

  // Social / Contact
  github: { icon: "md:github", color: "#333333" },
  gitlab: { icon: "md:gitlab", color: "#fc6d26" },
  mail: { icon: "md:email", color: "#ef4444" },
  email: { icon: "md:email", color: "#ef4444" },
  anilist: { icon: "si:anilist", color: "#02A9FF" },
  linkedin: { icon: "md:linkedin", color: "#0a66c2" },
  telegram: { icon: "md:telegram", color: "#26a5e4" },
  twitter: { icon: "md:twitter", color: "#1da1f2" },
  x: { icon: "md:twitter", color: "#1da1f2" },
  discord: { icon: "md:discord", color: "#5865f2" },
  instagram: { icon: "md:instagram", color: "#E1306C" },
  facebook: { icon: "md:facebook", color: "#1877F2" },
  youtube: { icon: "md:youtube", color: "#FF0000" },
  tiktok: { icon: "si:tiktok", color: "#ff0050" },
  reddit: { icon: "md:reddit", color: "#FF4500" },
  twitch: { icon: "md:twitch", color: "#9146FF" },
  pinterest: { icon: "md:pinterest", color: "#E60023" },
  snapchat: { icon: "md:snapchat", color: "#FFFC00" },
  whatsapp: { icon: "md:whatsapp", color: "#25D366" },
  spotify: { icon: "md:spotify", color: "#1DB954" },
  medium: { icon: "md:medium", color: "#000000" },
  dribbble: { icon: "md:dribbble", color: "#EA4C89" },
  behance: { icon: "md:behance", color: "#1769FF" },
};
