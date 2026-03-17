#!/usr/bin/env bash
# sync-env.sh — Push local env vars to Vercel production
#
# Reads each KEY=VALUE pair from .env.local and compares it against the
# current production environment on Vercel. For each variable it will:
#   [=] Skip if the value already matches prod
#   [~] Prompt to update if the value differs from prod
#   [+] Prompt to add if the key doesn't exist on prod yet
#
# Usage:
#   npm run vercel:env:push              # interactive — prompts for each change
#   npm run vercel:env:push -- --yes     # auto-approve all changes
#   npm run vercel:env:push -- --dry-run # show what would change without writing
#
# Requires: vercel CLI (npm i -g vercel), project linked via `vercel link`
set -euo pipefail

ENV_FILE=".env.local"
AUTO_YES=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
    --dry-run|-n) DRY_RUN=true ;;
  esac
done

if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN: no changes will be made."
  echo ""
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

if ! command -v vercel &>/dev/null; then
  echo "Error: vercel CLI not found. Install with: npm i -g vercel"
  exit 1
fi

if [[ ! -d ".vercel" ]]; then
  echo "Project not linked to Vercel. Running 'vercel link'..."
  vercel link
fi

# Pull production env into a temp file for comparison
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

echo "Pulling production env values for comparison..."
vercel env pull "$TMPFILE" --environment production --yes 2>/dev/null || true

# Build an associative array of prod key=value pairs
declare -A prod_values
while IFS= read -r pline; do
  [[ -z "$pline" || "$pline" =~ ^[[:space:]]*# ]] && continue
  if [[ "$pline" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
    pkey="${BASH_REMATCH[1]}"
    pval="${BASH_REMATCH[2]}"
    # Strip surrounding quotes
    if [[ "$pval" =~ ^\"(.*)\"$ ]] || [[ "$pval" =~ ^\'(.*)\'$ ]]; then
      pval="${BASH_REMATCH[1]}"
    fi
    prod_values["$pkey"]="$pval"
  fi
done < "$TMPFILE"

echo "Found ${#prod_values[@]} production variables."
echo ""

_NOTFOUND_="__%NOTFOUND%__"

mask_value() {
  local v="$1"
  local len=${#v}
  if [[ $len -le 8 ]]; then
    echo "********"
  else
    echo "${v:0:4}...${v:$((len-4)):4}"
  fi
}

confirm() {
  local prompt="$1"
  if [[ "$AUTO_YES" == true || "$DRY_RUN" == true ]]; then
    return 0
  fi
  # Read from terminal, not from redirected stdin
  read -rp "$prompt" answer < /dev/tty
  [[ "$answer" =~ ^[Yy]$ ]]
}

added=0
updated=0
skipped=0

while IFS= read -r line; do
  # Skip empty lines and comments
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

  # Parse KEY=VALUE (handle quoted values)
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    # Strip surrounding quotes if present
    if [[ "$value" =~ ^\"(.*)\"$ ]] || [[ "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi

    # Check if the key exists in prod
    current_value="${prod_values[$key]:-$_NOTFOUND_}"

    if [[ "$current_value" != "$_NOTFOUND_" ]]; then
      # Key exists in prod — compare values
      if [[ "$current_value" == "$value" ]]; then
        echo "[=] $key — already matches prod, skipping"
        skipped=$((skipped + 1))
        continue
      fi

      echo ""
      echo "[~] $key differs from production"
      echo "    Local: $(mask_value "$value")"
      echo "    Prod:  $(mask_value "${current_value:-(empty)}")"
      if [[ "$DRY_RUN" == true ]]; then
        echo "    Would update in production."
        updated=$((updated + 1))
      elif confirm "    Update in production? [y/N] "; then
        vercel env rm "$key" production -y 2>/dev/null || true
        echo "$value" | vercel env add "$key" production
        echo "    Updated."
        updated=$((updated + 1))
      else
        echo "    Skipped."
        skipped=$((skipped + 1))
      fi
    else
      echo ""
      echo "[+] $key is not in production"
      echo "    Value: $(mask_value "$value")"
      if [[ "$DRY_RUN" == true ]]; then
        echo "    Would add to production."
        added=$((added + 1))
      elif confirm "    Add to production? [y/N] "; then
        # Remove first in case it exists under "All Environments"
        vercel env rm "$key" production -y 2>/dev/null || true
        echo "$value" | vercel env add "$key" production
        echo "    Added."
        added=$((added + 1))
      else
        echo "    Skipped."
        skipped=$((skipped + 1))
      fi
    fi
  fi
done < "$ENV_FILE"

echo ""
echo "Done. Added: $added, Updated: $updated, Skipped: $skipped"
