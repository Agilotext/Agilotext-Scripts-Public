#!/usr/bin/env bash
# Assemble le kit fichiers démo Fabienne (copie + zip)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ROOT/../../Agilotext-MCP/examples" && pwd)"
DEST="$ROOT/fichiers"

mkdir -p "$DEST"

ORIG="$REPO/bilan-ma-demo-fabienne.docx"
PSEUDO="$REPO/.agiloshield/outputs/bilan-ma-demo-fabienne.pseudonymized.docx"
KEY="$REPO/.agiloshield/keys/bilan-ma-demo-fabienne.properties"

for f in "$ORIG" "$PSEUDO" "$KEY"; do
  if [[ ! -f "$f" ]]; then
    echo "ERREUR: fichier manquant: $f" >&2
    exit 1
  fi
done

cp "$ORIG" "$DEST/01_original_bilan-ma-demo-fabienne.docx"
cp "$PSEUDO" "$DEST/02_pseudonymise_bilan-ma-demo-fabienne.docx"
cp "$KEY" "$DEST/03_cle_bilan-ma-demo-fabienne.properties"

ZIP="$ROOT/Demo_Fabienne_3juin_fichiers.zip"
rm -f "$ZIP"
(cd "$DEST" && zip -q -r "$ZIP" .)

echo "OK — fichiers dans: $DEST"
echo "OK — zip: $ZIP"
ls -la "$DEST"
