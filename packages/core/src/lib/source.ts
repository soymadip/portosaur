/**
 * The Fumadocs content layer: frontmatter schema, slug function, and
 * page-tree transformers. Imported by the CLI-generated `lib/source.ts`
 * (see the contracts file), which wires them into `defineDocs` +
 * `loader()`.
 *
 * Slug algorithm: Portosaur's own (`lib/slug.ts`, the Docusaurus-era
 * algorithm the golden URLs encode), run inside Fumadocs' `slugs`
 * hook. Duplicate slugs throw a build error (Fumadocs' slugs plugin
 * does that itself).
 *
 * Trailing slashes: Fumadocs' loader normalizes page/tree URLs to
 * slashless form (`normalizeUrl` strips a trailing `/`), so the
 * loader-level URLs are slashless by design. Rendered links get the
 * trailing slash back from `pageHref` (`lib/pageUrl.ts`), and
 * `trailingSlash: true` in the generated next.config makes the
 * static export emit slashed pages.
 */
import path from "node:path";
import { z } from "zod";
import type {
  ContentStoragePageFile,
  PageTreeTransformer,
} from "fumadocs-core/source";
import type * as PageTree from "fumadocs-core/page-tree";
import type { SlugFn } from "fumadocs-core/source/plugins/slugs";
import { pageSchema } from "fumadocs-core/source/schema";
import {
  cleanSegment,
  guessDocPermalink,
  NUMBER_PREFIX_PATTERN,
  type Frontmatter,
} from "./slug.ts";
import { collectParentSlugs } from "./slug-server.ts";

/**
 * Portosaur's frontmatter schema for doc/note/blog pages.
 *
 * Fumadocs' `pageSchema` requires `title` and carries `description`.
 * Portosaur keeps `title` optional (the content H1 is the fallback —
 * decision 11) and renames the description key to `desc` (decision
 * 25, matching Portosaur's `desc` convention). The remaining fields
 * are the Astro `docSchema` shapes, minus `sidebar_position` (removed
 * — decision 24) and plus `math` (frontmatter flag for the KaTeX
 * stylesheet gate), `sidebar_collapsed` (per-page sidebar
 * default — overrides `theme.navigation.sidebar_collapsed`), and
 * `table_of_contents` (per-page table of contents settings —
 * overrides `site.content.toc` field by field). The frontmatter key
 * is `toc`: Fumadocs puts the compiled heading list on
 * `page.data.toc`, so the schema renames the key to
 * `table_of_contents` on the way in (a zod transform, applied by
 * the loader before Fumadocs merges its own `toc` in) and the
 * rest of the code reads `table_of_contents`.
 * Unknown keys are stripped by zod.
 *
 * The `file` transformer maps `desc` onto the page-tree node's
 * `description`. Page metadata reads `page.data.desc` directly.
 */
export const portoDocSchema = pageSchema
  .omit({ title: true, description: true })
  .extend({
    title: z.string().optional(),
    desc: z.string().optional(),
    hide_title: z.boolean().optional(),
    hide_desc: z.boolean().optional(),
    color: z.string().optional(),
    sidebar_label: z.string().optional(),
    // A slug renames only the file's own segment: one piece, no
    // slashes, at least one letter or digit (so cleaning it never
    // yields an empty segment). A regex, not a refine, so the
    // constraint survives into the generated JSON Schema as a
    // pattern and the editor warns too.
    slug: z
      .string()
      .regex(
        /^[^/]*[a-zA-Z0-9][^/]*$/,
        "slug must be a single segment, no slashes",
      )
      .optional(),
    topic_list: z
      .union([z.boolean(), z.record(z.string(), z.any())])
      .optional(),
    tags: z.array(z.string()).optional(),
    authors: z
      .array(z.union([z.string(), z.record(z.string(), z.any())]))
      .optional(),
    image: z.string().optional(),
    pagination_label: z.string().optional(),
    id: z.string().optional(),
    date: z.coerce.date().optional(),
    draft: z.boolean().optional(),
    math: z.boolean().optional(),
    sidebar_collapsed: z.boolean().optional(),
    toc: z
      .object({
        enable: z.boolean().optional(),
        min_level: z.number().optional(),
        max_level: z.number().optional(),
      })
      .optional(),
  })
  // Fumadocs puts the compiled heading list on `page.data.toc`,
  // so the frontmatter key is renamed on the way in — the loader
  // validates before Fumadocs merges its own `toc` in, and the
  // rest of the code reads `table_of_contents`.
  .transform(({ toc, ...rest }) => ({
    ...rest,
    ...(toc ? { table_of_contents: toc } : {}),
  }));

