# Branches AgiloShield V2 : inventaire figé (02/10/2026)

Branche de vérité : `release/agiloshield-v2` (créée depuis `97d29cb1`, pin servi `f0a1ccc0`).
Worktree : `~/Documents/AGILOTEXT/Agilotext-Scripts-Public-asv2`.

Chaque ancienne branche a un tag annoté `archive/asv2/<nom>` poussé sur `origin`.
Pour relire : `git show archive/asv2/<nom>` ou `git checkout archive/asv2/<nom>`.

## Tags de repère

| Tag | Commit | Rôle |
|-----|--------|------|
| `asv2-staging-f0a1ccc0` | `f0a1ccc0` | Pin V2 servi sur staging au 02/10 |
| `asv2-rollback-71e134ca` | `71e134ca` | Safe UI baseline, rollback V2 |
| `anon2-classic-2.4.19` | `930923c9` | Moteur anon2 en prod, rollback du cut-over |

## Branches contenues dans la release (0 commit unique)

| Branche (`codex/agiloshield-v2-…`) | HEAD | Date | Dernier commit |
|-----|-----|-----|-----|
| `targeted-fixes-20261002` | `97d29cb1` | 02/10 | pin Webflow staging to the parseable embed |
| `safe-ui-baseline-20261002` | `7dc39672` | 02/10 | document safe UI baseline |
| `java-1206-staging-20261001` | `6b5685dc` | 02/10 | pin COPY_PASTE to 1ee2a3d4 |
| `ui-product-grade-2026-10-02` (local) | `6b5685dc` | 02/10 | idem |
| `review-result-first-20261001` | `294e4470` | 01/10 | staging embed and exact rollback |
| `java-1204-compatible-20261001` | `609f1d54` | 01/10 | editor aligned with Java file worker |
| `java-1204-front-20261001` | `1d3697fe` | 01/10 | guard editor against stale artifacts |
| `java-1203-front-20261001` | `8e20382e` | 01/10 | Java file-worker capabilities |
| `restore-ui-20260930` | `ead30b07` | 30/09 | authenticated staging inspection |
| `lists-ux-20260930` | `a445d7a1` | 30/09 | final list UI asset commit |
| `review-ux-20260930` | `132cd918` | 30/09 | upload uncertainty and CORS |
| `reliable-review-20260929` | `52722466` | 30/09 | typo in full commit SHA |
| `lists-front-staging-20260929` (remote) | `cbdc2722` | 29/09 | gated inclusion exclusion |
| `lists-front-staging-20260929` (local, tag `…-local`) | `6a3ba312` | 28/09 | refreshed staging interface |
| `history-batch-20260929` | `eb392246` | 29/09 | batch and history assets |
| `guided-ui-20260929` | `362ac5f2` | 29/09 | staging API URL HTTPS port |
| `auto-flow-20260929` | `2cfde166` | 29/09 | verified front assets |
| `document-editor-20260928` | `6a3ba312` | 28/09 | refreshed staging interface |
| `webflow-staging-20260928` | `63787117` | 28/09 | validated auth asset commit |

## Branches avec des commits uniques (archivées, ne pas merger en bloc)

| Branche | Commits uniques | Contenu | Usage |
|-----|-----|-----|-----|
| `product-ui-20261002` | 15 | Refonte UI en bloc, audit `AGILOSHIELD_V2_UI_UX_AUDIT.md`, `AGILOSHIELD_V2_DESIGN_SYSTEM.md` | Source d'idées, cherry-pick à la main |
| `pseudonym-front-20260928` | 3 | Flag pseudo, façade HTTPS staging | Déjà réimplémenté dans la release |
| `text-preview-visual-20260930` | 1 | Aperçu texte éphémère derrière flag | À reprendre si besoin |

## Hors V2 (garder)

- `fix/anon2-restore-classic-2.4.19` : moteur anon2 live, worktree `Agilotext-Scripts-Public-anon2-inclusion-2.4.15`.
- `feat/agilo-tour-anonymiser` : tour guidé, référence onboarding.

## Ménage

Suppression des branches ci-dessus (local + remote) et prune des worktrees morts : seulement après « OK ménage Git ASV2 ». Les tags restent.
