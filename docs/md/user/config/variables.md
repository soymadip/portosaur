# Dynamic Variables

{{meta.project.title}} allows you to use placeholders in your `config.yml`, templates that are **resolved at build time**. The resolution engine is recursive, allowing for complex data re-use.

## Syntax

Use double curly braces to reference a variable: `\{{variable_path}}`. Paths can be nested using dots (e.g., `\{{site.title}}`).

## Available Variables

### System Variables

These variables are automatically provided by the engine during the build process:

- `\{{porto_version}}` — Current {{meta.project.title}} version.
- `\{{compile_year}}` — Year at build time (useful for copyright notices).
- `\{{compile_date}}` — Date at build time.
- `\{{site_url}}` — The fully resolved URL of your site.
- `\{{base_url}}` — The base path of your site (e.g., `/my-portfolio/`).
- `\{{last_updated}}` — The timestamp of the last git commit.
- `\{{is_prod}}` / `{{is_dev}}` — Booleans indicating the current build environment.
- `\{{site_root}}` — The absolute path to your local project directory.
- `\{{porto_static}}` — The absolute path to the `@{{meta.project.title}}/theme` static assets directory.

### Configuration References

You can reference any value from your `config.yml` within other parts of the configuration:

- `\{{site.title}}` — Resolves to the site title.
- `\{{site.tagline}}` — Resolves to the site tagline.

### Environment Variables

Access any system environment variable using the `env.` prefix:

```yaml
site:
  token: "\{{env.MY_SECRET_TOKEN}}"
```

### Custom Variables

You can define your own variables in the `vars:` block of your `config.yml` and reference them elsewhere:

```yaml
vars:
  twitter_handle: "@myname"

hero_section:
  desc: "Follow me on Twitter: \{{vars.twitter_handle}}"
```

## Recursive Resolution

The resolution engine supports deep nesting. A variable can reference another variable which in turn references a system or environment key.

```yaml
# config.yml
vars:
  name: "John Doe"
  intro: "Hello, I am \{{vars.name}}"

site:
  tagline: "\{{vars.intro}} and this is my site."
```

## Literals & Escaping

If you want to display the literal `\{{variable_name}}` without it being resolved, prefix the first brace with a backslash: `\\{{variable_name}}`.

> [!NOTE]
>
> In `config.yml`, you should use `\\{{` to escape the tag. The backslash will be removed and the braces will be preserved in the final output.
