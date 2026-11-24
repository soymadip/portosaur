#!/bin/sh
# One netlify.toml serves both Netlify sites, so the build branches on
# PORTO_SITE (set per site in the dashboard). Portfolio builds the
# portfolio test site, anything else builds the docs.
set -e

bun run schema

if [ "$PORTO_SITE" = "portfolio" ]; then
  bun run --cwd portfolio-test build
  # Both sites publish from docs/build, so the portfolio output is staged there.
  rm -rf docs/build
  cp -r portfolio-test/build docs/build
else
  bun run --cwd docs build
  mkdir -p docs/build/schema
  cp packages/cli/schema/*.json docs/build/schema/
fi
