import type { PortosaurOptions } from "../../lib/config.ts";
import { renderIcon } from "../../lib/icons.ts";
import { RedirectBody } from "./RedirectBody.tsx";
import { SiteShell } from "./frame/SiteShell/index.tsx";

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
          <span
            dangerouslySetInnerHTML={{
              __html: renderIcon("md:open-in-new", { size: "3rem" }),
            }}
          />
        </div>
        <RedirectBody />
      </div>
    </SiteShell>
  );
}
