import type { PortosaurOptions } from "../../lib/config.ts";
import { Button } from "../Button.tsx";
import { SiteIcon } from "../SiteIcon.tsx";
import { SiteShell } from "./frame/SiteShell.tsx";

/**
 * NotFoundPage — the 404 page. Uses the shared empty-state
 * layout (the Astro page had its own `.not-found` styles, but
 * they are the same centered flex column). The route's metadata
 * title is "Page Not Found | {site}".
 */
export function NotFoundPage({ config }: { config: PortosaurOptions }) {
  return (
    <SiteShell config={config}>
      <div className="porto-empty-state">
        <div className="porto-empty-state__icon">
          <span>
            <SiteIcon icon="line-md:emoji-cry" size="5rem" />
          </span>
        </div>
        <h2 className="porto-empty-state__title">Page Not Found</h2>
        <p className="porto-empty-state__text">
          The page you&apos;re looking for doesn&apos;t exist, has been moved,
          or is currently unavailable.
        </p>
        <Button variant="primary" to="/">
          Go back home
        </Button>
      </div>
    </SiteShell>
  );
}
