# Deploying to GitLab Pages

GitLab Pages offers built-in CI/CD pipelines to build and host your portfolio directly from your GitLab repository.

## Configuration

To deploy on GitLab, you need to create a `.gitlab-ci.yml` file in your project root.

```yaml
image: oven/bun:latest

pages:
  stage: deploy
  script:
    - bun install
    - bunx {{meta.pkg.name}} build
    - mv build public # GitLab Pages expects files in 'public' folder
  artifacts:
    paths:
      - public
  only:
    - main # Or your default branch
```

## How it works

1.  **Pipeline**: When you push to the `main` branch, GitLab starts a CI/CD job.
2.  **Artifact**: The `build` folder is generated, renamed to `public`, and saved as a job artifact.
3.  **Deployment**: GitLab automatically serves the contents of the `public` artifact at your project's URL.

## Accessing your site

Once the pipeline finishes, your site will be available at:
`https://<username>.gitlab.io/<project-name>/`

> [!NOTE]
> GitLab Pages handles routing automatically, but ensure your `base` path in `config.yml` matches your repository name if you aren't using a custom domain.
