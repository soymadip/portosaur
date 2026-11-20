import type { SidebarLink } from "../../../lib/content.ts";
import { EditLink } from "./EditLink.tsx";
import { LastUpdated } from "./LastUpdated.tsx";
import { Pagination } from "./Pagination.tsx";

/** The doc-page footer: meta row (edit + last updated) + Pagination. */
export function DocFooter({
  editUrl,
  lastUpdated,
  prev,
  next,
}: {
  editUrl?: string;
  lastUpdated?: string;
  prev?: SidebarLink | null;
  next?: SidebarLink | null;
}) {
  return (
    <footer className="porto-doc-footer">
      <div className="porto-doc-footer__meta">
        <EditLink editUrl={editUrl} />
        <LastUpdated lastUpdated={lastUpdated} />
      </div>
      <Pagination prev={prev} next={next} />
    </footer>
  );
}
