# Config Reference

<center>This page list all possible Configuration Options</center>

## `site`

The `site` block contains global settings for your site identity and SEO. This information is used to generate meta tags, site titles, and social sharing previews.

| Key                 | Type    | Default                       | Description                                                                        |
| :------------------ | :------ | :---------------------------- | :--------------------------------------------------------------------------------- |
| `social_card`       | `str`   | `(default img)`               | Preview image used when sharing your site on social media.                         |
| `url`               | `str`   | `"auto"`                      | Canonical URL. Use `auto` for automatic CI/CD detection.                           |
| `path`              | `str`   | `"auto"`                      | Base path for sub-directory deployments.                                           |
| `edit_url`          | `str`   | `null`                        | Base URL for "Edit this page" links (e.g., GitHub repo tree/main link).            |
| `on_broken_links`   | `str`   | `"throw"`                     | Behavior when a link is broken <br/>Options: `throw`, `warn`, `ignore`.            |
| `on_broken_anchors` | `str`   | `"throw"`                     | Behavior when a link anchor (#) is missing.<br/>Options: `throw`, `warn`, `ignore` |
| `title`             | `str`   | `{{home_page.hero.title}}`    | The site name (tab title/headers).                                                 |
| `tagline`           | `str`   | `{{home_page.hero.desc}}`     | A brief desc used for SEO meta tags.                                               |
| `favicon`           | `str`   | `(default icon)`              | Path to your site's favicon.                                                       |
| `build`             | `block` | [see below](#site-build)      | Build settings.                                                                    |
| `rss`               | `block` | [see below](#site-rss)        | RSS feed generation                                                                |
| `robots_txt`        | `block` | [see below](#site-robots-txt) | `robots.txt` generation.                                                           |
| `blog.dir`          | `str`   | `"blog"`                      | Directory for blog documents. Relative to project root.                            |
| `blog.route`        | `str`   | `"blog"`                      | Custom base route/URL path for blog pages.                                         |
| `notes.dir`         | `str`   | `"notes"`                     | Directory for notes documents. Relative to project root.                           |
| `notes.route`        | `str`   | `"notes"`                     | Custom base route/URL path for notes pages.                                        |
| `notes.topic_list`  | `bool`  | `true`                        | Automatically append a list of child sub-topics to index/README pages.              |
| `head_tags`         | `list`  | `[]`                          | Custom HTML tags to inject into `<head>` (see Advanced section).                   |
| `markdown`          | `block` | [see below](#site-markdown)   | Markdown renderer settings.                                                        |

### `site.build`

| Key          | Type  | Default   | Description                                            |
| ------------ | ----- | --------- | ------------------------------------------------------ |
| `output_dir` | `str` | `"build"` | Custom directory name to output the built static site. |

### `site.rss`

| Key         | Type   | Default            | Description                              |
| :---------- | :----- | :----------------- | :--------------------------------------- |
| `enable`    | `bool` | `true`             | Toggle RSS feed generation for the blog. |
| `copyright` | `str`  | `(dynamic)`        | Custom copyright string for the feed.    |
| `desc`      | `str`  | `{{site.tagline}}` | Description for the feed.                |

### `site.robots_txt`

| Key            | Type   | Default | Description                                              |
| :------------- | :----- | :------ | :------------------------------------------------------- |
| `enable`       | `bool` | `true`  | Toggle `robots.txt` file generation.                     |
| `rules`        | `list` | `[...]` | List of rules (e.g., `user_agent`, `allow`, `disallow`). |
| `custom_lines` | `list` | `[]`    | Extra raw lines to append to `robots.txt`.               |

### `site.markdown`

Configure the Markdown renderer behavior.

| Key                       | Type   | Default   | Description                                                            |
| :------------------------ | :----- | :-------- | :--------------------------------------------------------------------- |
| `format`                  | `str`  | `"mdx"`   | Markdown parser format<br/>Options: `"mdx"`, `"md"`, `"detect"`.       |
| `on_broken_links`         | `str`  | `"throw"` | MD broken link behavior.<br/>Options: `"throw"`, `"warn"`, `"ignore"`. |
| `on_broken_images`        | `str`  | `"throw"` | MD broken image behavior.<br/>Options: same as above.                  |
| `mermaid`                 | `bool` | `true`    | Render Mermaid.js diagrams.                                            |
| `render_emoji_shortcodes` | `bool` | `true`    | Render emoji shortcodes like `:smile:`.                                |

## `theme`

The `theme` block controls the visual appearance and navigation behavior of portosaur site.

| Key          | Type  | Default                        | Description                           |
| :----------- | :---- | :----------------------------- | :------------------------------------ |
| `appearance` | block | [see below](#theme-appearance) | Settings related to visual appearance |
| `footer`     | block | [see below](#theme-footer)     | Site's footer settings                |
| `navigation` | block | [see below](#theme-navigation) | Navigation component settings         |

### `theme.appearance`

Settings related to the visual theme and mode switching.

| Key                    | Type   | Default  | Description                                                |
| :--------------------- | :----- | :------- | :--------------------------------------------------------- |
| `default_mode`         | `str`  | `"dark"` | Set the default theme.<br/>Options: `"dark"` or `"light"`. |
| `show_theme_switch`    | `bool` | `true`   | Show the dark/light mode toggle.                           |
| `disable_project_link` | `bool` | `false`  | Hide the Project link in the navbar.                       |

### `theme.navigation`

Settings for the site's navigation components.

| Key                     | Type   | Default | Description                                            |
| :---------------------- | :----- | :------ | :----------------------------------------------------- |
| `breadcrumbs`           | `bool` | `true`  | Show breadcrumb navigation in the documentation pages. |
| `collapsable_sidebar`   | `bool` | `true`  | Allow users to collapse the side navigation.           |
| `hide_navbar_on_scroll` | `bool` | `true`  | Automatically hide the navbar when scrolling down.     |

### `theme.footer`

Settings for the site footer.

| Key                    | Type   | Default | Description                          |
| :--------------------- | :----- | :------ | :----------------------------------- |
| `enable`               | `bool` | `true`  | Toggle the footer section.           |
| `message`              | `str`  | `null`  | Custom copyright message.            |
| `disable_project_link` | `bool` | `false` | Hide the Project link in the footer. |

## `home_page`

The `home_page` block contains the content for the primary sections of your site.

| Key             | Type  | Default                               | Description                                |
| :-------------- | :---- | :------------------------------------ | :----------------------------------------- |
| `hero`          | block | [see below](#home-page-hero)          | Configuration for the hero banner section. |
| `about`         | block | [see below](#home-page-about)         | Configuration for the about me section.    |
| `project_shelf` | block | [see below](#home-page-project-shelf) | Showcase of your best projects.            |
| `experience`    | block | [see below](#home-page-experience)    | Timeline of your professional career.      |
| `social`        | block | [see below](#home-page-social)        | Social media presence and contact links.   |

### `home_page.hero`

The hero section is the first thing visitors see. It should provide a clear and concise introduction to who you are.

| Key                     | Type   | Default                      | Description                                 |
| :---------------------- | :----- | :--------------------------- | :------------------------------------------ |
| `title`                 | `str`  | `"Your Name"`                | The main heading.                           |
| `profession`            | `str`  | `"Your Profession"`          | Your professional title.                    |
| `desc`                  | `str`  | `"Welcome to my portfolio."` | A short bio or mission statement.           |
| `profile_pic`           | `str`  | `(default icon)`             | Path to your main profile image.            |
| `intro`                 | `str`  | `"Hello there, I'm"`         | Small greeting text above the title.        |
| `subtitle`              | `str`  | `"I am a"`                   | Text displayed above your profession.       |
| `social`                | `list` | `[]`                         | List of social links below the hero.        |
| `learn_more_button_txt` | `str`  | `"Learn More"`               | Text for the primary call-to-action button. |

### `home_page.about`

The about section allows you to provide a more detailed biography and list your technical skills.

| Key              | Type   | Default                                          | Description                                    |
| :--------------- | :----- | :----------------------------------------------- | :--------------------------------------------- |
| `enable`         | `bool` | `true`                                           | Toggle the About section.                      |
| `heading`        | `str`  | `"About Me"`                                     | Heading for the about section.                 |
| `image`          | `str`  | `{{home_page.hero.profile_pic}}` -> default icon | Optional bio image.                            |
| `bio`            | `list` | `[...]`                                          | List of strings, each rendered as a paragraph. |
| `skills_heading` | `str`  | `"My Skills"`                                    | Heading for the technical skills section.      |
| `skills`         | `list` | `[]`                                             | List of skills to display as badges.           |
| `resume`         | `str`  | `null`                                           | Link to your resume/CV file.                   |

### `home_page.project_shelf`

The project shelf is a curated showcase of your best work. You can feature specific projects to give them more prominence.

| Key          | Type   | Default                          | Description                                                                      |
| :----------- | :----- | :------------------------------- | :------------------------------------------------------------------------------- |
| `enable`     | `bool` | `true`                           | Toggle the Project Shelf.                                                        |
| `heading`    | `str`  | `"My Projects"`                  | Heading for the project section.                                                 |
| `subheading` | `str`  | `"A collection of all my works"` | Subheading for the project section.                                              |
| `autoplay`   | `bool` | `true`                           | Enable/disable automatic scrolling for the shelf.                                |
| `projects`   | `list` | `[]`                             | List of project objects ([see schema below](#home-page-project-shelf-projects)). |

#### `home_page.project_shelf.projects`

| Key        | Type   | Default            | Description                                                                                                                                |
| :--------- | :----- | :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------- |
| `title`    | `str`  | `"Future Project"` | Name of the project.                                                                                                                       |
| `img`      | `str`  | `(blank icon)`     | Path to project thumbnail. Supports internal paths using `{{portoRoot}}` (e.g., `{{portoRoot}}/src/assets/img/icon.png`) or external URLs. |
| `state`    | `str`  | `"active"`         | Project status badge (`active`, `completed`, `maintenance`, `paused`, `archived`, `planned`). Rendered as a themed pill in the top-right.  |
| `featured` | `bool` | `false`            | If true, the project gets a prominent border and is **automatically sorted to the beginning** of the carousel.                             |
| `desc`     | `str`  | `"Coming soon..."` | Brief desc of the project and tech stack.                                                                                                  |
| `tags`     | `list` | `[]`               | Tech keywords (e.g., `["React", "Node"]`). Displayed as micro-glass pills inside the image container.                                      |
| `website`  | `str`  | `null`             | URL to the live website or production version.                                                                                             |
| `repo`     | `str`  | `null`             | URL to the source code repository (e.g., GitHub).                                                                                          |
| `demo`     | `str`  | `null`             | URL to a live demo or interactive preview.                                                                                                 |

### `home_page.experience`

The experience section provides a timeline of your professional career, education, or other milestones.

| Key          | Type   | Default                     | Description                                                                       |
| :----------- | :----- | :-------------------------- | :-------------------------------------------------------------------------------- |
| `enable`     | `bool` | `false`                     | Toggle the Experience section.                                                    |
| `heading`    | `str`  | `"Experience"`              | Heading for the experience section.                                               |
| `subheading` | `str`  | `"My professional journey"` | Subheading for the experience section.                                            |
| `list`       | `list` | `[]`                        | List of work experience objects ([see schema below](#home-page-experience-list)). |

#### `home_page.experience.list`

| Key        | Type  | Default | Description                                        |
| :--------- | :---- | :------ | :------------------------------------------------- |
| `company`  | `str` | `null`  | Name of the organization.                          |
| `role`     | `str` | `null`  | Your job title.                                    |
| `duration` | `str` | `null`  | Time period (e.g., "2022 - Present").              |
| `desc`     | `str` | `null`  | Summary of your responsibilities and achievements. |

### `home_page.social`

Manage your social media presence and contact links. These are usually displayed in the footer or social section.

| Key          | Type   | Default                    | Description                                                                    |
| :----------- | :----- | :------------------------- | :----------------------------------------------------------------------------- |
| `enable`     | `bool` | `true`                     | Toggle social media links.                                                     |
| `heading`    | `str`  | `"Get In Touch"`           | Heading for the contact section.                                               |
| `subheading` | `str`  | `"Feel free to reach out"` | Subheading with invitation to connect.                                         |
| `links`      | `list` | `[]`                       | List of social platform objects ([see schema below](#home-page-social-links)). |

#### `home_page.social.links`

| Key    | Type  | Default | Description                               |
| :----- | :---- | :------ | :---------------------------------------- |
| `name` | `str` | `null`  | Name of the platform (e.g., "GitHub").    |
| `icon` | `str` | `null`  | Icon identifier.                          |
| `desc` | `str` | `null`  | Brief description or call-to-action text. |
| `url`  | `str` | `null`  | URL to your profile.                      |

## `tasks`

The `tasks` block powers a public roadmap and goal tracking system. It allows you to share what you're working on and your progress with your audience.

| Key        | Type   | Default              | Description                                                   |
| :--------- | :----- | :------------------- | :------------------------------------------------------------ |
| `enable`   | `bool` | `false`              | Toggle the public tasks page.                                 |
| `title`    | `str`  | `"Tasks"`            | Heading for the tasks page.                                   |
| `subtitle` | `str`  | `"My current focus"` | Sub-heading for the page.                                     |
| `list`     | `list` | `[]`                 | List of task objects ([see schema below](#taskslist-schema)). |

#### `tasks.list`

| Key      | Type  | Default     | Description                                          |
| :------- | :---- | :---------- | :--------------------------------------------------- |
| `title`  | `str` | `null`      | Short name of the task.                              |
| `status` | `str` | `"pending"` | Current progress (`active`, `pending`, `completed`). |
| `desc`   | `str` | `null`      | Optional details about the task.                     |

## `tools`

The `tools` block includes functional utilities that enhance your portfolio's capabilities, such as a built-in link shortener.

| Key              | Type  | Default                            | Description                     |
| :--------------- | :---- | :--------------------------------- | :------------------------------ |
| `link_shortener` | block | [see below](#tools-link-shortener) | Internal link redirect utility. |

### `tools.link_shortener`

A built-in utility to create short, memorable URLs that redirect to external sites.

| Key           | Type   | Default | Description                            |
| :------------ | :----- | :------ | :------------------------------------- |
| `enable`      | `bool` | `false` | Toggle the internal link shortener.    |
| `deploy_path` | `str`  | `"/l"`  | URL base path for redirects.           |
| `short_links` | `dict` | `{}`    | Key-value map of slugs to target URLs. |

## `vars`

Define any key-value pairs in the `vars` block to reference them throughout your content using the `{{vars.key}}` syntax. This is useful for centralizing information like usernames or common links.

```yaml
vars:
  github: "yourusername"
  twitter: "@yourhandle"
```

## Advanced Configuration

### Custom Head Tags

Inject HTML directly into `<head>`. Useful for analytics, custom fonts, or verification tags.

```yaml
site:
  head_tags:
    - meta:
        name: "desc"
        content: "A professional portfolio built with {{meta.project.title}}."
    - script:
        src: "https://example.com/script.js"
        async: true
```
