import { SiteIcon } from "../../SiteIcon.tsx";

/** The "Edit page" link (pencil icon), rendered only with an edit URL. */
export function EditLink({ editUrl }: { editUrl?: string }) {
  if (!editUrl) {
    return null;
  }
  return (
    <a href={editUrl} className="porto-edit-link print:hidden">
      <SiteIcon icon="mdi:pencil-outline" size="1.2em" />
      Edit page
    </a>
  );
}
