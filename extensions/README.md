# Portosaur editor extensions

Both extensions talk to the same language server, `porto-lsp`, so
nearly every feature works the same in both editors. The
differences are on the editor side: what the editor can show and
how `porto.yml` is handled.

| Feature                                            | VS Code | Zed | Notes                                                                                   |
| :------------------------------------------------- | :-----: | :-: | :-------------------------------------------------------------------------------------- |
| MDX frontmatter completion, hover, and diagnostics |   Yes   | Yes |                                                                                         |
| Component completion and hover                     |   Yes   | Yes |                                                                                         |
| Unknown-component and icon warnings                |   Yes   | Yes |                                                                                         |
| Missing-required-prop warnings                     |   Yes   | Yes |                                                                                         |
| Go-to-definition for links                         |   Yes   | Yes |                                                                                         |
| `{vars.}` completion                               |   Yes   | Yes |                                                                                         |
| Unknown `{vars.}` warnings                         |   Yes   | Yes | Severity follows `site.content.on_missing_var`                                          |
| Missing `{env.}` warnings                          |   Yes   | Yes | Severity follows `site.content.on_missing_env`                                          |
| Path completion for links                          |   Yes   | Yes |                                                                                         |
| Code actions (quick fixes)                         |   Yes   | Yes |                                                                                         |
| Page outline                                       |   Yes   | Yes | Headings nested by level, plus the frontmatter keys                                     |
| MDX preview                                        |   Yes   |  —  | Zed extensions cannot show panels                                                       |
| `porto.yml` handling                               |   Yes   | Yes | Through the `$schema` line: the YAML extension in VS Code, built-in YAML support in Zed |

The extensions themselves live in `vscode/` and `zed/`. The server
lives in `packages/lsp/`.
