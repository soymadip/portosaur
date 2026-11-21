/**
 * Diagram — renders a build-time diagram. remarkMermaid turns
 * ```mermaid fences into `<Diagram svg="..."/>`, and the Pele SVG
 * goes straight into the page (Pele escapes diagram text and
 * filters links and styles, and the icons come from the site's own
 * Iconify packs). The wrapper centers the diagram (content.css).
 */
export function Diagram({ svg }: { svg: string }) {
  return (
    <div className="porto-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
  );
}
