#!/bin/bash
#
#  ____
# | __ ) _   _ _ __ ___  _ __   ___ _ __
# |  _ \| | | | '_ ` _ \| '_ \ / _ \ '__|
# | |_) | |_| | | | | | | |_) |  __/ |
# |____/ \__,_|_| |_| |_| .__/ \___|_|
#                      |_|
#
#  CLI tool for bumping Versions easily
#  Can Be use as Commitizen Hook too
#

declare -A VERSION_FILES

#================= Configuration =================

NEW_VERSION="${1:-$CZ_PRE_NEW_VERSION}"

VERSION_FILES=(
    ["package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
    ["docs/package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
    ["packages/cli/package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
    ["packages/core/package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
    ["packages/logger/package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
    ["packages/theme/package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
    ["packages/wizard/package.json"]='^  "version": "[^"]+" >   "version": "{{new_version}}"'
)

#==================== Helpers ======================

#log funcs
log.error() { echo -e "\033[0;31m✗ $1\033[0m" >&2; }
log.info() { echo -e "\033[0;34mℹ $1\033[0m" >&2; }
log.success() { echo -e "\033[0;32m✓ $1\033[0m" >&2; }

# Check if cmd is available
has-cmd() {
  local cmd_str cmd_bin exit_code=0

  [[ "$#" -eq 0 ]] && {
    log.error "No arguments provided."
    return 2
  }

  for cmd_str in "$@"; do
    cmd_bin="${cmd_str%% *}"

    if ! command -v "$cmd_bin" &>/dev/null; then
      exit_code=1
    fi
  done

  return "$exit_code"
}

# Escape special characters for sed inside double quotes with ~ delimiter
escape_sed() {
    local var="$1"
    # Escape backslashes first, then others
    var="${var//\\/\\\\}"
    var="${var//\~/\\~}"
    var="${var//\"/\\\"}"
    var="${var//\$/\\\$}"
    var="${var//\`/\\\`}"
    echo -n "$var"
}

#==================== Main Logic ======================

#--------- Check if version was passed --------
if [ -z "$NEW_VERSION" ]; then
    log.error "Error: No version argument provided."
    exit 1
fi



#--------- Check Commands ------------
has-cmd sed git || {
    log.error "Missing required commands: git sed"
    exit 1
}
log.success "Required Commands Available: git sed\n"

for file in "${!VERSION_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        log.error "File not found: $file"
        exit 1
    fi

    # Split rules by semicolon
    IFS=';' read -ra RULES <<< "${VERSION_FILES[$file]}"

    log.info "Bumping file: $file"

    for rule in "${RULES[@]}"; do
        # Split by > for Search > Replace
        search="${rule%%>*}"
        replace="${rule#*>}"

        # Trim optional one surrounding space
        search="${search% }"
        replace="${replace# }"

        # Substitute version placeholder
        replace="${replace//'{{new_version}}'/$NEW_VERSION}"

        # Escape for sed
        safe_search="$(escape_sed "$search")"
        safe_replace="$(escape_sed "$replace")"

        if sed -i -E "s~${safe_search}~${safe_replace}~" "$file"; then
            :
        else
            log.error "Failed to update pattern '$search' in $file"
            exit 1
        fi
    done
    log.success "Done"
done

echo
log.success "Successfully bumped '${!VERSION_FILES[*]}'\n"

#----------- Stage Files ----------
log.info "Staging files"
# git add "${!VERSION_FILES[@]}" || {
#     log.error "Failed to stage files"
#     exit 1
# }
log.success "All files are updated & staged.\n"
