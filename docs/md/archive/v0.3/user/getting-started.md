# Getting Started

{{meta.project.title}} is a solution for building personal portfolios and digital notebooks with minimal configuration.

## Prerequisites

> [!TIP] Requirements:
>
> - [`Bun`]({{meta.tools.bun}}) (Recommended & primarily supported) or Node.js v{{meta.versions.node_min}}+.
> - [`Git`]({{meta.tools.git}}) installed and available in your PATH.

## Installation

You can install {{meta.project.title}} globally with:

```bash
bun i -g portosaur@latest

```

After this, add the bin directory to PATH and restart shell.

## Initialization

You can initialize a new project using the `init` command.

### Interactive (Recommended)

This is the standard way to set up your site. It will guide you through configuring your providers and scaffold the project structure.

```bash
# If installed globally
{{meta.pkg.bin}} init

# Or without installation
bunx portosaur init
```

### Non-Interactive

Useful for automation and scripting.  
**Providing any configuration flag will enter to non-interactive mode**, defaults will be used for missing flags.

```bash
# Example: with specific providers
{{meta.pkg.bin}} init -p github -h github-pages -u soymadip -n "Shyam Roy"

# Or withought installation
bunx portosaur@latest init -p github -h github-pages -u soymadip -n "Shyam Roy"
```

| Flag                   | Description                                                    | Default                 |
| :--------------------- | :------------------------------------------------------------- | :---------------------- |
| `-p`, `--vcs-provider` | Git Provider ID (`none`, `{{meta.defaults.vcsList}}`)          | `{{meta.defaults.vcs}}` |
| `-h`, `--hosting`      | Hosting Platform ID (`none`, `{{meta.defaults.hostingList}}`)  | `Selected VCS Default`  |
| `-u`, `--username`     | Username for the Git provider                                  | `Git/OS User`           |
| `-n`, `--name`         | Full Name for the site title                                   | `Full Name`             |
| `-k`, `--no-install`   | Skip automatic dependency installation                         | `false`                 |
| `-P`, `--project-name` | Desired Project Name. Note that custom name is not recommended | vcs provider ideal name |

> [!WARNING] It's not recommended to use custom name
>
> Many(most) git hosting platforms require a specific repository name (e.g., `username.github.io`) to deploy to your root domain. A custom project name deploys to a subdirectory URL (e.g., `username.github.io/custom-name`).

## Project Structure

The `init` command generates a project directory with the following structure:

```txt
my-site/
├── [workflow file/dir]        # CI workflow for automated deployment
├── blog/                      # Blog articles and deep dives
├── notes/                     # Markdown/MDX digital notebook
├── static/                    # Assets like images, icons, and PDFs
├── config.yml                 # Primary configuration file
├── package.json               # Project dependencies and scripts
└── README.md                  # Project overview
```

### Key Directories

- **`notes/`**: Your digital second brain. Organize your notes using standard Markdown.
- **`blog/`**: Long-form articles and updates.
- **`static/`**: Global assets available at the site root.
- **`config.yml`**: Central source of truth for site settings and content.

## Spin up the Site

Start the **local** development server with [HMR](search:hot module reload) to see changes in real-time:

```bash
cd <your-project-dir>
{{meta.pkg.bin}} dev
```

The site will be available at `http://localhost:3000`.

## Production Build

To generate a static version of your site ready for deployment:

```bash
{{meta.pkg.bin}} build
```
