"use client";

import Link from "next/link";
import { usePortoConfig } from "../../../lib/porto-context.tsx";

/**
 * The navbar brand: the site title plus the generated favicon logo,
 * linked to the site root. The favicon path is base-less — Next.js
 * `<img>` does not prepend `basePath`, so the base prefix comes
 * from config (`site.baseUrl`).
 */
export function SiteTitle() {
  const config = usePortoConfig();
  const site = config.site;
  const base = site.baseUrl ?? "/";
  const basePrefix = base === "/" ? "" : base.replace(/\/+$/, "");
  const logoSrc = `${basePrefix}/favicon/favicon.ico`;
  return (
    <Link href="/" className="porto-site-title">
      {/* Explicit dimensions: CSS sizes the rendered logo, but
          without attributes a missing file renders its alt text
          at the title's font size instead of a 32px box. */}
      <img src={logoSrc} alt={`${site.title} logo`} width={32} height={32} />
      <span translate="no">{site.title}</span>
    </Link>
  );
}
