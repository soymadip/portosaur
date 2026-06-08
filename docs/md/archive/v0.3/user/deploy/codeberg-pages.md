# Codeberg Pages

Codeberg offers free hosting for your portfolio. You can deploy manually using a `pages` branch or automate it using **Codeberg Actions** (recommended) or **Woodpecker CI**.

## Automated Setup with `init-ci`

The fastest way to set up Codeberg is using the CLI:

```bash
bunx {{meta.pkg.name}} init-ci
```

This will generate the **Codeberg Actions** workflow for you.

## Using Codeberg Actions (Modern)

Codeberg Actions is a modern CI/CD system compatible with GitHub Actions. {{meta.project.title}} provides a ready-to-go workflow in `.forgejo/workflows/deploy.yml`.

1.  **Enable Actions**: Go to your repository **Settings > Actions > General** and ensure "Enable Actions" is checked.
2.  **Push**: Push your code to the `main` branch.
3.  **Monitor**: View the progress in the **Actions** tab of your repository.

## Using Woodpecker CI (Alternative)

If you prefer using Woodpecker CI instead of Codeberg Actions, you can initialize it by explicitly specifying the hosting platform:

```bash
bunx {{meta.pkg.name}} init-ci --hosting woodpecker
```

This will create a `.woodpecker/deploy.yml` file. Ensure Woodpecker is enabled for your repository at [ci.codeberg.org](https://ci.codeberg.org).

## Manual Deployment

If you prefer to deploy manually:

1.  **Build**: Run `bun run build`.
2.  **Branch**: Create a `pages` branch in your repository.
3.  **Upload**: Upload the contents of the `build/` directory to the `pages` branch.
4.  **Settings**: Ensure your repository is configured to serve from the `pages` branch in **Settings > Pages**.
