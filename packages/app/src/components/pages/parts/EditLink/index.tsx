import { PortoIcon } from "../../../PortoIcon.tsx";

/** The "Edit page" link (pencil icon), rendered only with an edit URL. */
export function EditLink({ editUrl }: { editUrl?: string }) {
  if (!editUrl) {
    return null;
  }
  return (
    <a href={editUrl} className="porto-edit-link print:hidden">
      <PortoIcon name="pencil" size="1.2em" />
      Edit page
    </a>
  );
}
