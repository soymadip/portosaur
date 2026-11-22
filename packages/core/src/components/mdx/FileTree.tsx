import { SiteIcon } from "../SiteIcon.tsx";
import { DetailsMarker } from "./Details.tsx";

/**
 * FileTree — a file listing for docs: folders that open and
 * close, files as rows. A Folder is a native `<details>`
 * element (the same collapsible Details uses), so no JavaScript
 * is involved — the chevron rotates and the folder icon swaps
 * open and closed in CSS. File names render in mono.
 */
export function FileTree({ children }: { children?: React.ReactNode }) {
  return <div className="porto-file-tree not-content">{children}</div>;
}

/**
 * File — one row in a `FileTree`: an icon and a mono name. The
 * icon is a plain file unless the `icon` prop gives an Iconify
 * id.
 */
export function File({
  name,
  icon,
}: {
  /** The file name, shown in mono. */
  name: string;
  /** An Iconify id for the file icon, like `lu:file-json`. Defaults to a plain file. */
  icon?: string;
}) {
  return (
    <div className="porto-file-tree__file">
      <span className="porto-file-tree__file-icon">
        <SiteIcon icon={icon} fallbackIcon="lu:file" size="16px" />
      </span>
      <span className="porto-file-tree__name">{name}</span>
    </div>
  );
}

/**
 * Folder — a collapsible folder in a `FileTree`: a native
 * `<details>` element, so no JavaScript is involved. Closed by
 * default unless `defaultOpen` is set.
 */
export function Folder({
  name,
  defaultOpen = false,
  children,
}: {
  /** The folder name, shown in mono. */
  name: string;
  /** Open the folder by default. Closed by default. */
  defaultOpen?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <details
      className="porto-file-tree__folder"
      open={defaultOpen || undefined}
    >
      <summary className="porto-file-tree__folder-summary">
        <DetailsMarker />
        <span className="porto-file-tree__folder-icon">
          <span className="porto-file-tree__folder-icon--closed">
            <SiteIcon icon="lu:folder" size="16px" />
          </span>
          <span className="porto-file-tree__folder-icon--open">
            <SiteIcon icon="lu:folder-open" size="16px" />
          </span>
        </span>
        <span className="porto-file-tree__name">{name}</span>
      </summary>
      <div className="porto-file-tree__folder-children">{children}</div>
    </details>
  );
}
