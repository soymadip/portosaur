/**
 * Steps — a numbered sequence for guides and tutorials. Each
 * Step takes an optional title and its body as children. The
 * numbers come from a CSS counter, so no JavaScript is involved:
 * the badge and the line joining the steps are both drawn in
 * Steps.css.
 */
export function Steps({ children }: { children?: React.ReactNode }) {
  return <div className="porto-steps not-content">{children}</div>;
}

export function Step({
  title,
  children,
}: {
  /** The step heading. */
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="porto-step">
      <div className="porto-step__body">
        {title ? <p className="porto-step__title">{title}</p> : null}
        <div className="porto-step__content">{children}</div>
      </div>
    </div>
  );
}
