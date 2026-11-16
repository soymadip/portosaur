import type { PortosaurOptions } from "../../../lib/config.ts";
import { renderIcon } from "../../../lib/icons.ts";
import { ReloadButton } from "../ReloadButton/index.tsx";
import { SiteShell } from "../frame/SiteShell/index.tsx";

/**
 * OfflinePage — the offline fallback page (served by the PWA
 * when there is no connection; the route's metadata title is
 * "You're Offline | {site}").
 */
export function OfflinePage({ config }: { config: PortosaurOptions }) {
  return (
    <SiteShell config={config}>
      <div className="porto-empty-state">
        <div className="porto-empty-state__icon">
          <span
            dangerouslySetInnerHTML={{
              __html: renderIcon("line-md:cloud-alt-off-loop", {
                size: "5rem",
              }),
            }}
          />
        </div>
        <h2 className="porto-empty-state__title">You&apos;re Offline</h2>
        <p className="porto-empty-state__text">
          It looks like you don&apos;t have an internet connection. Previously
          visited pages are still available from cache.
        </p>
        <ReloadButton />
      </div>
    </SiteShell>
  );
}
