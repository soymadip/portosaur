"use client";

import { useEffect, useRef } from "react";
import type { Zoom } from "pele/core";

/**
 * Diagram — renders a build-time diagram. remarkMermaid turns
 * ```mermaid fences into `<Diagram svg="..."/>`, and the Pele SVG
 * goes straight into the page (Pele escapes diagram text and
 * filters links and styles, and the icons come from the site's own
 * Iconify packs). The wrapper centers the diagram (content.css).
 *
 * Zoom loads on demand: the `pele/core` import runs inside the
 * effect, so the zoom code only downloads on pages that actually
 * render a diagram. Importing from `pele/core`, not `pele` — the
 * main entry is one bundled file and would ship the whole renderer
 * (269KB gzip) for 3.5KB of zoom code. (next/dynamic does not help
 * here: the components map is serialized into every doc page, so
 * Next preloads the chunk anyway.)
 */
export function Diagram({ svg }: { svg: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let zoom: Zoom | undefined;
    import("pele/core").then((mod) => {
      if (!cancelled && ref.current) {
        zoom = mod.enableZoom(ref.current, { always: true });
      }
    });
    return () => {
      cancelled = true;
      zoom?.destroy();
    };
  }, []);

  return (
    <div
      ref={ref}
      className="porto-diagram"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
