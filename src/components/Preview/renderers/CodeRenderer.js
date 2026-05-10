import React from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { Highlight } from "prism-react-renderer";

/**
 * Self-contained code highlighter using prism-react-renderer.
 * Reads the Prism theme directly from Docusaurus site config.
 */
export default function CodeRenderer({ code, language }) {
  const { siteConfig } = useDocusaurusContext();
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";

  const prismConfig = siteConfig?.themeConfig?.prism || {};
  const prismTheme = isDark ? prismConfig.darkTheme : prismConfig.theme;

  return (
    <Highlight code={code} language={language || "text"} theme={prismTheme}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={className}
          style={{
            ...style,
            margin: 0,
            borderRadius: 0,
            padding: "14px 0",
            fontSize: "0.85rem",
            lineHeight: 1.6,
            minHeight: "100%",
            background: "var(--ifm-background-color)",
          }}
        >
          {tokens.map((line, i) => (
            <div
              key={i}
              {...getLineProps({ line })}
              style={{ display: "flex" }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: "3em",
                  paddingLeft: "14px",
                  userSelect: "none",
                  opacity: 0.4,
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </span>
              <span style={{ paddingRight: "14px" }}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </span>
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  );
}
