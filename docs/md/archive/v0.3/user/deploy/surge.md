# Deploying to Surge.sh

[Surge.sh](https://surge.sh/) is a simple, single-command static web publishing service. {{meta.project.title}} supports automated deployments to Surge using GitHub Actions or GitLab CI.

## 1. Get your Surge Token

Before configuring {{meta.project.title}}, you need to generate a Surge token from your local machine:

1. Install the Surge CLI: `npm install -g surge`
2. Login: `surge login`
3. Get your token: `surge token`

Keep this token safe; you'll need it for the CI/CD secrets.

## 2. Configure {{meta.project.title}}

### For New Projects

When running `bunx {{meta.pkg.name}} init`, first choose your preferred **VCS Provider** (e.g., GitHub, GitLab) and then select **Surge.sh** as your hosting platform.

### For Existing Projects

If you already have a {{meta.project.title}} project, run:

```bash
bunx {{meta.pkg.name}} init-ci --hosting surge
```

The CLI will attempt to detect your git remote to pick the correct CI template.

## 3. Set Up Secrets

To allow the CI pipeline to deploy on your behalf, you must add the following secrets to your repository settings (**Settings > Secrets and variables > Actions** for GitHub, or **Settings > CI/CD > Variables** for GitLab):

| Secret Name   | Value                              |
| ------------- | ---------------------------------- |
| `SURGE_LOGIN` | Your Surge email address.          |
| `SURGE_TOKEN` | The token you generated in step 1. |

## 4. Deploy

Once configured, simply push your changes to the `main` branch. Your site will be automatically built and deployed to `https://your-project-name.surge.sh`.
