#!/usr/bin/env bash
# Compare jsDelivr pins on Agilotext editor pages (staging vs www).
set -euo pipefail

STAGING="${STAGING_EDITOR_URL:-https://agilotext-test.webflow.io/app/business/editor}"
WWW="${WWW_EDITOR_URL:-https://www.agilotext.com/app/business/editor}"

extract_pins() {
  curl -sL "$1" | rg -o 'cdn\.jsdelivr\.net/gh/Agilotext/Agilotext-Scripts-Public@[^"'\'' ]+' | sort -u
}

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
extract_pins "$STAGING" > "$tmp/staging.txt"
extract_pins "$WWW" > "$tmp/www.txt"

echo "=== Only on staging ==="
comm -13 "$tmp/www.txt" "$tmp/staging.txt"
echo
echo "=== Only on www ==="
comm -23 "$tmp/www.txt" "$tmp/staging.txt"
echo
echo "=== Shared ==="
comm -12 "$tmp/www.txt" "$tmp/staging.txt"
