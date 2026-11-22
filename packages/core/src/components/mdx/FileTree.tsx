import { SiteIcon } from "../SiteIcon.tsx";
import { getFileIcon, getFolderIcon } from "../../lib/fileIcons.ts";

/**
 * FileTree — a file listing for docs: folders that open and
 * close, files as rows. The look follows Fumadocs' file tree —
 * a bordered card, rows with an icon and a name, a hairline
 * guide behind nested rows, no chevron: the folder icon itself
 * swaps open and closed. A Folder is a native `<details>`
 * element, so no JavaScript is involved.
 *
 * Icons come from the name when no `icon` prop is given: a
 * file by its extension or well-known name (`package.json`,
 * `Dockerfile`), a folder by its name (`src`, `docs`) — see
 * lib/fileIcons.ts. A folder with its own icon keeps it open
 * and closed. A `comment` renders after the name, muted, with
 * a `#` in front of it.
 */
export function FileTree({ children }: { children?: React.ReactNode }) {
  return <div className="porto-file-tree not-content">{children}</div>;
}

/**
 * File — one row in a `FileTree`: an icon and a name. The icon
 * comes from the file's extension or well-known name unless
 * the `icon` prop gives an Iconify id.
 */
export function File({
  name,
  icon,
  comment,
}: {
  /** The file name. */
  name: string;
  /** An Iconify id for the file icon, like `lu:file-json`. Defaults to the icon for the file's extension or name. */
  icon?: string;
  /** A note after the name, shown muted with a `#` in front of it. */
  comment?: string;
}) {
  return (
    <div className="porto-file-tree__file">
      <span className="porto-file-tree__file-icon">
        <SiteIcon
          icon={icon ?? getFileIcon(name)}
          fallbackIcon="lu:file"
          size="16px"
        />
      </span>
      <span className="porto-file-tree__name">{name}</span>
      {comment && (
        <span className="porto-file-tree__comment">{`# ${comment}`}</span>
      )}
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
  icon,
  defaultOpen = false,
  comment,
  children,
}: {
  /** The folder name. */
  name: string;
  /** An Iconify id for the folder icon. Defaults to the icon for the folder's name, or the folder glyph. */
  icon?: string;
  /** Open the folder by default. Closed by default. */
  defaultOpen?: boolean;
  /** A note after the name, shown muted with a `#` in front of it. */
  comment?: string;
  children?: React.ReactNode;
}) {
  // A folder with its own icon (given, or from its name) keeps
  // it open and closed; otherwise the glyph swaps like Fumadocs.
  const folderIcon = icon ?? getFolderIcon(name);
  return (
    <details
      className="porto-file-tree__folder"
      open={defaultOpen || undefined}
    >
      <summary className="porto-file-tree__folder-summary">
        <span className="porto-file-tree__folder-icon">
          {folderIcon ? (
            <SiteIcon icon={folderIcon} size="16px" />
          ) : (
            <>
              <span className="porto-file-tree__folder-icon--closed">
                <SiteIcon icon="lu:folder" size="16px" />
              </span>
              <span className="porto-file-tree__folder-icon--open">
                <SiteIcon icon="lu:folder-open" size="16px" />
              </span>
            </>
          )}
        </span>
        <span className="porto-file-tree__name">{name}</span>
        {comment && (
          <span className="porto-file-tree__comment">{`# ${comment}`}</span>
        )}
      </summary>
      <div className="porto-file-tree__folder-children">{children}</div>
    </details>
  );
}
