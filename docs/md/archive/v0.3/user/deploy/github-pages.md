# Deploying to GitHub Pages

GitHub Pages is one of the easiest ways to host your {{meta.project.title}} portfolio. By using GitHub Actions, you can automate the build and deployment process so your site updates every time you push to your repository.

## Automated Deployment (Recommended)

1.  Create a file named `.github/workflows/deploy.yml` in your repository.
2.  Paste the following configuration:

```yaml
name: Deploy Portfolio

on:
  push:
    branches:
      - main # Or your default branch

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build site
        run: bunx {{meta.pkg.name}} build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./build

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

3.  Go to your repository settings on GitHub.
4.  Navigate to **Pages** (under Code and automation).
5.  Under **Build and deployment > Source**, select **GitHub Actions**.

## Deployment URL

Your site will typically be available at:
`https://<username>.github.io/<repository-name>/`

> [!TIP]
> If you are using a **Custom Domain**, remember to add it in the GitHub Pages settings and update your `config.yml` if necessary.
