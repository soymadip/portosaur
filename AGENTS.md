# Portosaur — Contributor & Agent Guide (AGENTS.md)

Portosaur is a CLI-first portfolio/personal static site builder, built on
Fumadocs (headless core) + Next.js + React. The CLI generates a thin
Next.js root in the user's `.portosaur/` directory; the real UI lives in
`@portosaur/core`.

## Directory Structure

```
packages/
├── cli/       # CLI entry point, config engine, generators
├── core/      # React UI (layouts, pages, MDX components, CSS, plugins)
└── wizard/    # Interactive prompt library
docs/          # Documentation site (dogfoods the CLI)
src/
├── cz/        # Commitizen versioning (bumper.sh, cz.yaml, changelog.j2)
└── playground.mjs  # Developer playground scaffold (bun run playground)
proxy/         # Cloudflare Worker CORS/file proxy
tests/         # URL snapshots, goldens, smoke test
```

## Architecture Rules

- **Dependency Flow**: Flow MUST be unidirectional: `cli` -> `wizard`.
  The core package is NOT a CLI dependency — the generated Next.js root
  imports it, and user projects depend on it directly. No circular
  dependencies.
- **Lightweight CLI**: The `@portosaur/cli` package MUST NOT depend on
  `@portosaur/core` or heavy frontend frameworks (Next.js/React). The core
  package is injected into the user's local project `package.json` to keep
  global CLI installs fast. Heavy native tooling (sharp, ~20MB) lives in
  core too — the CLI spawns core's scripts for it (see `favicons.ts`,
  `packages/core/src/lib/favicon-render.ts`, and its thin runner
  `packages/core/scripts/make-favicons.mjs`) and never imports it.
- **Generated Root**: Never edit a site's `.portosaur/` directory by
  hand — it is regenerated on every build/dev run. Edit the generators
  in `packages/cli/src/engine/generators/` instead.
- **Workspace Imports**: Always use `@portosaur/<package>` for
  cross-package imports. No relative paths like `../../wizard`.
- **ESM only**: Use `.mjs`/`.ts` and `import`/`export` syntax everywhere.
- **TypeScript**: Type stripping (erasable syntax only), explicit `.ts`
  extensions on relative imports, types live in the source files.
  Verify with `bun run typecheck`.
- **Docs**: Update/write docs if required. Implementation should match docs.
- **Decision**: Ask before making any change in case of doubt.

## Code Style

- **Linear Flow**: Imports first, then constants, then logic top-to-bottom. Avoid unnecessary helpers.
- **Logger**: use the CLI's own logger (`packages/cli/src/logger/`) for CLI output.
- **Terminology**: Use **VCS Provider** (git host) and **Hosting Platform** (deployment target). Use `none` to skip.
- **Human Formatting**: Maintain sane newlines, group logical blocks with comments, and write "human-readable" code. Avoid machine-dense logic. Use newlines between documented properties and separate logical sections clearly. Never use numbered comments (e.g., // 1., // 2.); use descriptive section headers instead.
- **Braces**: Always use braces `{}` for `if` statements, even for single-line returns or guard clauses.
- **Bun**: Always use `bun` for package management (`bun add` / `bun remove` for dependencies — never hand-edit package.json or lockfiles). **Keep Node compatibility**.

## Testing

Always verify all tests pass with `bun run test:all` before pushing only
(bare `bun test` also scans `backup/` and shows expected failures from
the 0.26.0 reference code).

## Housekeeping

- `bun run test:all` regenerates `packages/cli/schema/config.json` raw —
  reformat it with `bun x prettier --write packages/cli/schema/config.json`
  before committing.

- The playground (`.playground/`) is gitignored. Rebuild it with
  `bun run playground build`.

- Don't run smoke test if you dont think it's urgently needed. netlify will let know if anything is broken

## Committing, Staging

Don't commit/stage without asking.
