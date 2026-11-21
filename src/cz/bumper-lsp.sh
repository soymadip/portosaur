#!/bin/bash
#
# Bumps the LSP version line: the VS Code extension, the Zed
# extension manifest and crate, and the Zed lockfile. The server
# binary gets its version from the release tag at build time, so
# there is no file to bump for it.
#
# Used as a Commitizen pre-bump hook (see src/cz/cz-lsp.yaml).
# Can also run by hand: src/cz/bumper-lsp.sh 0.2.0

NEW_VERSION="${1:-$CZ_PRE_NEW_VERSION}"

#==================== Helpers ======================

log.error() { echo -e "\033[0;31m✗ $1\033[0m" >&2; }
log.info() { echo -e "\033[0;34mℹ $1\033[0m" >&2; }
log.success() { echo -e "\033[0;32m✓ $1\033[0m" >&2; }

#==================== Main Logic ======================

if [ -z "$NEW_VERSION" ]; then
    log.error "Error: No version argument provided."
    exit 1
fi

for cmd in sed git grep; do
    if ! command -v "$cmd" &>/dev/null; then
        log.error "Missing required command: $cmd"
        exit 1
    fi
done

# Bump a version line, then confirm the new version is really there.
# $1: file, $2: sed script, $3: grep pattern proving the bump landed.
bump_file() {
    local file="$1" script="$2" check="$3"

    if [[ ! -f "$file" ]]; then
        log.error "File not found: $file"
        exit 1
    fi

    log.info "Bumping file: $file"
    sed -i -E "$script" "$file" || {
        log.error "Failed to update $file"
        exit 1
    }
    grep -q -E "$check" "$file" || {
        log.error "Version $NEW_VERSION did not land in $file"
        exit 1
    }
    log.success "Done"
}

bump_file "extensions/vscode/package.json" \
    "s~^  \"version\": \"[^\"]+\"~  \"version\": \"$NEW_VERSION\"~" \
    "^  \"version\": \"$NEW_VERSION\"$"

bump_file "extensions/zed/extension.toml" \
    "s~^version = \"[^\"]+\"~version = \"$NEW_VERSION\"~" \
    "^version = \"$NEW_VERSION\"$"

bump_file "extensions/zed/Cargo.toml" \
    "s~^version = \"[^\"]+\"~version = \"$NEW_VERSION\"~" \
    "^version = \"$NEW_VERSION\"$"

# Cargo.lock holds one version line per package: bump only the line
# right after the zed-portosaur entry.
bump_file "extensions/zed/Cargo.lock" \
    "/^name = \"zed-portosaur\"$/{n;s~^version = \"[^\"]+\"~version = \"$NEW_VERSION\"~}" \
    "^version = \"$NEW_VERSION\"$"

echo
log.success "Successfully bumped the LSP version to $NEW_VERSION"
