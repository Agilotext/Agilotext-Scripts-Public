# Probe anonymisation transcript (2026-09-01, MAJ Anon2)

Job témoin éditeur : `1000039417` (bauerwebpro, staging).

## Phase 0 Anon2 (bauerwebpro, edition `ent`)

`getToken` depuis curl = `error_forbidden_source` (filtre source). Token via `getAuthToken` (même compte, édition `ent`) :

| Étape | Résultat |
|-------|----------|
| `getAnon2UserDefaults` | OK (types compte sauvés, dont `doPseudoAnon`) |
| `setAnon2UserDefaults` `["PER","ORG"]` | OK |
| `POST /anon2AsyncOfficeText` `fileUpload[]` | OK, job `1000039453` |
| Poll `getAnon2Status` | READY en ~3 s |
| `receiveAnon2Text` ANON | TXT UTF-8 |
| Restore defaults | OK |

Types respectés : avec PER+ORG seulement, TEL et EML **restent en clair**. Inline `Stéphane` → `<PER_AA>`. Labels `Speaker:` encore visibles.

## Chemin abandonné : `/anonText`

Masquage partiel, `entityTypes` ignorés. Plus utilisé par l’éditeur dès `3.3.0`.

## Front v3.3.0

Pipeline Classic/MCP : lock defaults, upload TXT, poll, receive blob, restore retry, apply remap.
