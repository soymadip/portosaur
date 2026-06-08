# Deploying your Portfolio

Once you've customized your site, it's time to share it with the world. {{meta.project.title}} generates a highly optimized static website that can be hosted for free on almost any static hosting provider.

## The Core Concept

Deploying a {{meta.project.title}} site follows a simple two-step process:

1.  **Build**: Generate the static HTML, CSS, and JS files.
2.  **Host**: Upload the contents of the `build` directory to your provider of choice.

## Prerequisites

Before deploying, ensure you have:

- Installed `@{{meta.project.title}}/cli` globally or available via `bunx`/`npx`.
- A working configuration (`config.yml`).
- A repository on your preferred Git provider (GitHub, GitLab, etc.).

## Automated Setup

{{meta.project.title}} simplifies CI/CD setup by providing specialized templates for popular hosting platforms. During `{{meta.project.title}} init`, you can select a hosting provider to have these workflows generated for you automatically.

### Commands

To generate or update CI/CD workflows in an existing project:

```bash
# Using the CLI
{{meta.project.title}} init-ci
```

This command will:

1.  **Detect** your Git provider (GitHub, GitLab, Codeberg, etc.) from your git remote.
2.  **Generate** the appropriate CI/CD workflow file for its default hosting platform.

You can also specify a platform using the `-h` flag:

```bash
{{meta.project.title}} init-ci -h gitlab-pages
```

## Choosing a Platform

Follow our detailed guides for platform-specific setup:

- [**GitHub Pages**](./github-pages)
- [**GitLab Pages**](./gitlab-pages)
- [**Codeberg Pages**](./codeberg-pages)
- [**Surge.sh**](./surge)
- [**Other Platforms**](./others) (Netlify, Vercel, Cloudflare)

## Manual Deployment

To generate a production build manually:

```bash
{{meta.project.title}} build
```

This will create a `build` folder in your project root. You can then upload this folder manually to any host (like Surge, Vercel, or a simple S3 bucket).
