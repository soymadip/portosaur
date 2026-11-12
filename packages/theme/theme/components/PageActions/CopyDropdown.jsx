import { useState, useEffect } from "react";
import { Dropdown } from "../UI/index.jsx";
import Icon from "../Icon/index.jsx";
import Hint from "../Hint/index.jsx";
import Pv from "../Preview/components/Triggers/Pv.jsx";
import dropdownStyles from "../UI/Dropdown/styles.module.css";
import styles from "./styles.module.css";

import { extractPageMarkdownFromDocument } from "./htmlToMarkdown";

export default function CopyDropdown({ mobile = false, editUrl, sourceRaw }) {
  const [pageContent, setPageContent] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const content = extractPageContent();
    if (content) {
      setPageContent(content);
    }
  }, []);

  const extractPageContent = () => {
    return extractPageMarkdownFromDocument(document, window.location.href);
  };

  const writeTextToClipboard = async (text) => {
    if (!text || text.trim() === "") return;

    // Fallback using textarea (Triggers native Android 13+ clipboard toast visually)
    const fallbackCopy = () => {
      const textArea = document.createElement("textarea");
      textArea.value = text;

      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand("copy");
      } catch (err) {
        console.error("Fallback: Oops, unable to copy", err);
      }

      document.body.removeChild(textArea);
    };

    try {
      if (
        navigator.clipboard &&
        navigator.clipboard.writeText &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(text);
        // Sometimes navigator.clipboard doesn't trigger Android's native visual toast.
        // We can optionally still run the fallback if we want to force the toast,
        // but typically modern browsers handle it. However, if the user explicitly
        // wants the native toast, executing the fallback is the most reliable way.
      } else {
        fallbackCopy();
      }
    } catch (err) {
      fallbackCopy();
    }

    // To guarantee the Android native visual toast triggers in Chrome on Android,
    // the safest cross-platform way is to explicitly run the legacy execCommand.
    // So we will just run the fallback regardless to force the UI toast on mobile!
    if (/android/i.test(navigator.userAgent)) {
      fallbackCopy();
    }
  };

  const copyToClipboard = async (text) => {
    if (!text || text.trim() === "") {
      const extractedContent = extractPageContent();
      if (extractedContent) {
        setPageContent(extractedContent);
        text = extractedContent;
      } else {
        return;
      }
    }
    await writeTextToClipboard(text);
  };

  const openInAI = async (baseUrl, param = "q", extraParams = {}) => {
    let content = pageContent;
    if (!content || content.trim() === "") {
      content = extractPageContent();
      if (!content) return;
    }

    const contextPrefix = `Help me with this documentation:\n\nUrl: ${window.location.href}\n\n`;
    const fullPrompt = `${contextPrefix}\`\`\`markdown\n${content}\n\`\`\``;

    let urlPrompt = fullPrompt;

    // Most browsers and servers safely accept URLs around 2000-4000 chars.
    // If it's too long, copy to clipboard and handle gracefully.
    if (fullPrompt.length > 3000) {
      await writeTextToClipboard(fullPrompt);

      urlPrompt = `I need help with this documentation: ${window.location.href}\n\n(The page content is too long for the URL, so it has been automatically copied to my clipboard. I will paste it below, just ask if needed!)`;
      alert(
        "Page is too long for a direct link! \n\nThe full Markdown has been copied to clipboard.\nPlease paste it into the AI chat.",
      );
    }

    const url = new URL(baseUrl);
    url.searchParams.set(param, urlPrompt);
    Object.entries(extraParams).forEach(([k, v]) => url.searchParams.set(k, v));

    window.open(url.toString(), "_blank", "noopener,noreferrer");
  };

  const items = [
    ...(mobile && editUrl
      ? [
          {
            id: "edit-page",
            label: "Edit this page",
            href: editUrl,
            sameTab: true,
            icon: <Icon id="lucide:pencil" />,
          },
        ]
      : []),
    {
      id: "copy",
      label: "Copy Markdown",
      desc: "Copy the raw Markdown to your clipboard",
      icon: <Icon id="md:content-copy" />,
      onClick: () => copyToClipboard(pageContent),
    },
    ...(mobile && sourceRaw
      ? [
          {
            id: "source-preview",
            render: ({ closeMenu }) => (
              <span style={{ display: "contents" }} onClick={closeMenu}>
                <Pv
                  href={sourceRaw}
                  activeIdx={0}
                  noUl
                  className={dropdownStyles.dropdownMenuItem}
                >
                  <Icon id="lucide:code-xml" />
                  {Array.isArray(sourceRaw) && sourceRaw.length > 1
                    ? "View Sources"
                    : "View Source"}
                </Pv>
              </span>
            ),
          },
        ]
      : []),
    {
      type: "separator",
    },
    {
      id: "chatgpt",
      label: "Open in ChatGPT",
      desc: "Send this page to ChatGPT",
      icon: <Icon id="si:openai" />,
      onClick: () => openInAI("https://chatgpt.com/"),
    },
    {
      id: "claude",
      label: "Open in Claude",
      desc: "Send this page to Claude",
      icon: <Icon id="si:anthropic" />,
      onClick: () => openInAI("https://claude.ai/new"),
    },
    {
      id: "perplexity",
      label: "Open in Perplexity",
      desc: "Send this page to Perplexity AI",
      icon: <Icon id="si:perplexity" />,
      onClick: () => openInAI("https://www.perplexity.ai/search", "q"),
    },
    {
      id: "gemini",
      label: "Open in Gemini",
      desc: "Send this page to Google Gemini",
      icon: <Icon id="si:googlegemini" />,
      onClick: () =>
        openInAI("https://www.google.com/search", "q", { udm: "50" }),
    },
  ];

  const trigger = mobile ? (
    <Hint msg="Page actions" noUl hideOnClick>
      <button
        type="button"
        className={styles.actionBtn}
        aria-label="Page actions"
      >
        <Icon id="lucide:ellipsis-vertical" className={styles.iconOnly} />
      </button>
    </Hint>
  ) : (
    <Hint msg="Copy Page" noUl hideOnClick>
      <div className={styles.actionBtn}>
        <Icon id="md:content-copy" className={styles.iconOnly} />
      </div>
    </Hint>
  );

  return (
    <Dropdown
      trigger={trigger}
      items={items}
      style={{ margin: 0 }}
      menuClassName={styles.rightAlignMenu}
      openOnHover={false}
      noArrow
    />
  );
}
