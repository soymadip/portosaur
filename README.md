<div align="center">
    <img src="./packages/theme/assets/img/icon.png" width=110>
    <h1>Portosaur</h1>
    <p>Complete portfolio and personal website solution for your digital personality.</p>
    <br />
</div>

## 🧩 Features

- **👨‍💻 Fully Featured Portfolio** — Showcase yourself, your projects, skills, experience & social identity.
- **📚 Knowledge Base** — Never forget a thing. Build your digital second brain with integrated notes vault.
- **📝 Blog Platform** — Share your journey in blog that's easy to write & beautiful to read.
- **📋 Task Tracking** — Track your plans with priority levels & completion status.
- **📱 Mobile Optimized** — Adapts seamlessly on all devices, from desktop to mobiles.
- **🛠️ Highly Configurable** — Extensive customization options through a central, logic-less config.

## Quick Start

Get your portfolio up and running in seconds:

```bash
# Initialize a new project (interactive)
bunx @portosaur/cli init

# Or with project name (not recommended)
bunx @portosaur/cli@latest init -P my-portfolio


# Start development
cd <your-project-dir>
bun run dev   # or: npm run dev
```

## 📍 Documentation

For user guides and CLI reference, visit the **[Documentation Site](https://soymadip.github.io/portosaur)**.

<br>

## 🏗️ Architecture

This repository is a monorepo structured for performance and extensibility:

- **[`@portosaur/cli`](./packages/cli)** — The CLI for project lifecycle & builds.
- **[`@portosaur/core`](./packages/core)** — The logic engine for configuration & variable resolution.
- **[`@portosaur/theme`](./packages/theme)** — The UI core containing components, assets, & plugins.
- **[`@portosaur/wizard`](./packages/wizard)** — The interaction engine for CLI prompt workflows.

## Credits

- [Docusaurus](https://docusaurus.io/) - The core engine.
- [Catppuccin](https://github.com/catppuccin/catppuccin) - Color inspiration.
- [Hugo Profile](https://hugo-profile.netlify.app/) - Design inspiration.
- [VitePress](https://vitepress.dev) - Documentation site

---

<div align="center">
    Built with 🦖 by <a href="https://github.com/soymadip">soymadip</a>
</div>
