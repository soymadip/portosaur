import { useState } from "react";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import { Highlight } from "prism-react-renderer";
import styles from "../styles.module.css";
import IconCopy from "../../../../assets/svg/icon-copy.svg";
import IconCheck from "../../../../assets/svg/icon-check.svg";

export default function CodeRenderer({ code, language, zoomLevel = 1 }) {
  const { siteConfig } = useDocusaurusContext();
  const [copied, setCopied] = useState(false);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") === "dark";
  const prismConfig = siteConfig?.themeConfig?.prism || {};
  const prismTheme = isDark ? prismConfig.darkTheme : prismConfig.theme;
  const normalizedLanguage = language === "patch" ? "diff" : language || "text";

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.codeContainer}>
      <button
        onClick={handleCopy}
        className={`${styles.copyButton} ${copied ? styles.copyButtonCopied : ""}`}
        title="Copy Code"
      >
        <span className={styles.copyButtonIcons}>
          <IconCopy className={styles.copyIcon} />
          <IconCheck className={styles.successIcon} />
        </span>
      </button>

      <Highlight
        code={code}
        language={normalizedLanguage}
        theme={prismTheme}
        {...(typeof window !== "undefined" && window.Prism
          ? { prism: window.Prism }
          : {})}
      >
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={className}
            style={{
              ...style,
              margin: 0,
              borderRadius: 0,
              padding: "14px 0",
              fontSize: `calc(0.85rem * var(--zoom, ${zoomLevel}))`,
              lineHeight: 1.6,
              minHeight: "100%",
              backgroundColor:
                style?.backgroundColor || "var(--ifm-background-color)",
              overflow: "auto",
            }}
          >
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              const lineContent = line.map((t) => t.content).join("");
              let diffStyle = {};

              if (normalizedLanguage === "diff") {
                if (lineContent.startsWith("+")) {
                  diffStyle = {
                    background: "rgba(var(--ifm-color-success-rgb), 0.15)",
                    borderLeft: "3px solid var(--ifm-color-success)",
                  };
                } else if (lineContent.startsWith("-")) {
                  diffStyle = {
                    background: "rgba(var(--ifm-color-danger-rgb), 0.15)",
                    borderLeft: "3px solid var(--ifm-color-danger)",
                  };
                }
              }

              return (
                <div
                  key={i}
                  {...lineProps}
                  style={{
                    ...lineProps.style,
                    ...diffStyle,
                    display: "flex",
                    paddingLeft: diffStyle.borderLeft ? "0px" : "3px",
                  }}
                >
                  {/* Line number gutter */}
                  <span
                    style={{
                      display: "inline-block",
                      width: "1.7em",
                      textAlign: "right",
                      marginRight: "12px",
                      userSelect: "none",
                      opacity: 0.35,
                      flexShrink: 0,
                      fontFamily: "var(--ifm-font-family-monospace)",
                    }}
                  >
                    {i + 1}
                  </span>

                  {/* Token content */}
                  <span style={{ paddingRight: "14px", flex: 1 }}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
