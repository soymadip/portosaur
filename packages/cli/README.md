# porto

The primary command-line interface for Portosaur.

## Installation

```bash
# Global installation
bun install -g @portosaur/cli  # or npm install -g @portosaur/cli

# Or use directly with bunx/npx
bunx @portosaur/cli@latest # or npx @portosaur/cli@latest
```

## Commands

- `porto init [-P name]` — Initialize a new project (interactive mode recommended).
- `porto init-ci [-h id]` — Set up CI/CD for an existing project.
- `porto dev` — Start the development server.
- `porto build` — Generate a static production build.
- `porto serve` — Preview a production build locally.
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
