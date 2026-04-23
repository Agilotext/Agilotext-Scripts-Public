#!/usr/bin/env bash
set -euo pipefail

REPO="Agilotext/Agilotext-Scripts-Public"
CHAT_CSS_PATH="scripts/pages/editor/Code-chat-css.js"
CHAT_JS_PATH="scripts/pages/editor/Code-chat_V05.js"
MAX_RETRIES=3
RETRY_DELAY=2

if [[ "${1:-}" == "--allow-dirty" ]]; then
  ALLOW_DIRTY=1
else
  ALLOW_DIRTY=0
fi

if [[ $ALLOW_DIRTY -ne 1 ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "Erreur: working tree non propre. Commit/stash les changements, ou lance avec --allow-dirty."
  exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
HASH="$(git rev-parse --short HEAD)"

echo "Push en cours sur origin/${BRANCH}..."
git push origin HEAD
echo "Push OK."

check_url() {
  local url="$1"
  local label="$2"
  local attempt=1
  local status=""

  while [[ $attempt -le $MAX_RETRIES ]]; do
    status="$(curl -sI "$url" | awk 'NR==1 {print $2}' | tr -d '\r')"
    if [[ "$status" == "200" ]]; then
      echo "jsDelivr OK (${label}) -> HTTP 200"
      return 0
    fi
    echo "Tentative ${attempt}/${MAX_RETRIES} (${label}) -> HTTP ${status:-inconnu}"
    sleep "$RETRY_DELAY"
    attempt=$((attempt + 1))
  done

  echo "Erreur: jsDelivr non prêt pour ${label} après ${MAX_RETRIES} tentatives."
  return 1
}

CSS_URL="https://cdn.jsdelivr.net/gh/${REPO}@${HASH}/${CHAT_CSS_PATH}"
JS_URL="https://cdn.jsdelivr.net/gh/${REPO}@${HASH}/${CHAT_JS_PATH}"

check_url "$CSS_URL" "Code-chat-css.js"
check_url "$JS_URL" "Code-chat_V05.js"

echo
echo "Balises Webflow (ordre critique: CSS puis JS):"
echo "<script src=\"${CSS_URL}?v=${HASH}\"></script>"
echo "<script src=\"${JS_URL}?v=${HASH}\"></script>"
