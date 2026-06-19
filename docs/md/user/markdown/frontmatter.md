---
title: Frontmatter
sidebar_position: 1
---

# Document Frontmatter

Frontmatter is the YAML block at the very top of your Markdown (`.md` or `.mdx`) files. It allows you pass metadata about the page to portosaur.

Portosaur supports standard Docusaurus frontmatter as well as some specialized custom fields. Below ones are tested by us.

## Notes Frontmatter

Frontmatter fields for Notes pages

```md
---
title: JavaScript Tips
slug: custom-url-path
language: javascript
desc: Advanced tricks and tips for JS.
icon: 🚀
color: "#F7DF1E"
sidebar_label: JS Tips
sidebar_position: 1
pagination_label: JavaScript
---

# Note Content
```

| Field                  | Default                    | Description                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`title`**            | _Markdown Title_           | The title of your document. If omitted, the filename (or folder name) is used.                                                                                                                                                                                                                         |
| **`slug`**             | _File Path_                | Overrides the document URL.<br/> Support multiple patterns: `my-doc` -> `/notes/dir/my-doc`, `/my/path/myDoc` -> `/notes/my/path/myDoc`, `/` -> `/notes/`                                                                                                                                              |
| **`description`**      | _None_                     | A brief description. Used for places like Note cards, Topic lists.                                                                                                                                                                                                                                     |
| **`sidebar_label`**    | `title`                    | The text shown in the document sidebar for this document.                                                                                                                                                                                                                                              |
| **`pagination_label`** | `title` or `sidebar_label` | The text used in the document next/previous buttons for this document.                                                                                                                                                                                                                                 |
| **`sidebar_position`** | _Default Ordering_         | Controls the position of a doc inside the sidebar and in card grids.<br/> Lower numbers appear first.                                                                                                                                                                                                  |
| **`icon`**             | _Default Icon_             | The icon shown on the note card. You can provide:<br/>1. An name from the built-in icon map (e.g., `linux`).<br/>2. An absolute path to image in `static/` directory (e.g., `/img/my-icon.png`).<br/>3. A raw SVG string (e.g., `<svg viewBox="0 0 100 100">...</svg>`).<br/>4. An emoji (e.g., `🚀`). |
| **`color`**            | _Auto/Primary_             | A custom CSS color string (e.g., `#FF0000`, `rgb(0, 0, 0)`) that overrides the card's theme color.                                                                                                                                                                                                     |

## Blog Frontmatter

When creating posts inside your `blog/` directory, Docusaurus provides several fields for managing blog metadata.

```yaml
---
title: My First Post
date: 2024-01-01T10:00
authors: [john]
tags: [hello, docusaurus]
draft: false
image: /img/blog-cover.jpg
---
```

| Field             | Default                       | Description                                                                                                                        |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **`title`**       | _Filename_                    | The title of your document. If omitted, the filename is used.                                                                      |
| **`description`** | _None_                        | A brief description.                                                                                                               |
| **`slug`**        | _File Path_                   | Overrides the URL path for the document.                                                                                           |
| **`date`**        | _File Prefix / Creation Time_ | The publication date of the post. If omitted, Docusaurus attempts to extract it from the filename (e.g., `2024-01-01-my-post.md`). |
| **`authors`**     | _None_                        | An array of author keys (or inline objects) mapped to your `authors.yml` file.                                                     |
| **`tags`**        | _None_                        | An array of strings used to tag and categorize the blog post.                                                                      |
| **`draft`**       | `false`                       | A boolean (`true` or `false`) indicating if the post is a draft. Drafts are only visible during local development.                 |
| **`image`**       | _None_                        | An absolute path or URL to the cover image used for social media sharing (Open Graph/Twitter cards).                               |

## Dynamic Variables in Markdown

Because Portosaur uses MDX, your Markdown files are compiled into React components. This means you can define your own custom fields in the frontmatter and then inject them dynamically anywhere in your document using the global `frontMatter` object!
h

```mdx
---
title: My Project
author_name: John Doe
app_version: v1.2.4
---

# Welcome to {frontMatter.title}

This document was written by **{frontMatter.author_name}**.

Please ensure you download version `{frontMatter.app_version}` or higher before continuing.
```

This is incredibly useful for keeping repetitive values (like version numbers, links, or names) perfectly synced across a long document. You update the value once in the frontmatter, and it instantly updates everywhere in the text!
