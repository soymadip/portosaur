"use client";

import { useRef, useState, type ReactNode } from "react";
import { PortoIcon } from "../PortoIcon.tsx";

/**
 * CodeBlock — the `pre:` MDX mapping: wraps a Shiki-highlighted
 * `pre` in the Fumadocs-style frame. A fence with `title="..."`
 * gets a title bar (language icon, title, copy button); without
 * one, the copy button floats over the code's top-right corner.
 * `noCopy` in the fence meta hides the button; `lineNumbers`
 * (and `lineNumbers=<start>`) turns on line numbers. Inside code
 * tabs the frame drops its border — the tabs box is the frame.
 */
export function CodeBlock({
  title,
  icon,
  allowCopy = true,
  className,
  children,
  "data-line-numbers": lineNumbers,
  "data-line-numbers-start": lineNumbersStart,
}: {
  title?: string;
  icon?: string;
  allowCopy?: boolean | "true" | "false";
  className?: string;
  children?: ReactNode;
  "data-line-numbers"?: boolean;
  "data-line-numbers-start"?: number;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (allowCopy === "true") {
    allowCopy = true;
  } else if (allowCopy === "false") {
    allowCopy = false;
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

  const copyButton = (floating: boolean) => (
    <button
      type="button"
      className={
        floating
          ? "porto-code-copy porto-code-copy--floating"
          : "porto-code-copy"
      }
      data-copied={copied || undefined}
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy code"}
      title={copied ? "Copied" : "Copy code"}
    >
      <PortoIcon name={copied ? "check" : "copy"} size="0.875rem" />
    </button>
  );

  return (
    <figure className="porto-code-frame" dir="ltr" tabIndex={-1}>
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
          {allowCopy && copyButton(false)}
        </div>
      ) : (
        allowCopy && copyButton(true)
      )}
      <div
        ref={areaRef}
        tabIndex={0}
        className={[
          "porto-code-viewport",
          !title && allowCopy ? "porto-code-viewport--spaced" : "",
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
