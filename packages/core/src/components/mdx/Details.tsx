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
  open = false,
  className,
  children,
  ...rest
}: {
  /** The text on the collapsed header. */
  summary?: string | React.ReactElement;
  /** Open the disclosure initially. */
  open?: boolean;
  /** Additional class on the details element. */
  className?: string;
  children?: React.ReactNode;
} & React.DetailsHTMLAttributes<HTMLDetailsElement>) {
  return (
    <details
      className={className ? `porto-details ${className}` : "porto-details"}
      open={open || undefined}
      {...rest}
    >
      {summary && (
        <summary>
          <DetailsMarker />
          {summary}
        </summary>
      )}
      <div className="porto-details-content">{children}</div>
    </details>
  );
}
