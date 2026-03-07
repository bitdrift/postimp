#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.local"
AUTO_YES=false

for arg in "$@"; do
  case "$arg" in
    --yes|-y) AUTO_YES=true ;;
  esac
done

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

echo "Fetching production env vars from Vercel..."
prod_vars=$(vercel env ls production 2>/dev/null || true)

if [[ -z "$prod_vars" ]]; then
  echo "Warning: could not fetch prod env vars (network error or auth expired)."
  echo "All variables will appear as 'missing'. Continue anyway?"
  read -rp "[y/N] " answer
  if [[ ! "$answer" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
fi

echo "Pulling production env values for comparison..."
prod_pulled=$(vercel env pull /dev/stdout --environment production 2>/dev/null || true)

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
  if [[ "$AUTO_YES" == true ]]; then
    echo "$prompt y (--yes)"
    return 0
  fi
  read -rp "$prompt" answer
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

    # Check if the key exists in prod (exact word match)
    if echo "$prod_vars" | grep -qw "$key"; then
      # Key exists — compare against pulled values
      current_value=$(echo "$prod_pulled" | grep "^${key}=" | sed "s/^${key}=//" || true)

      if [[ "$current_value" == "$value" ]]; then
        echo "[=] $key — already matches prod, skipping"
        skipped=$((skipped + 1))
        continue
      fi

      echo ""
      echo "[~] $key differs from production"
      echo "    Local: $(mask_value "$value")"
      echo "    Prod:  $(mask_value "${current_value:-(empty)}")"
      if confirm "    Update in production? [y/N] "; then
        echo "$value" | vercel env rm "$key" production -y 2>/dev/null || true
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
      if confirm "    Add to production? [y/N] "; then
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
