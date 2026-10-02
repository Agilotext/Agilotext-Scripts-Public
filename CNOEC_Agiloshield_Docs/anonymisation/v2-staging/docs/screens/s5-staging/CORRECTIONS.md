# CORRECTIONS — smoke Premium 2 octobre 2026

Compte : Harriet `anon@test.com` (Pro, Memberstack Test). Page : `https://agilotext-test.webflow.io/tools/agiloshield/premium/dashboard`. Pin live au moment du smoke : `c8abbb0f`.

## Front OK

- Accueil V2 affiché, un seul moteur `#agiloshield-v2-staging`.
- TXT `recette-masquage.txt` (job `1000040872`) : READY, aperçu `PER_A habite ADR_A…`.
- KEEP API sur « Marie Dupont » puis execute : **200**, action revue = KEEP.
- Formats pseudo : le front local n’interdit plus le PDF (à pinner).

## Front corrigé (pas encore sur le pin live)

- Labels types : plus de codes `ADR Adresse` (live `c8abbb0f` les montre encore).
- 422 / `COMMAND_INVALID` : phrase française, plus un générique.
- `If-Match` sur commands/execute. Console `[AgiloShield V2]` avec statut et code.
- SVG icônes : `height` numérique. Panneau revue : overflow sur le contenu focusable.

## Console : à ignorer (pas V2)

- Hotjar / Posthog / UX-Key : `ERR_BLOCKED_BY_CLIENT` (bloqueur).
- MetaMask `ObjectMultiplex` : extension.
- `anonymiser:775` SVG `height: auto`, `New-button_error`, `readyCount` : scripts **V1** de `/dashboard/anonymiser` (édition business). Pas le moteur V2 Premium.
- 404 `…/nvhc9u4gxsag…/lBttA6D59y4NPdHf_aLjcaWthr8` : script Webflow site, initiator `script`. Pas un asset V2.

## Backend (pack Nico, pas envoyé)

- Job Bauer `1000040871` : `POST …/review/execute` **422**. Harriet n’y a pas accès (`JOB_FORBIDDEN`).
- Contre-preuve TXT Harriet : execute **200**.
- Pack : `DEMANDES_NICO/2026-10-02_agiloshield-v2-execute-422/` — gate `OK envoi Nico execute 422`.

## Non 20/20 produit tant que

- Le 422 PDF Bauer n’est pas corrigé.
- `PSEUDO_KEY_INVALID`, restore PDF irréversible, `historyV2` session-only, `TRUST_LINE` Nico.
- www : jamais sans `OK publish www AgiloShield V2`.
