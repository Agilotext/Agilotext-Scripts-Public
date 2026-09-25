# Pourquoi l’éditeur charge longtemps à chaque fois

Diagnostic 18/09, mis à jour 25/09 (branche `fix/transcript-history-corrige`).  
**WAIT `OK publish www`.** Recette Bauer (session connectée) : snippet `scripts/dev/agilo-editor-latency-probe.mjs`.

## Trois horloges (ne pas les additionner)

| Horloge | Ce que tu vois | Cause | « À chaque fois » ? |
|---|---|---|---|
| A. Chrome | Page Webflow / menu, avant le PV | Navigation **complète** depuis Mes fichiers (`location.href`) | Oui. Pas une SPA. Hors scope P0. |
| B. Scripts | Parse `Code-*` | Fork + chat + confidence | Download jsDelivr non si cache 7 j. |
| C. Loaders | « Chargement du transcript… » / CR | APIs `cache: no-store` puis pipeline `loadJob` | Oui. Réseau API à chaque job. |

## P0 livré (cette branche)

`applyAfterTranscriptLoad` n’est plus `await` avant le CR. Après `renderSegments` :

1. `agilo:transcript-loaded` (restore history).
2. Confidence en arrière-plan, ignorée si `isStale(seq)`.
3. `receiveSummary` continue sans attendre la confidence.

## P1 livré (cette branche)

CSS iframe : plus `@main` 404. Pin `agilo-iframe-email-block.css` @ `e689423c29b83ec2c261b729e58b1b49bcb98e75`.  
Fork confidence : pin SHA **40 car.** du commit poussé (voir [EDITOR_PIN_MATRIX.md](EDITOR_PIN_MATRIX.md)).

## Recette réseau (2 ouvertures)

Session Bauer, job long (ex. `1000040705`), pas `1000040008`.

1. Cache ON, clic depuis Mes fichiers. Noter texte éditable vs CR visible vs confidence.
2. Hard refresh. Même mesures.

Coller le snippet `node scripts/dev/agilo-editor-latency-probe.mjs` dans la console.

## Hors scope

SPA Mes fichiers, `cache` sur receiveTextJson, `defer` massif, SHA monolithique unique.
