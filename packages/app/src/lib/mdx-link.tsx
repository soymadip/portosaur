import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { pageHref } from "./pageUrl.ts";

/**
 * The MDX `a` component factory — Portosaur's own relative-link
 * resolution for MDX content.
 *
 * MDX authors link with relative file paths (`./guide/setup.mdx`)
 * or page pathnames (`/docs/guide`); the loader's `resolveHref`
 * turns those into page URLs. The generated doc route passes the
 * result as the `a` override to `getMDXComponents` (the scaffold
 * pattern — `createRelativeLink` there came from `fumadocs-ui/mdx`,
 * which Portosaur does not depend on).
 *
 * Internal links render through Next.js `<Link>` (SPA navigation +
 * prefetch, trailing-slashed); external links and hash links render
 * as plain anchors.
 */

/** The loader surface this helper needs (a subset of `LoaderOutput`). */
export interface HrefResolver {
  resolveHref: (href: string, page: unknown) => string;
}

type AnchorProps = ComponentProps<"a">;

export function createRelativeLink(
  source: HrefResolver,
  page: unknown,
): (props: AnchorProps) => ReactNode {
  return function MdxLink({ href, ...props }: AnchorProps) {
    if (!href) {
      return <a {...props} />;
    }
    // Absolute URLs, protocol-relative URLs, and hash links pass
    // through unchanged — never resolve or slash them.
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(href)) {
      const external = /^https?:\/\//.test(href);
      return (
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
          {...props}
        />
      );
    }
    const resolved = pageHref(source.resolveHref(href, page));
    return <Link href={resolved} {...props} />;
  };
}
