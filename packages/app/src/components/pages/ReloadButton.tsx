"use client";

/** The offline page's "Try again" button — reloads the page. */
export function ReloadButton() {
  return (
    <button
      type="button"
      className="porto-btn porto-btn--primary"
      onClick={() => window.location.reload()}
    >
      Try again
    </button>
  );
}
