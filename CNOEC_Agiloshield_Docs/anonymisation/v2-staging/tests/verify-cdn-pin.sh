#!/bin/sh
# Compare Git blob, raw GitHub and jsDelivr for every file served by one immutable pin.
# Usage: tests/verify-cdn-pin.sh <full-sha>
set -eu
SHA="${1:?commit sha required}"
DIR="CNOEC_Agiloshield_Docs/anonymisation/v2-staging"
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../../../.." && pwd)
cd "$ROOT"
TMP=$(mktemp -d)
for NAME in agiloshield-v2-embed.js agiloshield-v2-client.js agiloshield-v2-lists.js \
  agiloshield-v2-location.js agiloshield-v2-auth.js agiloshield-v2-copy.js \
  agiloshield-v2-icons.js agiloshield-v2.css; do
  FILE="${DIR}/${NAME}"
  git cat-file -e "${SHA}:${FILE}" 2>/dev/null || continue
  git show "${SHA}:${FILE}" > "$TMP/git"
  curl -fsSL "https://raw.githubusercontent.com/Agilotext/Agilotext-Scripts-Public/${SHA}/${FILE}" -o "$TMP/raw"
  curl -fsSL "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${SHA}/${FILE}" -o "$TMP/jsd"
  case "$NAME" in *.js) cp "$TMP/jsd" "$TMP/check.mjs"; node --check "$TMP/check.mjs";; esac
  cmp "$TMP/git" "$TMP/raw"
  cmp "$TMP/git" "$TMP/jsd"
  echo "ok ${NAME} $(shasum -a 256 "$TMP/git" | cut -c1-16)"
done
rm -rf "$TMP"
echo "CDN pin ${SHA}: identical and parseable"
