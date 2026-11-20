import { SiteIcon } from "../SiteIcon.tsx";

/** The chevron marker every summary carries (rotates on open). */
export function DetailsMarker() {
  return (
    <span className="porto-details-marker" aria-hidden="true">
      <SiteIcon icon="md:chevron-right" />
    </span>
  );
}

/**
 * Details — native `<details>` element. The Docusaurus
 * `<Details summary="…">` shape maps directly onto it. Styled by
 * the prose rules in content.css.
 */
export function Details({
  summary,
  children,
}: {
  summary?: string;
  children?: React.ReactNode;
}) {
  return (
    <details className="porto-details">
      {summary && (
        <summary>
          <DetailsMarker />
          {summary}
        </summary>
      )}
      {children}
    </details>
  );
}
