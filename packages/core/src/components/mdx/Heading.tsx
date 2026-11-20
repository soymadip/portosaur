"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import { SiteIcon } from "../SiteIcon.tsx";

type Types = "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingProps<T extends Types> = Omit<ComponentPropsWithoutRef<T>, "as"> & {
  as?: T;
};

/**
 * Heading — the `h2:`–`h6:` MDX mapping, Fumadocs wiki style: the
 * heading text links to its own anchor, and a link button appears
 * beside it on hover. Clicking the button copies the page URL
 * with the heading's hash. A heading without an id renders plain.
 */
export function Heading<T extends Types = "h2">({
  as,
  ...props
}: HeadingProps<T>) {
  const As = as ?? "h2";
  const [copied, setCopied] = useState(false);

  if (!props.id) {
    return <As {...props} />;
  }
  const id = props.id;

  const copy = () => {
    const url = new URL(window.location.href);
    url.hash = id;
    void navigator.clipboard.writeText(url.href).then(
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

  return (
    <As
      {...props}
      className={["porto-heading", props.className].filter(Boolean).join(" ")}
    >
      <a href={`#${id}`}>{props.children}</a>
      <button
        type="button"
        className="porto-heading__anchor"
        data-copied={copied || undefined}
        onClick={copy}
        aria-label={copied ? "Copied anchor link" : "Copy anchor link"}
        title={copied ? "Copied anchor link" : "Copy anchor link"}
      >
        {copied ? (
          <SiteIcon icon="lu:check" size="0.875rem" />
        ) : (
          <SiteIcon icon="lu:link" size="0.875rem" />
        )}
      </button>
    </As>
  );
}
