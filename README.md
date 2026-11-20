# Portosaur

Complete portfolio cum personal website solution for your digital personality.

This branch (`fresh/fumadocs`) rebuilds Portosaur on **Fumadocs headless core + Next.js 16**,
targeting **1.0.0**. The old Docusaurus-based code lives in `backup/` as a reference only —
see the spec in the migration goal for the full plan.

## Layout

- `packages/core` — the site itself (Next.js App Router routes, React components, CSS).
  Started from the official `create-fumadocs-app` static template.
- `packages/cli` — the `porto` binary, config engine, and Next.js root generator.
- `packages/wizard` — interactive prompt library used by `porto init`.
- `docs/` — the documentation site (dogfood).
- `backup/` — the 0.26.0 Docusaurus codebase, kept as a reference.

## Development

```sh
bun install
bun run --cwd docs dev
```
