- [x] The note cards are taking id as the link but docusaurs doesn't do. like for python note has id 'python-index' so giving /notes/python-index. but docusaurus gives /python
- [x] Give user ability to customize build dir
- [x] Important: View Resume button is visible even if not given in config

- [ ] Thoroughly check vars docs and separate config vars with runtime vars. Add a component and syntax to replace {meta.var_name} with actual var_value (a remark plugin maybe?). Also, make the config.yml's `vars` to be referable in notes and blog?

- [ ] Customize the callouts, details css. make them less ugly

- [ ] Decrease the padding of tooltip popup, also possibly increase the size of the popup. Also when we hover over the popup keep it open even we moved past the text

- [ ] when scrolling in homepage, the url #section-id is not changed automatically.

- [ ] Allow add tooltip when hovering

- [ ] <details> tag not showing summary text, instead just showing details. and the summary is rendered inside details text, revealed when opened detailes section

- [ ] Write custom component docs and add mdx syntax through plugins

- [ ] srcPv should be an button like the edit this page button on the same line

- [ ] Instead of react icons, use something similar to mkdocs. like font-awsome... actually, maybe just directly fetch from react-icons if not found in iconmappings?

- [ ] There is renderIconElement, maybe modify it to first see in mappings if not found directly in react-icons?

- [ ] Bring the theme buttton in navbar before nav items

- [ ] **Way to extend MDXComponents by user.** Maybe also allow to pass custom components? maybe through config.yml? or MDXCompoenonts.js manually?

- [ ] Allow to password protect certain notes? :) Maybe a hash to match against?

- [ ] Export Components from pacakge?

---

- [ ] Shift base to fumadocs?

---

<!-- Will be used later somewhere -->

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
