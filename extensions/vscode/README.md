# Portosaur

Language support for [Portosaur](https://github.com/soymadip/portosaur) sites: completions, hover, diagnostics, jump-to-definition, quick fixes and a page outline for MDX files, powered by the `porto-lsp` language server. `porto.yml` is handled by the YAML extension, which reads the `$schema` line at the top of the file.

See the [feature comparison](../README.md) for how the VS Code and Zed extensions compare.

## What you get

- **Completions** for frontmatter keys, component names, props and values (`<Btn variant="primary">`), `{vars.}` values from `porto.yml`, and page paths inside links.
- **Hover** showing what each key, component and prop does.
- **Diagnostics** flagging unknown frontmatter keys, unknown components, bad icon names and missing required props while you type.
- **Go to definition** on a link jumps to the page it points to.
- **Quick fixes** for a wrong value or a missing required prop, and a page outline in the sidebar.
- **Preview** (`Portosaur: Preview Page`) opens the current page in a side panel. The extension starts the dev server for you.

The server only starts in a workspace that holds a Portosaur project (a `porto.yml`, or a `package.json` depending on `@portosaur/cli` or `@portosaur/core`), and it only serves `.mdx` files. In any other project the extension stays quiet.

## The MDX and YAML extensions

The [MDX extension](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx) (`unifiedjs.vscode-mdx`) installs alongside this one and provides syntax highlighting for `.mdx` files. Without it, `.mdx` files open as plain text. The [YAML extension](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) (`redhat.vscode-yaml`) installs alongside it too and handles `porto.yml`.

## How the server is installed

On first use the extension downloads the `porto-lsp` binary for your platform from the [Portosaur releases](https://github.com/soymadip/portosaur/releases), verifies its SHA-256 checksum, and caches it. Nothing else to install.

## Settings

- `portosaur.server.path` — use a local `porto-lsp` build instead of the downloaded one. Handy when developing the server itself.
- `portosaur.preview.port` — the port the preview's dev server runs on (3000 by default).
- `portosaur.trace.server` — log the messages between VS Code and the server (`off`, `messages`, `verbose`). Off by default.

## Troubleshooting

- **No completions in a `.mdx` file:** check the MDX extension is installed and the file's language mode (bottom right) says MDX.
- **No completions in `porto.yml`:** they come from the YAML extension, not this one. Check the YAML extension is installed and the file is named exactly `porto.yml` (or `porto.yaml`).
- **The server failed to download:** check your network, then reload the window. If the download keeps failing, build the server from the repo (`go build` in `packages/lsp`) and point `portosaur.server.path` at it.
- **Still stuck:** set `portosaur.trace.server` to `verbose`, reload, and read the Portosaur Language Server output channel.
