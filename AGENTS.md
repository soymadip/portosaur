# Portosaur — Contributor & Agent Guide (AGENTS.md)

Portosaur is a CLI-first, Docusaurus-based portfolio/personal static site builder.

## Directory Structure

```
packages/
├── cli/       # CLI entry point and commands
├── core/      # YAML → Docusaurus translation logic
├── docs/      # documentation site
├── logger/    # Unified logging and colors
├── theme/     # React components and plugins
├── wizard/    # Interactive prompt library
└── docs/      # Documentation site
```

## Architecture Rules

- **Dependency Flow**: Flow MUST be unidirectional: `cli` -> `core` -> `logger`. (Theme depends on Core). No circular dependencies.
- **Lightweight CLI**: The `@portosaur/cli` package MUST NOT depend on `@portosaur/theme` or heavy frontend frameworks (Docusaurus/React). The theme should be injected into the user's local project `package.json` to keep global CLI installs fast.
- **Workspace Imports**: Always use `@portosaur/<package>` for cross-package imports. No relative paths like `../../logger`.
- **ESM only**: Use `.mjs` and `import`/`export` syntax everywhere if possible.
- **Types**: Library packages MUST have an `index.d.ts` in `src/`, linked via `types` in `package.json`. Update it if there are any changes in the code.
- **Docs**: Update/write docs if required. Implementation should match docs.
- **Decision**: Ask before making any change/ in case of doubt.

## Code Style

- **Linear Flow**: Imports first, then constants, then logic top-to-bottom. Avoid unnecessary helpers.
- **Logger**: use `@portosaur/logger` for CLI output.
- **Terminology**: Use **VCS Provider** (git host) and **Hosting Platform** (deployment target). Use `none` to skip.
- **Human Formatting**: Maintain sane newlines, group logical blocks with comments, and write "human-readable" code. Avoid machine-dense logic. Use newlines between documented properties and separate logical sections clearly. Never use numbered comments (e.g., // 1., // 2.); use descriptive section headers instead.
- **Braces**: Always use braces `{}` for `if` statements, even for single-line returns or guard clauses.
- **Bun**: Always use `bun` for package management. Keep Node compatibility.

## Testing

Always verify all tests pass with `bun test` before finishing.

## Committing, Staging

Don't commit/stage without asking
