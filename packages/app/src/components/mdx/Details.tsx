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
      {summary && <summary>{summary}</summary>}
      {children}
    </details>
  );
}
