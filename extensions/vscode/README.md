# Portosaur

Language support for [Portosaur](https://github.com/soymadip/portosaur) sites: completions, hover and diagnostics for `porto.yml` and for MDX frontmatter and components, powered by the `porto-lsp` language server.

## What you get

- **Completions** for config keys and values in `porto.yml`, frontmatter keys in `.mdx` files, and component names, props and values (`<Btn variant="primary">`).
- **Hover** showing what each key, component and prop does.
- **Diagnostics** flagging unknown keys and wrong types while you type.

The server only starts in a workspace that holds a Portosaur project (a `porto.yml`, or a `package.json` depending on `@portosaur/cli` or `@portosaur/core`), and it only serves `porto.yml` and `.mdx` files. In any other project the extension stays quiet.

## The MDX extension

The [MDX extension](https://marketplace.visualstudio.com/items?itemName=unifiedjs.vscode-mdx) (`unifiedjs.vscode-mdx`) installs alongside this one and provides syntax highlighting for `.mdx` files. Without it, `.mdx` files open as plain text.

## How the server is installed

On first use the extension downloads the `porto-lsp` binary for your platform from the [Portosaur releases](https://github.com/soymadip/portosaur/releases), verifies its SHA-256 checksum, and caches it. Nothing else to install.

## Settings

- `portosaur.server.path` — use a local `porto-lsp` build instead of the downloaded one. Handy when developing the server itself.
- `portosaur.trace.server` — log the messages between VS Code and the server (`off`, `messages`, `verbose`). Off by default.

## Troubleshooting

- **No completions in a `.mdx` file:** check the MDX extension is installed and the file's language mode (bottom right) says MDX.
- **No completions in `porto.yml`:** the file must be named exactly `porto.yml` (or `porto.yaml`), inside a Portosaur project.
- **The server failed to download:** check your network, then reload the window. If the download keeps failing, build the server from the repo (`go build` in `packages/lsp`) and point `portosaur.server.path` at it.
- **Still stuck:** set `portosaur.trace.server` to `verbose`, reload, and read the Portosaur Language Server output channel.
