import { usePluginData } from "@docusaurus/useGlobalData";

export const techMap = {
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
  "machine-learning": { icon: "md:robot", color: "#ec4863ff" }, // pink
  ml: { icon: "md:robot", color: "#ec4899" },
  economics: { icon: "md:chart-line", color: "#10b981" }, // emerald
  dbms: { icon: "md:database", color: "#3b82f6" }, // blue
  entrepreneurship: { icon: "md:lightbulb", color: "#f59e0b" }, // amber
  "data-mining": { icon: "md:database-search", color: "#8b5cf6" }, // purple
  warehouse: { icon: "md:warehouse", color: "#64748b" }, // slate

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

import { useState, useEffect } from "react";
import styles from "./styles.module.css";
import clsx from "clsx";
import { Icon as IconifyIcon, loadIcon } from "@iconify/react";
import Hint from "../Hint";
import { getPrefixMap } from "../../../src/utils/iconPrefixes.cjs";
import Search from "./Search/index.jsx";

const prefixMap = getPrefixMap();

export default function Icon({
  id,
  className,
  style,
  size,
  color,
  addSpace,
  ...props
}) {
  const [apiFailed, setApiFailed] = useState(false);

  if (!id) return null;

  const generatedIcons = usePluginData("portosaur-icons-plugin") || {};
  const mappedObj = techMap[id.toLowerCase()];
  const mappedId = mappedObj?.icon || id;
  const iconData = generatedIcons[mappedId];
  const displayColor = color;

  // Resolve short prefixes (si -> simple-icons) for the external API
  const parts = mappedId.split(":");
  const apiId =
    parts.length === 2 && prefixMap[parts[0]]
      ? `${prefixMap[parts[0]]}:${parts[1]}`
      : mappedId;

  const isOffline = typeof window !== "undefined" && !navigator.onLine;

  useEffect(() => {
    if (!iconData && process.env.NODE_ENV === "development") {
      if (isOffline) {
        setApiFailed(true);
      } else {
        setApiFailed(false);
        loadIcon(apiId).catch(() => setApiFailed(true));
      }
    }
  }, [apiId, iconData, isOffline]);

  if (!iconData) {
    if (process.env.NODE_ENV === "development" && !apiFailed && !isOffline) {
      console.warn(
        `[Icon] Missing offline icon: ${mappedId}. Fetching from API in dev mode...`,
      );
      return (
        <>
          <IconifyIcon
            icon={apiId}
            className={clsx(styles.icon, className)}
            style={{
              ...(size ? { fontSize: size } : {}),
              ...(displayColor ? { color: displayColor } : {}),
              ...style,
            }}
            aria-hidden="true"
            {...props}
          />
          {addSpace && " "}
        </>
      );
    }

    if (process.env.NODE_ENV !== "development") {
      console.warn(`[Icon] Missing icon in generated bundle: ${mappedId}`);
    }

    return (
      <>
        <Hint
          msg={
            isOffline ? (
              <span>
                You are offline. Go online or restart dev server to fetch '
                <strong>{mappedId}</strong>'.
              </span>
            ) : (
              <span>
                Icon '<strong>{mappedId}</strong>' not found. Check for typos!
              </span>
            )
          }
        >
          <svg
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            className={clsx(styles.icon, className)}
            style={{
              ...(size ? { fontSize: size } : {}),
              color: "#ff00ff", // Bright magenta to stand out
              ...style,
            }}
            role="img"
            aria-label={`Invalid icon: ${mappedId}`}
            {...props}
          >
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
        </Hint>
        {addSpace && " "}
      </>
    );
  }

  return (
    <>
      <svg
        {...iconData.attributes}
        className={clsx(styles.icon, className)}
        style={{
          ...(size ? { fontSize: size } : {}),
          ...(displayColor ? { color: displayColor } : {}),
          ...style,
        }}
        dangerouslySetInnerHTML={{ __html: iconData.body }}
        aria-hidden="true"
        {...props}
      />
      {addSpace && " "}
    </>
  );
}

Icon.Search = Search;
export { Search as IconSearch };
