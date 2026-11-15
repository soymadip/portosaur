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
import type { SlugFn } from "fumadocs-core/source/plugins/slugs";
import { pageSchema } from "fumadocs-core/source/schema";
import {
  cleanSegment,
  guessDocPermalink,
  NUMBER_PREFIX_PATTERN,
  type Frontmatter,
} from "./slug.ts";
import { parseFileFrontmatter } from "./slug-server.ts";

/**
 * Portosaur's frontmatter schema for doc/note/blog pages.
 *
 * Fumadocs' `pageSchema` requires `title` and carries `description`;
 * Portosaur keeps `title` optional (the content H1 is the fallback —
 * decision 11) and renames the description key to `desc` (decision
 * 25, matching Portosaur's `desc` convention). The remaining fields
 * are the Astro `docSchema` shapes, minus `sidebar_position` (removed
 * — decision 24) and plus `math` (frontmatter flag for the KaTeX
 * stylesheet gate). Unknown keys are stripped by zod.
 *
 * The `file` transformer maps `desc` onto the page-tree node's
 * `description`; page metadata reads `page.data.desc` directly.
 */
export const portoDocSchema = pageSchema
  .omit({ title: true, description: true })
  .extend({
    title: z.string().optional(),
    desc: z.string().optional(),
    hide_title: z.boolean().optional(),
    color: z.string().optional(),
    sidebar_label: z.string().optional(),
    slug: z.string().optional(),
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
  });

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
 * `parseFileFrontmatter`); when no absolute path is available the
 * parent lookup is empty and directories fall back to their cleaned
 * names. A root index file returns `[]` (the base URL itself).
 */
export const portoSlugs: SlugFn = (file, _next) => {
  const portoFile = file as PortoPageFile;
  const parentSlugs: Record<string, string> = {};
  const absolutePath = portoFile.absolutePath;
  if (absolutePath) {
    // Ancestor directories of the file, content-relative, from the
    // content root down to the file's parent directory.
    const relativeDir = path.posix.dirname(portoFile.path);
    const dirSegments =
      relativeDir === "." ? [] : relativeDir.split("/").filter(Boolean);
    const fileDir = path.dirname(absolutePath);
    for (let i = 1; i <= dirSegments.length; i++) {
      const dirKey = dirSegments.slice(0, i).join("/");
      // The directory on disk: walk up from the file's directory.
      const up = dirSegments.length - i;
      const dirPath =
        up === 0 ? fileDir : path.resolve(fileDir, ...Array(up).fill(".."));
      for (const name of ["index.mdx", "index.md", "README.mdx", "README.md"]) {
        const fm = parseFileFrontmatter(path.join(dirPath, name));
        if (fm && typeof fm.slug === "string" && fm.slug !== "") {
          parentSlugs[dirKey] = fm.slug;
          break;
        }
      }
    }
  }
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
 * - `file`: `sidebar_label` overrides the node's display name, and
 *   `desc` becomes the node's description (the builder copies only
 *   Fumadocs' `description` field, which Portosaur doesn't use).
 * - `folder`: a folder whose name is the builder's path fallback
 *   (no meta title, no index page) gets its number prefix stripped
 *   (`3 - config` → `Config`). Names from meta.json or an index page
 *   are author-chosen and left alone. The icon fallback (meta icon,
 *   else the index page's icon) is already built into the builder.
 */
export const portoTreeTransformers: PageTreeTransformer[] = [
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
      return node;
    },
    folder(node, folderPath) {
      // Only rewrite the path fallback: when the name is exactly
      // what the builder derived from the folder's basename, the
      // author gave it no title of their own.
      const base = folderPath.split("/").filter(Boolean).pop() ?? "";
      if (node.name === pathToName(base)) {
        node.name = cleanFolderName(base);
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
