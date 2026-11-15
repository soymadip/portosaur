# porto

The primary command-line interface for Portosaur.

## Installation

```bash
# Global installation
bun install -g @portosaur/cli  # or npm install -g @portosaur/cli

# Or use directly with bunx/npx
bunx @portosaur/cli@latest init # or npx @portosaur/cli@latest init
```

## Commands

- `porto init` — Initialize a portfolio or documentation site (interactive mode recommended).
- `porto providers` — List VCS Providers and Hosting Platforms.
- `porto dev [siteDir]` — Start the development server. `porto start` is an alias.
- `porto build [siteDir]` — Generate a static production build.
- `porto serve [siteDir]` — Preview a production build locally.
- `porto schema` — Output the JSON schema for validation.

## Usage

```bash
# Interactive mode (recommended)
porto init

# Or with project name
porto init -P my-portfolio

# With all options (non-interactive)
porto init -P my-site -p github -h github-pages -u myusername -n "My Name"

# Start development
cd my-portfolio
bun run dev

# Build for production
bun run build
```

## Library Usage

If you want to use Portosaur programmatically, install `@portosaur/core`:

```bash
bun install -g @portosaur/core
```

See `@portosaur/core` for API documentation.