/** The validated frontmatter of a doc/note/blog page. */
export type PortoDocData = z.infer<typeof portoDocSchema>;

/** Blog posts use the same frontmatter schema as docs pages. */
export const portoBlogSchema = portoDocSchema;

/** The file shape the slug function receives from the loader. */
export type PortoPageFile = ContentStoragePageFile<
  string | undefined,
  PortoDocData
>;

/**
 * Portosaur's slug function for the loader's `slugs` option.
 *
 * Runs the shared `guessDocPermalink` algorithm on the file's
 * content-relative path + frontmatter. Parent index slugs are
 * resolved from disk via the file's `absolutePath` (cached reads —
 * `parseFileFrontmatter`). When no absolute path is available the
 * parent lookup is empty and directories fall back to their cleaned
 * names. A root index file returns `[]` (the base URL itself).
 */
export const portoSlugs: SlugFn = (file, _next) => {
  const portoFile = file as PortoPageFile;
  const absolutePath = portoFile.absolutePath;
  const parentSlugs = absolutePath
    ? collectParentSlugs(absolutePath, portoFile.path)
    : {};
  const { slug } = guessDocPermalink(
    portoFile.path,
    (portoFile.data ?? {}) as Frontmatter,
    parentSlugs,
  );
  return slug === "" ? [] : slug.split("/");
};

/**
 * Fumadocs' `pathToName` fallback (not exported): capitalize the
 * first letter, turn `-` into spaces.
 */
function pathToName(name: string): string {
  const [first = "", ...rest] = name;
  return first.toLocaleUpperCase() + rest.join("").replaceAll("-", " ");
}

/**
 * Strips a number prefix from a folder name for display
 * (`3 - config` → `config`). The cleaned name is title-cased the
 * same way Fumadocs' fallback does.
 */
function cleanFolderName(name: string): string {
  return pathToName(name.replace(NUMBER_PREFIX_PATTERN, ""));
}

/**
 * Page-tree transformers (passed as `pageTree.transformers` to the
 * loader). One transformer object with `file` + `folder` hooks:
 *
 * - `file`: `sidebar_label` overrides the node's display name,
 *   `desc` becomes the node's description, and `color` is copied
 *   onto the node for sidebar and topic-list icon styling.
 * - `folder`: a folder whose name is the builder's path fallback
 *   (no meta title, no index page) gets its number prefix stripped
 *   (`3 - config` → `Config`). Names from meta.json or an index page
 *   are author-chosen and left alone. The icon fallback (meta icon,
 *   else the index page's icon) is already built into the builder.
 *   A README page is also promoted to the folder index: Fumadocs
 *   only treats a file named `index` as an index, but Portosaur
 *   content uses README.mdx, and the slugs function already
 *   collapses its URL to the folder URL — so the index page is the
 *   child page whose URL every sibling page URL starts with. The
 *   promoted page leaves the children list, and its title becomes
 *   the folder name when the name is still the path fallback.
 *   Children are re-sorted into pure filename order (Fumadocs
 *   groups pages before folders). A meta.json `pages` list keeps
 *   its author-chosen order.
 *
 * The storage generic is `any` deliberately: the loader's storage
 * type is generated per collection by the fumadocs-mdx macro (its
 * meta files carry `locale: undefined` without i18n), so a
 * transformer typed against the base `ContentStorage` is not
 * assignable to any concrete loader — and a mistyped `transformers`
 * option breaks the whole loader call's type inference (the page
 * data falls back to the base `PageData`, losing the schema fields).
 */
