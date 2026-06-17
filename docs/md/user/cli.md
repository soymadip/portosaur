# CLI Reference

The `porto` command-line interface provides all the tools you need to create, develop, build, and serve your portfolio site.

## Global Options

The following options are available globally across the `porto` command.

| Option          | Description                                       |
| :-------------- | :------------------------------------------------ |
| `-v, --version` | Outputs the current version of Portosaur.         |
| `--help`        | Outputs usage information for a specific command. |

---

## `porto init`

Initializes a new Portosaur project, scaffolds the directory structure, config file, and optionally setts up Git and auto-deployments.

```bash
porto init [options]
```

### Options

| Option                      | Description                                                                          |
| :-------------------------- | :----------------------------------------------------------------------------------- |
| `-p, --vcs-provider <id>`   | VCS/Git hosting Provider ID<br/>Options: `none`, `{{meta.defaults.vcsList}}`.        |
| `-h, --hosting <id>`        | Site Hosting Platform ID to use<br/>Options: `none`, `{{meta.defaults.hostingList}}` |
| `-u, --username <user>`     | Your VCS username (used for cloning and repository links).                           |
| `-n, --name <name>`         | Full name, used for the portfolio title.                                             |
| `-k, --no-install`          | Skips automatic dependency installation (`bun install`).                             |
| `-P, --project-name <name>` | Desired project name. (Not recommended)                                              |
| `--ci-only`                 | Sets up **only** the CI/CD deployment for existing project.                          |
| `--gitignore-only`          | Generates **only** the `.gitignore` for existing project.                            |

---

## `porto providers`

Lists all available Version Control System (VCS) providers and Hosting Platforms supported by Portosaur to init.

```bash
porto providers [options]
```

### Options

| Option              | Description                                              |
| :------------------ | :------------------------------------------------------- |
| `-t, --type <type>` | Filter the list by type. Valid values: `vcs`, `hosting`. |

---

## `porto dev` (or `porto start`)

Starts the local development server. This watches your files for changes, hot-reloads the browser, and renders drafts so you can preview your content.

```bash
porto dev [siteDir] [options]
```

### Options

| Option              | Description                                                                        |
| :------------------ | :--------------------------------------------------------------------------------- |
| `-p, --port <port>` | Specify a custom port to run the server on (default `3000`).                       |
| `-h, --host <host>` | Specify a custom host address. (use `0.0.0.0` for enabling external access)        |
| `--no-browser`      | Prevents the CLI from automatically opening your default web browser.              |
| `--poll [interval]` | Uses file polling for watching changes (useful inside Docker or WSL environments). |

---

## `porto build`

Compiles your Portosaur project into static HTML/CSS/JS assets ready for production deployment.

```bash
porto build [siteDir] [options]
```

### Options

| Option                | Description                                                                     |
| :-------------------- | :------------------------------------------------------------------------------ |
| `-o, --out-dir <dir>` | Specifies a custom output directory for the compiled assets (default: `build`). |
| `--bundle-analyzer`   | Opens a webpack bundle analyzer map after the build is finished.                |
| `--no-minify`         | Disables output minification. Useful for debugging production builds.           |

---

## `porto serve`

Serves the compiled static site locally. This is useful for previewing the exact production output before deploying.

> [!WARNING]
>
> You must run `porto build` before you can serve.

```bash
porto serve [siteDir] [options]
```

### Options

| Option                | Description                                                           |
| :-------------------- | :-------------------------------------------------------------------- |
| `-o, --out-dir <dir>` | Serve files from a custom directory instead of the `build` folder.    |
| `-p, --port <port>`   | Specify a custom port to serve on (default: `3000`).                  |
| `-h, --host <host>`   | Specify a custom host address. (use `0.0.0.0` for external access)    |
| `--no-browser`        | Prevents the CLI from automatically opening your default web browser. |
