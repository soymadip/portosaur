# Config Reference

<center>This page list all possible Configuration Options</center>

## `site`

The `site` block contains global settings for your site identity and SEO. This information is used to generate meta tags, site titles, and social sharing previews.

| Key                 | Type   | Default          | Description                                                      |
| :------------------ | :----- | :--------------- | :--------------------------------------------------------------- |
| `title`             | `str`  | `"Your Name"`    | The name displayed in the browser tab and site headers.          |
| `tagline`           | `str`  | `"Short bio..."` | A brief desc used for SEO meta tags.                             |
| `favicon`           | `str`  | `(default icon)` | Path to your site's favicon.                                     |
| `social_card`       | `str`  | `(default img)`  | Preview image used when sharing your site on social media.       |
| `url`               | `str`  | `"auto"`         | Canonical URL. Use `auto` for automatic CI/CD detection.         |
| `path`              | `str`  | `"auto"`         | Base path for sub-directory deployments.                         |
| `on_broken_links`   | `str`  | `"throw"`        | Behavior when a link is broken (`throw`, `warn`, `ignore`).      |
| `on_broken_anchors` | `str`  | `"throw"`        | Behavior when a link anchor (#) is missing.                      |
| `robots_txt`        | `dict` | `{enable: true}` | Configuration for `robots.txt` generation.                       |
| `rss`               | `bool` | `true`           | Enable RSS and Atom feeds for the blog.                          |
| `head_tags`         | `list` | `[]`             | Custom HTML tags to inject into `<head>` (see Advanced section). |
| `cors_proxy`        | `list` | `[]`             | Custom CORS proxies for image loading (see Advanced section).    |

## `theme`

The `theme` block controls the visual appearance and navigation behavior of your portfolio. It allows you to toggle dark mode, customize the sidebar, and enable advanced Markdown features.

### `appearance`

Settings related to the visual theme and mode switching.

| Key                | Type   | Default | Description                                                  |
| :----------------- | :----- | :------ | :----------------------------------------------------------- |
| `dark_mode`        | `bool` | `true`  | Enable the dark theme by default.                            |
| `disable_switch`   | `bool` | `false` | Hide the dark/light mode toggle.                             |
| `disable_branding` | `bool` | `false` | Hide the "{{meta.project.title}} vX.X.X" link in the navbar. |

### `navigation`

Settings for the site's navigation components.

| Key                     | Type   | Default | Description                                        |
| :---------------------- | :----- | :------ | :------------------------------------------------- |
| `collapsable_sidebar`   | `bool` | `true`  | Allow users to collapse the side navigation.       |
| `hide_navbar_on_scroll` | `bool` | `true`  | Automatically hide the navbar when scrolling down. |

### `markdown`

Fine-tune the behavior of the Markdown renderer and documentation features.

| Key                | Type   | Default   | Description                             |
| :----------------- | :----- | :-------- | :-------------------------------------- |
| `on_broken_links`  | `str`  | `"throw"` | MD-specific broken link behavior.       |
| `on_broken_images` | `str`  | `"throw"` | MD-specific broken image behavior.      |
| `mermaid`          | `bool` | `true`    | Enable support for Mermaid.js diagrams. |

## `home_page`

The `home_page` block contains the content for the primary sections of your site. This is where you define your hero banner, about text, project showcase, and more.

### `hero`

The hero section is the first thing visitors see. It should provide a clear and concise introduction to who you are.

| Key                  | Type  | Default               | Description                                 |
| :------------------- | :---- | :-------------------- | :------------------------------------------ |
| `title`              | `str` | `{{site.title}}`      | The main heading (defaults to site title).  |
| `profession`         | `str` | `"Software Engineer"` | Your professional title.                    |
| `desc`               | `str` | `{{site.tagline}}`    | A short bio or mission statement.           |
| `profile_pic`        | `str` | `(default icon)`      | Path to your main profile image.            |
| `intro`              | `str` | `"Hello there, I'm"`  | Small greeting text above the title.        |
| `subtitle`           | `str` | `"I am a"`            | Text displayed above your profession.       |
| `learn_more_btn_txt` | `str` | `"Learn More"`        | Text for the primary call-to-action button. |

### `about`

The about section allows you to provide a more detailed biography and list your technical skills.

| Key              | Type   | Default       | Description                                     |
| :--------------- | :----- | :------------ | :---------------------------------------------- |
| `enable`         | `bool` | `true`        | Toggle the About section.                       |
| `heading`        | `str`  | `"About Me"`  | Heading for the about section.                  |
| `subheading`     | `str`  | `null`        | Subheading for the about section.               |
| `image`          | `str`  | `null`        | Optional bio image (falls back to profile pic). |
| `bio`            | `list` | `[...]`       | List of strings, each rendered as a paragraph.  |
| `skills_heading` | `str`  | `"My Skills"` | Heading for the technical skills section.       |
| `skills`         | `list` | `[]`          | List of skills to display as badges.            |
| `resume`         | `str`  | `null`        | Link to your resume/CV file.                    |

### `project_shelf`

The project shelf is a curated showcase of your best work. You can feature specific projects to give them more prominence.

| Key          | Type   | Default         | Description                                       |
| :----------- | :----- | :-------------- | :------------------------------------------------ |
| `enable`     | `bool` | `true`          | Toggle the Project Shelf.                         |
| `heading`    | `str`  | `"My Projects"` | Heading for the project section.                  |
| `subheading` | `str`  | `null`          | Subheading for the project section.               |
| `autoplay`   | `bool` | `true`          | Enable/disable automatic scrolling for the shelf. |
| `projects`   | `list` | `[]`            | List of project objects (see schema below).       |

**Project Object Schema:**

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

### `experience`

The experience section provides a timeline of your professional career, education, or other milestones.

| Key          | Type   | Default        | Description                            |
| :----------- | :----- | :------------- | :------------------------------------- |
| `enable`     | `bool` | `false`        | Toggle the Experience section.         |
| `heading`    | `str`  | `"Experience"` | Heading for the experience section.    |
| `subheading` | `str`  | `null`         | Subheading for the experience section. |
| `list`       | `list` | `[]`           | List of work experience objects.       |

**Experience Object Schema:**

| Key        | Type  | Default | Description                                        |
| :--------- | :---- | :------ | :------------------------------------------------- |
| `company`  | `str` | `null`  | Name of the organization.                          |
| `role`     | `str` | `null`  | Your job title.                                    |
| `duration` | `str` | `null`  | Time period (e.g., "2022 - Present").              |
| `desc`     | `str` | `null`  | Summary of your responsibilities and achievements. |

### `social`

Manage your social media presence and contact links. These are usually displayed in the footer or social section.

| Key          | Type   | Default          | Description                                         |
| :----------- | :----- | :--------------- | :-------------------------------------------------- |
| `enable`     | `bool` | `true`           | Toggle social media links.                          |
| `heading`    | `str`  | `"Get In Touch"` | Heading for the contact section.                    |
| `subheading` | `str`  | `(dynamic)`      | Subheading with invitation to connect.              |
| `links`      | `list` | `[]`             | List of social platform objects (see schema below). |

**Social Link Schema:**

| Key    | Type  | Default | Description                                          |
| :----- | :---- | :------ | :--------------------------------------------------- |
| `name` | `str` | `null`  | Name of the platform (e.g., "GitHub").               |
| `icon` | `str` | `null`  | Icon identifier (supports FontAwesome/Lucide names). |
| `url`  | `str` | `null`  | URL to your profile.                                 |

## `tasks`

The `tasks` block powers a public roadmap and goal tracking system. It allows you to share what you're working on and your progress with your audience.

| Key        | Type   | Default         | Description                              |
| :--------- | :----- | :-------------- | :--------------------------------------- |
| `enable`   | `bool` | `false`         | Toggle the public tasks page.            |
| `title`    | `str`  | `"Tasks"`       | Heading for the tasks page.              |
| `subtitle` | `str`  | `(placeholder)` | Sub-heading for the page.                |
| `list`     | `list` | `[]`            | List of task objects (see schema below). |

**Task `list` Object Schema:**

| Key      | Type  | Default  | Description                                       |
| :------- | :---- | :------- | :------------------------------------------------ |
| `title`  | `str` | `null`   | Short name of the task.                           |
| `status` | `str` | `"todo"` | Current progress (`done`, `todo`, `in-progress`). |
| `desc`   | `str` | `null`   | Optional details about the task.                  |

## `tools`

The `tools` block includes functional utilities that enhance your portfolio's capabilities, such as a built-in link shortener.

### `link_shortener`

A built-in utility to create short, memorable URLs that redirect to external sites.

| Key           | Type   | Default | Description                            |
| :------------ | :----- | :------ | :------------------------------------- |
| `enable`      | `bool` | `false` | Toggle the internal link shortener.    |
| `deploy_path` | `str`  | `"/l"`  | URL base path for redirects.           |
| `short_links` | `dict` | `{}`    | Key-value map of slugs to target URLs. |

## `custom`

Define any key-value pairs in the `custom` block to reference them throughout your content using the `{{custom.key}}` syntax. This is useful for centralizing information like usernames or common links.

```yaml
custom:
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
