## Bugs

- [ ] When scrolling in homepage, the url #section-id is not changed automatically.
- [ ] `<details>` tag not showing summary text, instead just showing details. And the summary is rendered inside details text, revealed when opened details section.

## Features

- [ ] Thoroughly check vars docs and separate config vars with runtime vars. Add a component and syntax to replace `{meta.var_name}` with actual `var_value` (a remark plugin maybe?). Also, make the `config.yml`'s `vars` referable in notes and blog?
- [ ] Allow adding tooltip when hovering.
- [ ] Write custom component docs and add mdx syntax through plugins.
- [ ] **Way to extend MDXComponents by user.** Maybe also allow to pass custom components? Maybe through `config.yml`? Or `MDXComponents.js` manually?
- [ ] Allow to password protect certain notes? (Maybe a hash to match against)

## Improvements

- [ ] Customize the callouts, details CSS to make them less ugly.
- [ ] Decrease the padding of tooltip popup, also possibly increase the size of the popup. Also, when we hover over the popup keep it open even if we moved past the text.
- [ ] Instead of react-icons, use something similar to mkdocs (like FontAwesome). Actually, maybe just directly fetch from react-icons if not found in `iconMappings`?
- [ ] Modify `renderIconElement` to first search in mappings, and if not found, fallback directly to react-icons.
- [ ] Bring the theme button in navbar before nav items.
- [ ] Export Components from package?

## Refactor

- [ ] Shift base to fumadocs?

## Completed

- [x] The note cards are taking ID as the link but Docusaurus doesn't do. Like for python note has ID 'python-index' so giving `/notes/python-index` but Docusaurus gives `/python`.
- [x] Give user ability to customize build directory.
- [x] **Important**: "View Resume" button is visible even if not given in config.
- [x] TOC not scrolling as content is scrolled in notes.
- [x] `srcPv` should be a button like the "Edit this page" button on the same line.
- [x] In `Pv` component, if array contains one string, then don't render tab.

<!-- Will be used later somewhere -->

<!--

### ⏩︎ Features

- **Preview**: Show mobile toc bar when dock is open.

### ⏩︎ Bug Fixes

- **Preview**: Fix sidebar opening-closing on dock size change.
- **Preview**: Fix docs area not updating while resizing the dock.
- **Preview**: Fix pagination buttons always stacked when dock is opened.
- **Preview**: Fix footer & pagination buttons not adapting to view area change when switched to dock mode.
- **Preview**: Fix cursor becomin hand when left clicking on text preview.
- **Preview**: Fix reloading preview on mode change.

### ⏩︎ Refactor

- **Preview**: Change id pattern, add parameter support for mode & tab.
- **Preview**: Introduce new id generation for multi file preview.
- **Preview**: Remove the sources option and merge it directly to href option.

-->
