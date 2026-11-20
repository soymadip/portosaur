import type { PortosaurOptions } from "../../lib/config.ts";
import { RedirectBody } from "./RedirectBody.tsx";
import { SiteIcon } from "../SiteIcon.tsx";
import { SiteShell } from "./frame/SiteShell.tsx";

/**
 * RedirectPage — the redirect interstitial (`/redirect?url=…`).
 * The client logic lives in `RedirectBody`. This page renders
 * the shell + icon around it. The route's metadata title is
 * "Opening in browser… | {site}".
 */
export function RedirectPage({ config }: { config: PortosaurOptions }) {
  return (
    <SiteShell config={config}>
      <div className="porto-empty-state">
        <div className="porto-empty-state__icon porto-empty-state__icon--sm">
          <span>
            <SiteIcon icon="md:open-in-new" size="3rem" />
          </span>
        </div>
        <RedirectBody />
      </div>
    </SiteShell>
  );
}
