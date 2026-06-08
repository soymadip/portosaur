# Other Hosting Providers

Since {{meta.project.title}} generates standard static files, you can use almost any modern hosting platform.

## Most Popular Ones

Here are the configurations for some of the most popular ones:-

### Netlify

Netlify is a fantastic choice with excellent support for Docusaurus-based sites.

1. Connect your repository to Netlify.
2. Set the **Build Command** to: `bunx {{meta.pkg.name}} build` (or `npx {{meta.pkg.name}} build`).
3. Set the **Publish Directory** to: `build`.
4. (Optional) Add a `NETLIFY_NODE_VERSION` environment variable set to `20` or higher.

### Vercel

Vercel provides a seamless experience for frontend frameworks.

1. Import your project into Vercel.
2. Choose **Other** as the Framework Preset.
3. Set the **Build Command** to: `bunx {{meta.pkg.name}} build` (or `npx {{meta.pkg.name}} build`).
4. Set the **Output Directory** to: `build`.

### Cloudflare Pages

Cloudflare Pages is highly performant and offers a generous free tier.

1. Connect your repository in the Cloudflare Dashboard.
2. Set the **Build command** to: `bunx {{meta.pkg.name}} build` (or `npx {{meta.pkg.name}} build`).
3. Set the **Build output directory** to: `build`.

---

> [!TIP]
> Most of these providers will automatically detect your project as a Node.js app. If they ask for a framework preset and {{meta.project.title}} is not listed, choosing **Docusaurus 3** will usually work perfectly as it shares the same build output structure.
