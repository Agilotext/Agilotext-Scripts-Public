# Probe History CR (2026-09-01)

API live : `8.0.4` (31-Aug-2026). Fil 8.0.3 / 8.0.4 = Anon2 PDF, pas l’historique Relancer.

## MCP `list_summary_versions`

Quatre jobs `READY_SUMMARY_READY` du 28/08 au 01/09 : réponse vide (pas de `previousVersions`).

Pas de restore testé (WRITE). Pas de module `agilo-cr-history.js`.

Maquette staging `#agilo-cr-hist` vidée (Business editor). Free / Premium n’avaient pas l’embed.

## Suite

Relancer un CR sur staging, renvoyer le `jobId`. Si `previousVersions` reste vide : trou / allowlist côté API, pas un bug front.
