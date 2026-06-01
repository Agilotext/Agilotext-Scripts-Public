#!/usr/bin/env bash
# Crée un dépôt GitHub PRIVÉ Agilotext avec le kit Fabienne + invitation en lecture.
# Prérequis : gh auth login (compte avec droits sur l'org Agilotext)
#
# Usage :
#   ./publish_fabienne_github.sh
#   ./publish_fabienne_github.sh --repo Agilotext/agiloshield-kit-f-hanras-202606

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO="${1:-Agilotext/agiloshield-kit-f-hanras-202606}"
INVITE_EMAIL="f.hanras@eurallia.fr"
WORK="$(mktemp -d)"

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

if ! command -v gh >/dev/null 2>&1; then
  echo "Installez GitHub CLI : brew install gh" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "Connectez-vous d'abord : gh auth login" >&2
  exit 1
fi

for f in \
  "$SCRIPT_DIR/GUIDE_FABIENNE_CLAUDE_COWORK.pdf" \
  "$SCRIPT_DIR/agiloshield-ma-f-hanras-20260601.skill"; do
  if [[ ! -f "$f" ]]; then
    echo "Fichier manquant : $f" >&2
    exit 1
  fi
done

cp "$SCRIPT_DIR/github_delivery/README.md" "$WORK/README.md"
cp "$SCRIPT_DIR/GUIDE_FABIENNE_CLAUDE_COWORK.pdf" "$WORK/"
cp "$SCRIPT_DIR/agiloshield-ma-f-hanras-20260601.skill" "$WORK/"

cd "$WORK"
git init -b main
git add README.md GUIDE_FABIENNE_CLAUDE_COWORK.pdf agiloshield-ma-f-hanras-20260601.skill
git commit -m "Kit Agiloshield Fabienne HANRAS — juin 2026"

if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "→ Dépôt existant : $REPO — mise à jour"
  git remote add origin "https://github.com/${REPO}.git"
  git push -u origin main --force
else
  echo "→ Création dépôt privé : $REPO"
  gh repo create "$REPO" \
    --private \
    --description "Kit privé Agiloshield — Fabienne HANRAS (Eurallia), juin 2026" \
    --source=. \
    --remote=origin \
    --push
fi

echo "→ Invitation en lecture : $INVITE_EMAIL"
gh api "repos/${REPO}/invitations" \
  -f email="$INVITE_EMAIL" \
  -f permission=read 2>/dev/null || \
gh api "repos/${REPO}/collaborators/${INVITE_EMAIL}" \
  -X PUT \
  -f permission=pull 2>/dev/null || \
echo "   (Invitation peut-être déjà envoyée — vérifiez sur github.com/${REPO}/settings/access)"

echo ""
echo "OK — dépôt privé : https://github.com/${REPO}"
echo "Fabienne recevra un mail GitHub pour accepter l'invitation, puis pourra télécharger les 2 fichiers."
