#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_NAME="smoke-test-site"
SITE_DIR="$REPO_ROOT/$SITE_NAME"

echo "🧹 Cleaning up old smoke-test-site..."
rm -rf "$SITE_DIR"

# --- Register all local packages via bun link ---
echo "🔗 Linking local packages..."
for pkg in core logger wizard cli theme; do
  (cd "$REPO_ROOT/packages/$pkg" && bun link)
done

# --- Initialize new project ---
echo "🚀 Initializing new project..."
bun run "$REPO_ROOT/packages/cli/bin/porto.mjs" init \
  --project-name "$SITE_NAME" \
  --no-install

# --- Link local packages into the new project ---
echo "📦 Installing local packages..."
cd "$SITE_DIR"
bun install
bun link @portosaur/cli @portosaur/theme @portosaur/core @portosaur/logger @portosaur/wizard

# --- Build ---
echo "🔨 Building..."
# Use the local linked porto directly to avoid 'bun install' in the script overwriting links
./node_modules/.bin/porto build

echo ""
echo "✅ Smoke test passed!"
