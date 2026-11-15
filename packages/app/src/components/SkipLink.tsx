/**
 * Skip link — visually hidden until focused. Targets `#main-content`
 * (the layout's `<main>`), not the page title — non-docs pages have
 * no `#_top` heading.
 */
export function SkipLink() {
  return (
    <a className="porto-skip-link" href="#main-content">
      Skip to main content
    </a>
  );
}
