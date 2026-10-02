#!/bin/sh
# Compare Git blob, raw GitHub and jsDelivr for one immutable pin.
# Usage: tests/verify-cdn-pin.sh <full-sha>
set -eu
SHA="${1:?commit sha required}"
FILE="CNOEC_Agiloshield_Docs/anonymisation/v2-staging/agiloshield-v2-embed.js"
ROOT=$(CDPATH= cd -- "$(dirname "$0")/../../../.." && pwd)
cd "$ROOT"
git show "${SHA}:${FILE}" > /tmp/agsh-git-embed.js
curl -fsSL "https://raw.githubusercontent.com/Agilotext/Agilotext-Scripts-Public/${SHA}/${FILE}" -o /tmp/agsh-raw-embed.js
curl -fsSL "https://cdn.jsdelivr.net/gh/Agilotext/Agilotext-Scripts-Public@${SHA}/${FILE}" -o /tmp/agsh-jsd-embed.js
node --check /tmp/agsh-git-embed.js
node --check /tmp/agsh-raw-embed.js
node --check /tmp/agsh-jsd-embed.js
cmp /tmp/agsh-git-embed.js /tmp/agsh-raw-embed.js
cmp /tmp/agsh-git-embed.js /tmp/agsh-jsd-embed.js
shasum -a 256 /tmp/agsh-git-embed.js /tmp/agsh-raw-embed.js /tmp/agsh-jsd-embed.js
echo "CDN pin ${SHA}: identical and parseable"
