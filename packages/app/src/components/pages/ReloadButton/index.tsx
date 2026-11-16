"use client";

import { Button } from "../../Button/index.tsx";

/** The offline page's "Try again" button — reloads the page. */
export function ReloadButton() {
  return (
    <Button variant="primary" onClick={() => window.location.reload()}>
      Try again
    </Button>
  );
}
