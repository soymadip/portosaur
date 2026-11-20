"use client";

import { useRef, useState, type ReactNode } from "react";
import { PortoIcon } from "../PortoIcon.tsx";

/**
 * CodeBlock — the `pre:` MDX mapping: wraps a Shiki-highlighted
 * `pre` in the Fumadocs-style frame. A fence with `title="..."`
 * gets a title bar (language icon, title, wrap + copy buttons).
 * Without one, the buttons float over the code's top-right
 * corner. `noCopy` in the fence meta hides the copy button,
 * `noWrap` hides the wrap button. `lineNumbers` (and
 * `lineNumbers=<start>`) turns on line numbers. Inside code
 * tabs the frame drops its border — the tabs box is the frame.
 *
 * The wrap button toggles `porto-code-frame--wrapped` on this
 * block only: long lines wrap at the block's edge instead of
 * scrolling sideways. Off by default, per block.
 */
export function CodeBlock({
  title,
  icon,
  allowCopy = true,
  allowWrap = true,
  className,
  children,
  "data-line-numbers": lineNumbers,
  "data-line-numbers-start": lineNumbersStart,
}: {
  title?: string;
  icon?: string;
  allowCopy?: boolean | "true" | "false";
  allowWrap?: boolean | "true" | "false";
  className?: string;
  children?: ReactNode;
  "data-line-numbers"?: boolean;
  "data-line-numbers-start"?: number;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [wrapped, setWrapped] = useState(false);

  if (allowCopy === "true") {
    allowCopy = true;
  } else if (allowCopy === "false") {
    allowCopy = false;
  }

  if (allowWrap === "true") {
    allowWrap = true;
  } else if (allowWrap === "false") {
    allowWrap = false;
  }

  const copy = () => {
    const pre = areaRef.current?.getElementsByTagName("pre").item(0);
    if (!pre) {
      return;
    }
    const clone = pre.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".nd-copy-ignore").forEach((node) => {
      node.replaceWith("\n");
    });
    void navigator.clipboard.writeText(clone.textContent ?? "").then(
      () => {
        setCopied(true);
        window.setTimeout(() => {
          setCopied(false);
        }, 1500);
      },
      () => {
        /* Clipboard unavailable — the copy silently fails. */
      },
    );
  };

  const copyButton = () => (
    <button
      type="button"
      className="porto-code-copy"
      data-copied={copied || undefined}
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy code"}
      title={copied ? "Copied" : "Copy code"}
    >
      <PortoIcon name={copied ? "check" : "copy"} size="0.875rem" />
    </button>
  );

  const wrapButton = () => (
    <button
      type="button"
      className="porto-code-wrap"
      data-active={wrapped || undefined}
      onClick={() => {
        setWrapped((w) => !w);
      }}
      aria-label={wrapped ? "Unwrap lines" : "Wrap lines"}
      aria-pressed={wrapped}
      title={wrapped ? "Unwrap lines" : "Wrap lines"}
    >
      <PortoIcon name="wrap-text" size="0.875rem" />
    </button>
  );

  // Floating buttons (no title bar): the first line keeps room
  // for one (2.5rem) or two (4rem) — see code.css.
  const floatingCount = title ? 0 : (allowCopy ? 1 : 0) + (allowWrap ? 1 : 0);

  return (
    <figure
      className={
        wrapped
          ? "porto-code-frame porto-code-frame--wrapped"
          : "porto-code-frame"
      }
      dir="ltr"
      tabIndex={-1}
    >
      {title ? (
        <div className="porto-code-header">
          {icon ? (
            <span
              className="porto-code-icon"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: icon }}
            />
          ) : null}
          <figcaption className="porto-code-title">{title}</figcaption>
          {allowWrap && wrapButton()}
          {allowCopy && copyButton()}
        </div>
      ) : (
        floatingCount > 0 && (
          <div className="porto-code-actions">
            {allowWrap && wrapButton()}
            {allowCopy && copyButton()}
          </div>
        )
      )}
      <div
        ref={areaRef}
        tabIndex={0}
        className={[
          "porto-code-viewport",
          floatingCount === 1 ? "porto-code-viewport--spaced" : "",
          floatingCount === 2 ? "porto-code-viewport--spaced-2" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <pre
          className={className}
          data-line-numbers={lineNumbers || undefined}
          data-line-numbers-start={lineNumbersStart}
          style={
            lineNumbersStart
              ? { counterSet: `line ${Number(lineNumbersStart) - 1}` }
              : undefined
          }
        >
          {children}
        </pre>
      </div>
    </figure>
  );
}
