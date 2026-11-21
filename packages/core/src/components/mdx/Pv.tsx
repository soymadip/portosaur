/**
 * Pv (Preview) — trigger only in Phase 1: renders as a plain
 * link/button naming the previewed file. The viewer is Phase 2.
 */
export function Pv({
  href,
  children,
}: {
  /** The link target. Without it the text renders unlinked. */
  href?: string;
  children?: React.ReactNode;
}) {
  if (href) {
    return (
      <a
        href={href}
        className="porto-pv"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children ?? href}
      </a>
    );
  }
  return <span className="porto-pv">{children}</span>;
}
