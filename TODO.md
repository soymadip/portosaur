## Features

- [ ] Set up a GitHub Action using `capacitor` to automatically build an Android APK from the PWA and publish it to GitHub Releases.
- [ ] Add URL Shortener (Phase 4 decision — the old Docusaurus redirect plugin does not apply to the Fumadocs stack).
- [ ] Write custom component docs and add mdx syntax through plugins.
- [ ] **Way to extend MDXComponents by user.** Maybe also allow to pass custom components? Maybe through `config.yml`? Or `MDXComponents.js` manually?
- [ ] Allow to password protect certain notes? (Maybe a hash to match against)
- [ ] Allow user to add custom css file through config.yml that will be loaded like custom.css

## Improvements

- [ ] Implement custom scrollbars, looks ugly in chromium browsers
- [ ] When there is no space, automatically hide Btn's label and show only icon
- [ ] Port more manual styling to `--porto-*` variables. like border, shadow, radius etc.
- [ ] Customize the Heading Tags size, style. make them distinguishable. take a look at docs style.
- [ ] Export Components from package?
- [ ] Allow hint/Preview to show certain lines of current/another note.

## Refactor

- [ ] (none — the Fumadocs rebuild is in progress on `fresh/fumadocs`)

## Completed

- [x] Shift base to fumadocs (decided 2026-11-15; rebuild in progress on `fresh/fumadocs`, target 1.0.0).
- [x] Bring the theme button in navbar before nav items.
- [x] The note cards are taking ID as the link but Docusaurus doesn't do. Like for python note has ID 'python-index' so giving `/notes/python-index` but Docusaurus gives `/python`.
- [x] Give user ability to customize build directory.
- [x] **Important**: "View Resume" button is visible even if not given in config.
- [x] TOC not scrolling as content is scrolled in notes.
- [x] `srcPv` should be a button like the "Edit this page" button on the same line.
- [x] In `Pv` component, if array contains one string, then don't render tab.
- [x] `<details>` tag not showing summary text, instead just showing details. And the summary is rendered inside details text, revealed when opened details section.
- [x] Customize the callouts, details CSS to make them less ugly. (or maybe swizzle?)
- [x] Use pure css for project corosaul
- [x] Decrease the padding of tooltip popup, also possibly increase the size of the popup. Also, when we hover over the popup keep it open even if we moved past the text.
- [x] Add a component and syntax to replace `{meta.var_name}` with actual `var_value` (a remark plugin maybe?). Also, make the `config.yml`'s `vars` referable in notes and blog?
- [x] Allow adding tooltip when hovering.
- [x] When scrolling in homepage, the url #section-id is not changed automatically.
