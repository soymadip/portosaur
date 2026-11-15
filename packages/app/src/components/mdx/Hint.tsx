/**
 * Hint — simplified tooltip: the `msg` prop (the hint's content
 * lives in the prop, not in children) renders in a tinted box
 * above any children. OG's full portal tooltip is Phase 2 scope.
 */
export function Hint({
  msg,
  children,
}: {
  msg?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="porto-hint">
      {msg && <div className="porto-hint__msg">{msg}</div>}
      {children}
    </div>
  );
}
