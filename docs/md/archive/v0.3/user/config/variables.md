# Dynamic Variables

{{meta.project.title}} allows you to use placeholders in your `config.yml`, templates that are **resolved at build time**. The resolution engine is recursive, allowing for complex data re-use.

## Syntax

Use double curly braces to reference a variable: `\{{variable_path}}`. Paths can be nested using dots (e.g., `\{{site.title}}`).

## Available Variables

### System Variables

These variables are automatically provided by the engine during the build process:

- `\{{portoVersion}}` — Current {{meta.project.title}} version.
- `\{{compileYear}}` — Year at build time (useful for copyright notices).
- `\{{compileDate}}` — Date at build time.
- `\{{siteUrl}}` — The fully resolved URL of your site.
- `\{{baseUrl}}` — The base path of your site (e.g., `/my-portfolio/`).
- `\{{lastUpdated}}` — The timestamp of the last git commit.
- `\{{isProd}}` / `{{isDev}}` — Booleans indicating the current build environment.

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

You can define your own variables in the `custom:` block of your `config.yml` and reference them elsewhere:

```yaml
custom:
  twitter_handle: "@myname"

hero_section:
  desc: "Follow me on Twitter: \{{custom.twitter_handle}}"
```

## Recursive Resolution

The resolution engine supports deep nesting. A variable can reference another variable which in turn references a system or environment key.

```yaml
# config.yml
custom:
  name: "soymadip"
  intro: "Hello, I am \{{custom.name}}"

site:
  tagline: "\{{custom.intro}} and this is my site."
```

## Literals & Escaping

If you want to display the literal `\{{variable_name}}` without it being resolved, prefix the first brace with a backslash: `\\{{variable_name}}`.

> **Note**: In `config.yml`, you should use `\\{{` to escape the tag. The engine will remove the backslash and preserve the braces in the final output.
