# Portosaur editor extensions

Both extensions talk to the same language server, `porto-lsp`, so
nearly every feature works the same in both editors. The
differences are on the editor side: what the editor can show and
how `porto.yml` is handled.

| Feature                                            | VS Code | Zed | Notes                                                                                   |
| :------------------------------------------------- | :-----: | :-: | :-------------------------------------------------------------------------------------- |
| MDX frontmatter completion, hover, and diagnostics |   Yes   | Yes |                                                                                         |
| Component completion and hover                     |   Yes   | Yes |                                                                                         |
| Prop values pop up after accepting a prop name     |   Yes   |  —  | Zed shows the values when you type the quote instead                                    |
| Imported-component and HTML tag completion         |   Yes   | Yes | After `<`, alongside the built-in components. Picking a tag inserts the whole tag       |
| Unknown-component and icon warnings                |   Yes   | Yes |                                                                                         |
| Missing-required-prop warnings                     |   Yes   | Yes |                                                                                         |
| Go-to-definition for links                         |   Yes   | Yes |                                                                                         |
| Clickable links                                    |   Yes   | Yes | Ctrl/Cmd+click opens pages, files, and external URLs                                    |
| Rename updates links                               |   Yes   | Yes | Clean-URL links rewritten, relative markdown links are the MDX server's job             |
| Broken-link warnings                               |   Yes   | Yes | Severity follows `site.content.on_broken_links`                                         |
| Broken-image warnings                              |   Yes   | Yes | Severity follows `site.content.on_broken_images`                                        |
| Multi-segment `slug:` errors                       |   Yes   | Yes | A slug only renames the file itself                                                     |
| Duplicate-slug warnings                            |   Yes   | Yes | Always a warning: the build throws on duplicate slugs                                   |
| `{vars.}` completion                               |   Yes   | Yes |                                                                                         |
| Unknown `{vars.}` warnings                         |   Yes   | Yes | Severity follows `site.content.on_missing_var`                                          |
| `{vars.}` values inline and on hover               |   Yes   | Yes |                                                                                         |
| Missing `{env.}` warnings                          |   Yes   | Yes | Severity follows `site.content.on_missing_env`                                          |
| `{env.}` values inline and on hover                |   Yes   | Yes |                                                                                         |
| `{env.}` completion                                |   Yes   | Yes | From the system environment and `.env` files                                            |
| Shortcode suggestions                              |   Yes   | Yes | Icon packs and emoji after `:`. Emoji need `site.content.render_emoji_shortcodes`       |
| Code fence suggestions                             |   Yes   | Yes | Languages after the fence, meta params after the language                               |
| Icon prefix suggestions                            |   Yes   | Yes | Pack prefixes in icon values, before the colon                                          |
| List auto-insert on Enter                          |   Yes   | Yes | Enter continues numbered, bullet, and task lists                                        |
| Frontmatter auto-indent on Enter                   |   Yes   | Yes | Enter after a `key:` line indents two spaces                                            |
| Object keys drop onto an indented next line        |   Yes   | Yes | Cursor drops in both editors, the child list pops up on its own in VS Code only         |
| Path completion for links                          |   Yes   | Yes |                                                                                         |
| Code actions (quick fixes)                         |   Yes   | Yes |                                                                                         |
| Page outline                                       |   Yes   | Yes | Headings nested by level, plus the frontmatter keys                                     |
| MDX preview                                        |   Yes   |  —  | Zed extensions cannot show panels                                                       |
| Server status in the status bar                    |   Yes   |  —  | Click to open the server menu. Zed extensions cannot add status bar items               |
| `porto.yml` handling                               |   Yes   | Yes | Through the `$schema` line: the YAML extension in VS Code, built-in YAML support in Zed |

The extensions themselves live in `vscode/` and `zed/`. The server
lives in `packages/lsp/`.