export const portoTreeTransformers: PageTreeTransformer<any>[] = [
  {
    file(node, filePath) {
      if (!filePath) {
        return node;
      }
      const file = this.storage.read(filePath);
      if (file?.format !== "page") {
        return node;
      }
      const data = file.data as PortoDocData;
      if (typeof data.sidebar_label === "string" && data.sidebar_label !== "") {
        node.name = data.sidebar_label;
      }
      if (typeof data.desc === "string" && data.desc !== "") {
        node.description = data.desc;
      }
      if (typeof data.color === "string" && data.color !== "") {
        Object.assign(node, { color: data.color });
      }
      return node;
    },
    folder(node, folderPath, metaPath) {
      // Promote the README page to the folder index. Fumadocs only
      // treats a file named `index` as a folder index, but Portosaur
      // content uses README.mdx. The slugs function already
      // collapses its URL to the folder URL, so it is the child
      // page whose URL every sibling page URL starts with. The
      // root folder has no index page of its own and is skipped.
      if (!node.index && !node.root) {
        const pages = node.children.filter(
          (child): child is PageTree.Item => child.type === "page",
        );
        const index = pages.find((page) =>
          pages.every(
            (other) => other === page || other.url.startsWith(`${page.url}/`),
          ),
        );
        if (index) {
          node.index = index;
          node.children = node.children.filter((child) => child !== index);
        }
      }

      // Re-sort the children into pure filename order. Fumadocs'
      // builder groups pages before folders (`buildRest` sorts by
      // node type first), but Portosaur orders by filename — `1 -
      // getting-started` before `2 - cli-reference` whether or not
      // it is a folder. Each child carries its original content
      // path on `$ref` (a string for pages, `{ folder }` for
      // folders), so the sort is numeric-aware over the real
      // filenames. Separators carry no path and keep their relative
      // order at the end. A meta.json with an explicit `pages` list
      // is author-chosen order and is left alone.
      const meta = metaPath ? this.storage.read(metaPath) : undefined;
      const hasExplicitPages =
        meta?.format === "meta" &&
        Array.isArray((meta.data as { pages?: unknown }).pages);
      if (!hasExplicitPages) {
        const childPath = (child: PageTree.Node): string | undefined => {
          if (child.type === "page") {
            return child.$ref;
          }
          if (child.type === "folder") {
            return child.$ref?.folder;
          }
          return undefined;
        };
        node.children.sort((a, b) => {
          const aPath = childPath(a);
          const bPath = childPath(b);
          if (aPath === undefined && bPath === undefined) {
            return 0;
          }
          if (aPath === undefined) {
            return 1;
          }
          if (bPath === undefined) {
            return -1;
          }
          return aPath.localeCompare(bPath, undefined, { numeric: true });
        });
      }

      // Only rewrite the path fallback: when the name is exactly
      // what the builder derived from the folder's basename, the
      // author gave it no title of their own.
      const base = folderPath.split("/").filter(Boolean).pop() ?? "";
      if (node.name === pathToName(base)) {
        // The index page's title wins over the folder name (it is
        // author-chosen). Otherwise strip the number prefix.
        node.name = node.index ? node.index.name : cleanFolderName(base);
      }
      return node;
    },
  },
];

/**
 * Re-exports for the generated root: the numeric-aware page-tree sort
 * (`1 -`, `2 -`, `10 -` order correctly) used as
 * `pageTree.sort` in the loader call.
 */
export const portoTreeSort = {
  by: "path" as const,
  options: { numeric: true } satisfies Intl.CollatorOptions,
};

/**
 * Whether a content-relative file path is an index file
 * (`index.mdx` / `README.mdx`, any case). Used by the generated
 * routes to tell index pages from ordinary pages.
 */
export function isIndexFile(contentPath: string): boolean {
  const base = path.posix.basename(contentPath).replace(/\.[^.]+$/, "");
  const lower = base.toLowerCase();
  return lower === "index" || lower === "readme";
}

/** Re-exported for callers that need the segment cleaner. */
export { cleanSegment };
