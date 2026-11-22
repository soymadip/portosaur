/**
 * remarkFileTree
 *
 * Turns ```files fences into a `<FileTree>` component, so a tree
 * can be drawn as text instead of written out as JSX:
 *
 * ```files
 * project
 * ├── src
 * │   ├── index.ts
 * │   └── components
 * │       └── Button.tsx
 * ├── package.json
 * ```
 *
 * Nesting comes from the column each name starts at (a child
 * starts further right than its parent), so the tree characters
 * (`├──`, `│`, `└──`) are only decoration — plain indentation
 * works too. A name is a folder when it ends with `/` or when a
 * later line nests under it; the trailing `/` is stripped from
 * the displayed name. Every folder starts open: the author drew
 * the whole tree, so it shows in full. A fence with a single
 * root renders that root; several roots render side by side
 * with no wrapper folder.
 *
 * The shape follows Fumadocs' `remarkMdxFiles` (same parsing
 * idea, same open-by-default rendering), adapted to Portosaur's
 * `FileTree` / `File` / `Folder` components. The `<auto-files>`
 * glob syntax is deliberately not ported: it reads the build
 * machine's filesystem from content, which Portosaur doesn't
 * offer.
 */

interface FileNode {
  depth: number;
  type: "file";
  name: string;
}

interface FolderNode {
  depth: number;
  type: "folder";
  name: string;
  children: TreeNode[];
}

type TreeNode = FileNode | FolderNode;

/** Tree-drawing characters and whitespace at the start of a line. */
const TREE_PREFIX = /^[\s│├└─]+/;

/** Minimal recursive AST walker (no external dep, matches remarkIcons pattern). */
function visit(
  tree: any,
  type: string,
  visitor: (node: any, index: number, parent: any) => void,
): void {
  function walk(node: any, index: number | null, parent: any): void {
    if (node.type === type) {
      visitor(node, index as number, parent);
    }
    if (node.children) {
      for (let i = 0; i < node.children.length; i++) {
        walk(node.children[i], i, node);
      }
    }
  }
  walk(tree, null, null);
}

/**
 * A drawn tree as a node tree. Lines nest by column: a line's
 * parent is the nearest node above it starting further left.
 */
function parseFileTree(code: string): TreeNode | undefined {
  const lines = code.split(/\r?\n/);
  const stack = new Map<number, TreeNode>();
  // Top-level entries. Several are wrapped in a folder without
  // a name, which renders as just its children.
  const roots: TreeNode[] = [];

  for (const line of lines) {
    const name = line.replace(TREE_PREFIX, "");
    if (!name) {
      continue;
    }

    // Children start at a later column than their parent.
    const column = line.length - name.length;
    let parent: TreeNode | undefined;
    for (let i = column - 1; i >= 0 && !parent; i--) {
      parent = stack.get(i);
    }

    const depth = parent ? parent.depth + 1 : 0;
    const isFolder = name.endsWith("/");
    const node: TreeNode = isFolder
      ? { type: "folder", name: name.slice(0, -1), children: [], depth }
      : { type: "file", name, depth };
    stack.set(column, node);
    if (!parent) {
      roots.push(node);
      continue;
    }

    if (parent.type === "file") {
      // A file that gains a child is a folder after all.
      Object.assign(parent, {
        type: "folder",
        children: [],
      });
    }

    (parent as FolderNode).children.push(node);
  }

  if (roots.length === 0) {
    return undefined;
  }
  if (roots.length === 1) {
    return roots[0];
  }
  return { type: "folder", name: "", children: roots, depth: -1 };
}

function nodeToMdx(node: TreeNode, depth = 0): any {
  if (depth === 0) {
    return {
      type: "mdxJsxFlowElement",
      name: "FileTree",
      attributes: [],
      children:
        node.type === "folder" && node.name === ""
          ? node.children.map((item) => nodeToMdx(item, depth + 1))
          : [nodeToMdx(node, depth + 1)],
    };
  }

  const attributes: any[] = [
    { type: "mdxJsxAttribute", name: "name", value: node.name },
  ];

  if (node.type === "file") {
    return {
      type: "mdxJsxFlowElement",
      attributes,
      children: [],
      name: "File",
    };
  }

  // A valueless `defaultOpen` attribute (bare `defaultOpen` is
  // true). Fresh object per folder — the attribute objects are
  // part of the AST, so they must not be shared.
  attributes.push({
    type: "mdxJsxAttribute",
    name: "defaultOpen",
    value: null,
  });

  return {
    type: "mdxJsxFlowElement",
    attributes,
    name: "Folder",
    children: node.children.map((item) => nodeToMdx(item, depth + 1)),
  };
}

export default function remarkFileTree() {
  return (tree: any) => {
    visit(tree, "code", (node, index, parent) => {
      if (node.lang?.toLowerCase() !== "files") {
        return;
      }
      if (!node.value) {
        return;
      }
      const fileTree = parseFileTree(node.value);
      if (!fileTree) {
        return;
      }
      parent.children[index] = nodeToMdx(fileTree);
    });
  };
}
