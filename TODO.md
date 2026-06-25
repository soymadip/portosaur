## Bugs

- [ ] When scrolling in homepage, the url #section-id is not changed automatically.

## Features

- [ ] Add Url Shortener, checkout https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-client-redirects
- [ ] Thoroughly check vars docs and separate config vars with runtime vars. Add a component and syntax to replace `{meta.var_name}` with actual `var_value` (a remark plugin maybe?). Also, make the `config.yml`'s `vars` referable in notes and blog?
- [ ] Allow adding tooltip when hovering.
- [ ] Write custom component docs and add mdx syntax through plugins.
- [ ] **Way to extend MDXComponents by user.** Maybe also allow to pass custom components? Maybe through `config.yml`? Or `MDXComponents.js` manually?
- [ ] Allow to password protect certain notes? (Maybe a hash to match against)
- [ ] Allow user to add custom css file through config.yml that will be loaded like custom.css

## Improvements

- [ ] When there is no space, automatically hide button label and show only icon
- [ ] Use pure css for project corosaul
- [ ] Port more manual styling to --ifm variables. like border, shadow, radius etc.
- [ ] Customize the Heading Tags size, style. make them distinguishable. take a look at docs style.
- [ ] Decrease the padding of tooltip popup, also possibly increase the size of the popup. Also, when we hover over the popup keep it open even if we moved past the text.
- [ ] Instead of react-icons, use something similar to mkdocs (like FontAwesome). Actually, maybe just directly fetch from react-icons if not found in `iconMappings`?
- [ ] Modify `renderIconElement` to first search in mappings, and if not found, fallback directly to react-icons.
- [ ] Bring the theme button in navbar before nav items.
- [ ] Export Components from package?
- [ ] Scrollbars looks wierd in chromium, should customize?
- [ ] Allow hint/Preview to show certain lines of current/another note.

## Refactor

- [ ] Shift base to fumadocs? (or astro?)

## Completed

- [x] The note cards are taking ID as the link but Docusaurus doesn't do. Like for python note has ID 'python-index' so giving `/notes/python-index` but Docusaurus gives `/python`.
- [x] Give user ability to customize build directory.
- [x] **Important**: "View Resume" button is visible even if not given in config.
- [x] TOC not scrolling as content is scrolled in notes.
- [x] `srcPv` should be a button like the "Edit this page" button on the same line.
- [x] In `Pv` component, if array contains one string, then don't render tab.
- [x] `<details>` tag not showing summary text, instead just showing details. And the summary is rendered inside details text, revealed when opened details section.
- [x] Customize the callouts, details CSS to make them less ugly. (or maybe swizzle?)
