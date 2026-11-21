# Portosaur for Zed

Language support for [Portosaur](https://github.com/soymadip/portosaur) sites: suggestions, hover help, and error checking in the frontmatter and components of MDX pages. `porto.yml` is handled by Zed's built-in YAML support, which reads the `$schema` line at the top of the file.

## Requirements

Install the [MDX](https://zed.dev/extensions/mdx) extension as well. It provides the MDX language itself (syntax highlighting and the file type); this extension only adds the Portosaur language server.

## How it works

On first use, the extension downloads the `porto-lsp` server binary matching your platform from the [Portosaur releases](https://github.com/soymadip/portosaur/releases) and caches it under a versioned directory, so updating the extension picks up the matching server. The server runs only for files inside a Portosaur project (a directory with a `porto.yml` file, or a `package.json` depending on the Portosaur packages).

## Using a local build

To point the server at a build of your own instead of the downloaded one, set the binary path in your Zed settings:

```json
{
  "lsp": {
    "porto-lsp": {
      "binary": {
        "path": "/path/to/porto-lsp"
      }
    }
  }
}
```

## Development

The extension is a Rust crate compiled to WebAssembly. Build it with:

```sh
cargo build --target wasm32-wasip1 --release
```

Install it as a dev extension in Zed to try it out: **Zed > Extensions > Install Dev Extension**, then pick this directory.
